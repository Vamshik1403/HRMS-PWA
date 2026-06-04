/**
 * Import Vamshik Maidham attendance from scripts/8_logs.sql only.
 * Date range: 2026-04-20 through 2026-05-20 (inclusive).
 * Never deletes or updates existing records for any employee.
 *
 * Usage:
 *   npm run import:vamshik-attendance
 *   npm run import:vamshik-attendance -- --dry-run
 */
import * as fs from 'fs';
import * as path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  devicePunchToStorageDate,
  parseDevicePunchParts,
} from '../src/common/device-punch-time';

const EMPLOYEE_ID = 'ENPL_123';
const EMPLOYEE_NAME = 'vamshik maidham';
const DATE_FROM = '2026-04-20';
const DATE_TO = '2026-05-20';

type SqlLogRow = {
  id: number;
  companyName: string;
  branchName: string;
  deviceSn: string;
  deviceName: string;
  departmentName: string;
  userName: string;
  usercode: string;
  hrmsempcode: string;
  timestamp: string;
};

type Report = {
  runAt: string;
  sourceFile: string;
  employeeId: string;
  manageEmployeeId: number | null;
  dateFrom: string;
  dateTo: string;
  dryRun: boolean;
  parsedFromFile: number;
  matchedEmployee: number;
  inDateRange: number;
  skippedDuplicate: number;
  esslInserted: number;
  processInserted: number;
  skippedOutOfRange: number;
  skippedWrongEmployee: number;
};

const ROW_RE =
  /^\((\d+),\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(\d+)\),?$/;

function parseArgs() {
  const args = process.argv.slice(2);
  let file = path.resolve(__dirname, '../../scripts/8_logs.sql');
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) file = path.resolve(process.cwd(), args[++i]);
    else if (args[i] === '--dry-run') dryRun = true;
  }
  return { file, dryRun };
}

function parseSqlFile(filePath: string): SqlLogRow[] {
  const text = fs.readFileSync(filePath, 'utf8');
  const rows: SqlLogRow[] = [];
  for (const line of text.split('\n')) {
    const m = line.trim().match(ROW_RE);
    if (!m) continue;
    rows.push({
      id: Number(m[1]),
      companyName: m[2],
      branchName: m[3],
      deviceSn: m[4],
      deviceName: m[5],
      departmentName: m[6],
      userName: m[7],
      usercode: m[8],
      hrmsempcode: m[9],
      timestamp: m[10],
    });
  }
  return rows;
}

