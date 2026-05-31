/**
 * Import attendance from scripts/8_logs.sql into essl_raw_attlog + process_att_logs.
 *
 * Usage:
 *   npm run import:attendance-logs
 *   npm run import:attendance-logs -- --from 2026-05-21 --to 2026-05-30
 *   npm run import:attendance-logs -- --file ../../scripts/8_logs.sql --no-clear
 */
import * as fs from 'fs';
import * as path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  devicePunchToStorageDate,
  parseDevicePunchParts,
} from '../src/common/device-punch-time';

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

type EmpInfo = {
  manageEmployeeID: number;
  username: string;
  companyName: string | null;
  branchName: string | null;
  departmentName: string | null;
  employeeID: string;
};

type Report = {
  runAt: string;
  sourceFile: string;
  dateFrom: string;
  dateTo: string;
  cleared: { essl_raw_attlog: number; process_att_logs: number };
  parsedFromFile: number;
  inDateRange: number;
  esslInserted: number;
  processInserted: number;
  skippedNoEmployee: { hrmsempcode: string; usercode: string; timestamp: string }[];
  skippedOutOfRange: number;
  unmatchedHrmCodes: string[];
};

const ROW_RE =
  /^\((\d+),\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(\d+)\),?$/;

function parseArgs() {
  const args = process.argv.slice(2);
  let file = path.resolve(__dirname, '../../scripts/8_logs.sql');
  let from = '2026-05-21';
  let to = '2026-05-30';
  let clear = true;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) file = path.resolve(process.cwd(), args[++i]);
    else if (args[i] === '--from' && args[i + 1]) from = args[++i];
    else if (args[i] === '--to' && args[i + 1]) to = args[++i];
    else if (args[i] === '--no-clear') clear = false;
  }
  return { file, from, to, clear };
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

function empCodeVariants(code: string): string[] {
  const c = String(code).trim();
  if (!c) return [];
  const stripped = c.replace(/^0+/, '') || '0';
  return stripped === c ? [c] : [c, stripped];
}

async function main() {
  const { file, from, to, clear } = parseArgs();
  if (!fs.existsSync(file)) {
    throw new Error(`SQL file not found: ${file}`);
  }

  const prisma = new PrismaClient();
  const report: Report = {
    runAt: new Date().toISOString(),
    sourceFile: file,
    dateFrom: from,
    dateTo: to,
    cleared: { essl_raw_attlog: 0, process_att_logs: 0 },
    parsedFromFile: 0,
    inDateRange: 0,
    esslInserted: 0,
    processInserted: 0,
    skippedNoEmployee: [],
    skippedOutOfRange: 0,
    unmatchedHrmCodes: [],
  };

  console.log(`Source: ${file}`);
  console.log(`Date range (inclusive): ${from} to ${to}`);

  if (clear) {
    const proc = await prisma.process_att_logs.deleteMany({});
    const raw = await prisma.essl_raw_attlog.deleteMany({});
    report.cleared.process_att_logs = proc.count;
    report.cleared.essl_raw_attlog = raw.count;
    console.log(
      `Cleared process_att_logs=${proc.count}, essl_raw_attlog=${raw.count}`,
    );
  }

  const allRows = parseSqlFile(file);
  report.parsedFromFile = allRows.length;
  console.log(`Parsed ${allRows.length} rows from SQL file`);

  const employees = await prisma.manageEmployee.findMany({
    where: { lifecycleStatus: 'ACTIVE' },
    include: {
      company: { select: { companyName: true } },
      branches: { select: { branchName: true } },
      departments: { select: { departmentName: true } },
    },
  });

  const empByCode = new Map<string, EmpInfo>();
  for (const e of employees) {
    if (!e.employeeID) continue;
    const info: EmpInfo = {
      manageEmployeeID: e.id,
      username:
        `${e.employeeFirstName || ''} ${e.employeeLastName || ''}`.trim() ||
        e.employeeID,
      companyName: e.company?.companyName ?? null,
      branchName: e.branches?.branchName ?? null,
      departmentName: e.departments?.departmentName ?? null,
      employeeID: e.employeeID,
    };
    for (const v of empCodeVariants(e.employeeID)) {
      empByCode.set(v.toLowerCase(), info);
    }
  }

  const devices = await prisma.devices.findMany({
    select: {
      id: true,
      deviceSN: true,
      deviceName: true,
      deviceType: true,
    },
  });
  const deviceBySn = new Map(devices.map((d) => [d.deviceSN, d]));

  const mappingRows = await prisma.empDeviceMapping.findMany({
    include: {
      device: { select: { deviceSN: true } },
      manageEmployee: {
        select: {
          id: true,
          employeeID: true,
          employeeFirstName: true,
          employeeLastName: true,
        },
      },
    },
  });

  const mapByDeviceAndUser = new Map<string, EmpInfo>();
  for (const row of mappingRows) {
    if (!row.device?.deviceSN || !row.deviceEmpCode || !row.manageEmployee) continue;
    const e = row.manageEmployee;
    const info: EmpInfo = {
      manageEmployeeID: e.id,
      username:
        `${e.employeeFirstName || ''} ${e.employeeLastName || ''}`.trim() ||
        e.employeeID ||
        row.deviceEmpCode,
      companyName: null,
      branchName: null,
      departmentName: null,
      employeeID: e.employeeID || '',
    };
    for (const v of empCodeVariants(row.deviceEmpCode)) {
      mapByDeviceAndUser.set(`${row.device.deviceSN}:${v}`.toLowerCase(), info);
    }
  }

  const esslBatch: Prisma.essl_raw_attlogCreateManyInput[] = [];
  const processBatch: Prisma.process_att_logsCreateManyInput[] = [];
  const unmatched = new Set<string>();

  const resolveEmployee = (
    deviceSn: string,
    usercode: string,
    hrmsempcode: string,
  ): EmpInfo | null => {
    for (const v of empCodeVariants(usercode)) {
      const hit = mapByDeviceAndUser.get(`${deviceSn}:${v}`.toLowerCase());
      if (hit) return hit;
    }
    for (const v of empCodeVariants(hrmsempcode)) {
      const hit = empByCode.get(v.toLowerCase());
      if (hit) return hit;
    }
    return null;
  };

  for (const row of allRows) {
    const dk = dateKeyFromTimestamp(row.timestamp);
    if (!dk || !inRange(dk, from, to)) {
      report.skippedOutOfRange++;
      continue;
    }
    report.inDateRange++;

    const emp = resolveEmployee(row.deviceSn, row.usercode, row.hrmsempcode);
    if (!emp) {
      unmatched.add(row.hrmsempcode);
      report.skippedNoEmployee.push({
        hrmsempcode: row.hrmsempcode,
        usercode: row.usercode,
        timestamp: row.timestamp,
      });
      continue;
    }

    const device = deviceBySn.get(row.deviceSn);
    const punchStr = punchTimeString(row.timestamp);
    const punchDate = devicePunchToStorageDate(punchStr);
    if (!punchDate) continue;

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
      username: row.userName || emp.username,
      punch_time: punchDate,
      company_name: row.companyName || emp.companyName,
      branch_name: row.branchName || emp.branchName,
      department_name: row.departmentName || emp.departmentName,
      device_emp_code: row.usercode,
      manage_employee_id: emp.manageEmployeeID,
      device_id: device?.id ?? null,
      device_name: row.deviceName || device?.deviceName || null,
      device_type: device?.deviceType || 'AT',
      auth_type: 'FINGER',
      raw_body: rawBody,
      status: '0',
      processed_at: new Date(),
    });
  }

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

  report.unmatchedHrmCodes = [...unmatched].sort();

  const reportPath = path.resolve(
    __dirname,
    '../../scripts/import/attendance-import-report.json',
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n--- Attendance import summary ---');
  console.log(`In date range:     ${report.inDateRange}`);
  console.log(`essl_raw_attlog:   ${report.esslInserted}`);
  console.log(`process_att_logs:  ${report.processInserted}`);
  console.log(`Skipped (no emp):  ${report.skippedNoEmployee.length}`);
  console.log(`Skipped (range):   ${report.skippedOutOfRange}`);
  if (report.unmatchedHrmCodes.length) {
    console.log(`Unmatched codes:   ${report.unmatchedHrmCodes.join(', ')}`);
  }
  console.log(`Report:            ${reportPath}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