function dateKeyFromTimestamp(ts: string): string | null {
  const parts = parseDevicePunchParts(ts.replace(/\.\d{3}$/, ''));
  if (!parts) return ts.slice(0, 10);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function punchTimeString(ts: string): string {
  return ts.replace(/\.\d{3}$/, '').trim();
}

function inRange(dateKey: string, from: string, to: string): boolean {
  return dateKey >= from && dateKey <= to;
}

function isVamshikRow(row: SqlLogRow): boolean {
  const name = row.userName.trim().toLowerCase();
  if (name === EMPLOYEE_NAME) return true;
  const code = row.hrmsempcode.trim().toUpperCase();
  return code === EMPLOYEE_ID || code === '3S_108';
}

async function main() {
  const { file, dryRun } = parseArgs();
  if (!fs.existsSync(file)) {
    throw new Error(`SQL file not found: ${file}`);
  }

  const prisma = new PrismaClient();
  const report: Report = {
    runAt: new Date().toISOString(),
    sourceFile: file,
    employeeId: EMPLOYEE_ID,
    manageEmployeeId: null,
    dateFrom: DATE_FROM,
    dateTo: DATE_TO,
    dryRun,
    parsedFromFile: 0,
    matchedEmployee: 0,
    inDateRange: 0,
    skippedDuplicate: 0,
    esslInserted: 0,
    processInserted: 0,
    skippedOutOfRange: 0,
    skippedWrongEmployee: 0,
  };

  const employee = await prisma.manageEmployee.findFirst({
    where: {
      employeeID: EMPLOYEE_ID,
      lifecycleStatus: 'ACTIVE',
    },
    include: {
      company: { select: { companyName: true } },
      branches: { select: { branchName: true } },
      departments: { select: { departmentName: true } },
    },
  });

  if (!employee) {
    throw new Error(`Active employee not found for ${EMPLOYEE_ID}`);
  }
  report.manageEmployeeId = employee.id;

  const username =
    `${employee.employeeFirstName || ''} ${employee.employeeLastName || ''}`.trim() ||
    EMPLOYEE_ID;

  const rangeStart = devicePunchToStorageDate(`${DATE_FROM} 00:00:00`);
  const rangeEnd = devicePunchToStorageDate(`${DATE_TO} 23:59:59`);
  if (!rangeStart || !rangeEnd) {
    throw new Error('Invalid date range');
  }

  const existing = await prisma.process_att_logs.findMany({
    where: {
      manage_employee_id: employee.id,
      punch_time: { gte: rangeStart, lte: rangeEnd },
    },
    select: { punch_time: true },
  });
  const existingPunchMs = new Set(
    existing
      .map((r) => r.punch_time?.getTime())
      .filter((t): t is number => t != null),
  );

  const existingEssl = await prisma.essl_raw_attlog.findMany({
    where: {
      device_sn: 'CQZ7232160084',
      user_id: { in: ['4', 'ENPL_123', '3s_108'] },
      punch_time: { not: null },
    },
    select: { device_sn: true, user_id: true, punch_time: true },
  });
  const existingEsslKeys = new Set(
    existingEssl.map((r) => `${r.device_sn}|${r.user_id}|${r.punch_time}`),
  );

  const devices = await prisma.devices.findMany({
    select: { id: true, deviceSN: true, deviceName: true, deviceType: true },
  });
  const deviceBySn = new Map(devices.map((d) => [d.deviceSN, d]));

  const allRows = parseSqlFile(file);
  report.parsedFromFile = allRows.length;

  const esslBatch: Prisma.essl_raw_attlogCreateManyInput[] = [];
  const processBatch: Prisma.process_att_logsCreateManyInput[] = [];
  const batchPunchMs = new Set<number>();
  const batchEsslKeys = new Set<string>();

  console.log(`Employee: ${username} (id=${employee.id}, ${EMPLOYEE_ID})`);
  console.log(`Source: ${file}`);
  console.log(`Date range: ${DATE_FROM} to ${DATE_TO}`);
  if (dryRun) console.log('DRY RUN — no database writes');

  for (const row of allRows) {
    if (!isVamshikRow(row)) {
      report.skippedWrongEmployee++;
      continue;
    }
    report.matchedEmployee++;

    const dk = dateKeyFromTimestamp(row.timestamp);
    if (!dk || !inRange(dk, DATE_FROM, DATE_TO)) {
      report.skippedOutOfRange++;
      continue;
    }
    report.inDateRange++;

    const punchStr = punchTimeString(row.timestamp);
    const punchDate = devicePunchToStorageDate(punchStr);
    if (!punchDate) continue;

    const punchMs = punchDate.getTime();
    if (existingPunchMs.has(punchMs) || batchPunchMs.has(punchMs)) {
      report.skippedDuplicate++;
      continue;
    }

    const esslKey = `${row.deviceSn}|${row.usercode}|${punchStr}`;
    if (existingEsslKeys.has(esslKey) || batchEsslKeys.has(esslKey)) {
      report.skippedDuplicate++;
      continue;
    }

    batchPunchMs.add(punchMs);
    batchEsslKeys.add(esslKey);

    const device = deviceBySn.get(row.deviceSn);
    const rawBody = `IMPORTED ${row.usercode} ${punchStr} 1 1 FINGER`;

    esslBatch.push({
      device_sn: row.deviceSn,
      user_id: row.usercode,
      punch_time: punchStr,
      auth_type: 'FINGER',
      raw_body: rawBody,
      log_type: 'IMPORT',
      is_valid: true,
      export: 1,
      created_at: new Date(),
    });

    processBatch.push({
      device_sn: row.deviceSn,
      user_id: row.usercode,
      username: row.userName || username,
      punch_time: punchDate,
      company_name: row.companyName || (employee.company?.companyName ?? null),
      branch_name: row.branchName || (employee.branches?.branchName ?? null),
      department_name: row.departmentName || (employee.departments?.departmentName ?? null),
      device_emp_code: row.usercode,
      manage_employee_id: employee.id,
      device_id: device?.id ?? null,
      device_name: row.deviceName || device?.deviceName || null,
      device_type: device?.deviceType || 'AT',
      auth_type: 'FINGER',
      raw_body: rawBody,
      status: '0',
      processed_at: new Date(),
    });
  }

  if (!dryRun) {
    const CHUNK = 500;
    for (let i = 0; i < esslBatch.length; i += CHUNK) {
      const chunk = esslBatch.slice(i, i + CHUNK);
      const r = await prisma.essl_raw_attlog.createMany({ data: chunk });
      report.esslInserted += r.count;
    }
    for (let i = 0; i < processBatch.length; i += CHUNK) {
      const chunk = processBatch.slice(i, i + CHUNK);
      const r = await prisma.process_att_logs.createMany({ data: chunk });
      report.processInserted += r.count;
    }
  } else {
    report.esslInserted = esslBatch.length;
    report.processInserted = processBatch.length;
  }

  const reportPath = path.resolve(
    __dirname,
    '../../scripts/import/vamshik-attendance-import-report.json',
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n--- Vamshik attendance import ---');
  console.log(`Matched in SQL:    ${report.matchedEmployee}`);
  console.log(`In date range:     ${report.inDateRange}`);
  console.log(`Skipped duplicate: ${report.skippedDuplicate}`);
  console.log(`essl_raw_attlog:   ${report.esslInserted}${dryRun ? ' (would insert)' : ''}`);
  console.log(`process_att_logs:  ${report.processInserted}${dryRun ? ' (would insert)' : ''}`);
  console.log(`Report:            ${reportPath}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
