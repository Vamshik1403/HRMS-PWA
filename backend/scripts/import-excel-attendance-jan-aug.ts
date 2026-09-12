/**
 * Insert-only historical attendance from the monthly Excel grids:
 *   3S Janurary to August/
 *   ENPL 21 Janurary to August/
 * Date range: 2026-01-21 through 2026-08-20 (inclusive).
 *
 * Never deletes or updates existing records. Skips any calendar day that already
 * has process_att_logs punches for that employee.
 *
 * Usage:
 *   npm run import:excel-attendance -- --dry-run
 *   npm run import:excel-attendance
 */
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  devicePunchToStorageDate,
  formatDevicePunchStorage,
} from '../src/common/device-punch-time';

const DATE_FROM = '2026-01-21';
const DATE_TO = '2026-08-20';
const ROOT = path.resolve(__dirname, '../..');
const FOLDERS = [
  { dir: path.join(ROOT, '3S Janurary to August'), label: '3S' },
  { dir: path.join(ROOT, 'ENPL 21 Janurary to August'), label: 'ENPL' },
];

const NAME_ALIASES: Record<string, string> = {
  'vighnesh banbe': 'vignesh banbe',
  'shrvan kumar singh': 'shravan singh',
  'mayur sunil zepale': 'mayur zepale',
  'vinit pradip': 'vinit chavan',
  'vinit pradip chavan': 'vinit chavan',
  'vishal pardule': 'vishal pardule',
};

const STATUS_WORDS = new Set([
  'p',
  'a',
  'lm',
  'wo',
  'od',
  'ho',
  'present',
  'absent',
  'holiday',
  'week off',
  'week of',
  'weekoff',
  'week-off',
  'weekly off',
]);

type EmpInfo = {
  id: number;
  employeeID: string;
  username: string;
  fullNameNorm: string;
  tokens: string[];
  companyID: number | null;
  companyName: string | null;
  branchName: string | null;
  departmentName: string | null;
  deviceID: number | null;
  deviceSN: string;
  deviceName: string | null;
  deviceType: string | null;
  deviceEmpCode: string;
};

type DateGroup = {
  dateKey: string;
  cols: number[];
  inCol: number | null;
  outCol: number | null;
  skipCols: Set<number>;
};

type Report = {
  runAt: string;
  dryRun: boolean;
  dateFrom: string;
  dateTo: string;
  filesRead: string[];
  excelNamesSeen: string[];
  matched: { excelName: string; employeeID: string; manageEmployeeId: number; username: string }[];
  unmatchedNames: string[];
  ambiguousNames: string[];
  punchesParsed: number;
  skippedOutOfRange: number;
  skippedNoTime: number;
  skippedDayAlreadyPresent: number;
  skippedDuplicatePunch: number;
  skippedUnmatched: number;
  esslInserted: number;
  processInserted: number;
};

function parseArgs() {
  const args = process.argv.slice(2);
  return { dryRun: args.includes('--dry-run') };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function normalizeName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyAlias(norm: string): string {
  return NAME_ALIASES[norm] || norm;
}

function normalizeLabel(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isStatusWord(value: unknown): boolean {
  const n = normalizeLabel(value);
  return !n || STATUS_WORDS.has(n);
}

function excelSerialToDateKey(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 40000 || serial > 60000) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function parseHeaderDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    if (value > 1 && value < 1.0001) return null;
    return excelSerialToDateKey(value);
  }
  const s = String(value).trim();
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (year < 2025 || year > 2027 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const asNum = Number(s);
  if (Number.isFinite(asNum) && asNum >= 40000) return excelSerialToDateKey(asNum);
  return null;
}

function excelFractionToHms(frac: number): string | null {
  if (!Number.isFinite(frac) || frac <= 0 || frac >= 1) return null;
  // Dummy "8 working hours" is often stored as an Excel time in In/Out cells.
  if (Math.abs(frac - 8 / 24) < 1e-6) return null;
  const totalSec = Math.round(frac * 24 * 3600);
  const hour = Math.floor(totalSec / 3600);
  const minute = Math.floor((totalSec % 3600) / 60);
  const second = totalSec % 60;
  if (hour < 0 || hour > 23) return null;
  if (hour === 0 && minute === 0 && second === 0) return null;
  return `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
}

function parseClockTime(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    if (value === 0) return null;
    return excelFractionToHms(value);
  }
  const s = String(value).trim();
  if (!s) return null;
  if (isStatusWord(s)) return null;
  if (s === '0' || s === '00:00' || s === '00:00:00' || s === '0:00' || s === '0:00:00') return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) {
    const num = Number(s);
    if (Number.isFinite(num) && num > 0 && num < 1) return excelFractionToHms(num);
    return null;
  }
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  const second = Number(m[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  if (hour === 0 && minute === 0 && second === 0) return null;
  return `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
}

function labelKind(label: string): 'in' | 'out' | 'skip' | 'other' {
  if (!label) return 'other';
  if (label.includes('working') || label.includes('work hr') || label === 'working hr') return 'skip';
  if (label === 'status') return 'skip';
  if (label === 'in time' || label === 'intime' || label === 'in') return 'in';
  if (label === 'out time' || label === 'outtime' || label === 'out') return 'out';
  return 'other';
}

function buildDateGroups(row0: unknown[], row1: unknown[]): DateGroup[] {
  const groups: DateGroup[] = [];
  let i = 1;
  while (i < row0.length) {
    const dateKey = parseHeaderDate(row0[i]);
    if (!dateKey) {
      i++;
      continue;
    }
    const cols: number[] = [i];
    let j = i + 1;
    while (j < row0.length && parseHeaderDate(row0[j]) === dateKey) {
      cols.push(j);
      j++;
    }
    let inCol: number | null = null;
    let outCol: number | null = null;
    const skipCols = new Set<number>();
    for (const c of cols) {
      const kind = labelKind(normalizeLabel(row1[c]));
      if (kind === 'in' && inCol == null) inCol = c;
      else if (kind === 'out' && outCol == null) outCol = c;
      else if (kind === 'skip') skipCols.add(c);
    }
    groups.push({ dateKey, cols, inCol, outCol, skipCols });
    i = j;
  }
  return groups;
}

function timesForDay(row: unknown[], group: DateGroup): string[] {
  const times: string[] = [];
  const push = (v: unknown) => {
    const t = parseClockTime(v);
    if (t && !times.includes(t)) times.push(t);
  };

  if (group.inCol != null) push(row[group.inCol]);
  if (group.outCol != null) push(row[group.outCol]);

  if (times.length === 0) {
    for (const c of group.cols) {
      if (group.skipCols.has(c)) continue;
      if (c === group.inCol || c === group.outCol) continue;
      push(row[c]);
    }
  }
  return times;
}

function inRange(dateKey: string): boolean {
  return dateKey >= DATE_FROM && dateKey <= DATE_TO;
}

function tokensOf(norm: string): string[] {
  return norm.split(' ').filter(Boolean);
}

function uniqueMatch(emps: EmpInfo[], pred: (e: EmpInfo) => boolean): EmpInfo | null | 'ambiguous' {
  const hits = emps.filter(pred);
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) return 'ambiguous';
  return null;
}

function matchEmployee(excelName: string, emps: EmpInfo[]): EmpInfo | null | 'ambiguous' {
  const raw = normalizeName(excelName);
  if (!raw) return null;
  const aliased = applyAlias(raw);
  const excelTokens = tokensOf(aliased);

  const exact = uniqueMatch(emps, (e) => e.fullNameNorm === aliased || e.fullNameNorm === raw);
  if (exact) return exact;

  const contain = uniqueMatch(emps, (e) => {
    if (!excelTokens.length || !e.tokens.length) return false;
    const excelInEmp = excelTokens.every((t) => e.tokens.includes(t));
    const empInExcel = e.tokens.every((t) => excelTokens.includes(t));
    return excelInEmp || empInExcel;
  });
  if (contain) return contain;

  if (excelTokens.length >= 2) {
    const first = excelTokens[0];
    const last = excelTokens[excelTokens.length - 1];
    const fl = uniqueMatch(
      emps,
      (e) => e.tokens.length >= 2 && e.tokens[0] === first && e.tokens[e.tokens.length - 1] === last,
    );
    if (fl) return fl;
  }
  return null;
}

function listXlsx(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'))
    .map((f) => path.join(dir, f))
    .sort();
}

async function main() {
  const { dryRun } = parseArgs();
  const prisma = new PrismaClient();
  const report: Report = {
    runAt: new Date().toISOString(),
    dryRun,
    dateFrom: DATE_FROM,
    dateTo: DATE_TO,
    filesRead: [],
    excelNamesSeen: [],
    matched: [],
    unmatchedNames: [],
    ambiguousNames: [],
    punchesParsed: 0,
    skippedOutOfRange: 0,
    skippedNoTime: 0,
    skippedDayAlreadyPresent: 0,
    skippedDuplicatePunch: 0,
    skippedUnmatched: 0,
    esslInserted: 0,
    processInserted: 0,
  };

  const employees = await prisma.manageEmployee.findMany({
    where: { isDeleted: false },
    include: {
      company: { select: { id: true, companyName: true } },
      branches: { select: { branchName: true } },
      departments: { select: { departmentName: true } },
      empDeviceMapping: {
        include: { device: { select: { id: true, deviceSN: true, deviceName: true, deviceType: true, companyID: true } } },
      },
    },
  });

  const devices = await prisma.devices.findMany({
    select: { id: true, deviceSN: true, deviceName: true, deviceType: true, companyID: true },
  });

  const fallbackByCompany = new Map<number, (typeof devices)[number]>();
  for (const d of devices) {
    if (d.companyID == null) continue;
    if (d.deviceSN === 'CQZ7232160084' && !fallbackByCompany.has(d.companyID)) {
      fallbackByCompany.set(d.companyID, d);
    }
  }
  for (const d of devices) {
    if (d.companyID == null) continue;
    if (!fallbackByCompany.has(d.companyID)) fallbackByCompany.set(d.companyID, d);
  }

  const empInfos: EmpInfo[] = employees.map((e) => {
    const username =
      `${e.employeeFirstName || ''} ${e.employeeLastName || ''}`.trim() || e.employeeID || `Employee ${e.id}`;
    const fullNameNorm = applyAlias(normalizeName(username));
    const mapped = e.empDeviceMapping.find((m) => m.device && m.device.companyID === e.companyID) || e.empDeviceMapping[0];
    const fallback = e.companyID != null ? fallbackByCompany.get(e.companyID) : undefined;
    const device = mapped?.device || fallback;
    return {
      id: e.id,
      employeeID: e.employeeID || String(e.id),
      username,
      fullNameNorm,
      tokens: tokensOf(fullNameNorm),
      companyID: e.companyID ?? null,
      companyName: e.company?.companyName ?? null,
      branchName: e.branches?.branchName ?? null,
      departmentName: e.departments?.departmentName ?? null,
      deviceID: device?.id ?? null,
      deviceSN: device?.deviceSN || 'CQZ7232160084',
      deviceName: device?.deviceName ?? null,
      deviceType: device?.deviceType || 'AT',
      deviceEmpCode: mapped?.deviceEmpCode || e.employeeID || String(e.id),
    };
  });

  const nameMatchCache = new Map<string, EmpInfo | null | 'ambiguous'>();
  const resolveName = (excelName: string) => {
    const key = normalizeName(excelName);
    if (nameMatchCache.has(key)) return nameMatchCache.get(key)!;
    const hit = matchEmployee(excelName, empInfos);
    nameMatchCache.set(key, hit);
    return hit;
  };

  const seenExcelNames = new Set<string>();
  const dayTimes = new Map<string, { emp: EmpInfo; dateKey: string; times: string[]; sourceFile: string; excelName: string }>();

  for (const folder of FOLDERS) {
    for (const file of listXlsx(folder.dir)) {
      report.filesRead.push(file);
      const wb = XLSX.readFile(file, { cellDates: false, raw: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) continue;
      const aoa: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
      if (aoa.length < 3) continue;
      const groups = buildDateGroups(aoa[0] || [], aoa[1] || []);
      const usedDates = new Set<string>();
      const uniqueGroups: DateGroup[] = [];
      for (const g of groups) {
        if (usedDates.has(g.dateKey)) continue;
        usedDates.add(g.dateKey);
        uniqueGroups.push(g);
      }

      for (let r = 2; r < aoa.length; r++) {
        const row = aoa[r] || [];
        const excelName = String(row[0] ?? '').trim();
        if (!excelName) continue;
        seenExcelNames.add(excelName);
        const emp = resolveName(excelName);
        if (emp === 'ambiguous') continue;
        if (!emp) continue;

        for (const g of uniqueGroups) {
          if (!inRange(g.dateKey)) {
            report.skippedOutOfRange++;
            continue;
          }
          const times = timesForDay(row, g);
          if (!times.length) {
            report.skippedNoTime++;
            continue;
          }
          const key = `${emp.id}|${g.dateKey}`;
          const existing = dayTimes.get(key);
          if (!existing) {
            dayTimes.set(key, {
              emp,
              dateKey: g.dateKey,
              times: [...times],
              sourceFile: path.basename(file),
              excelName,
            });
          }
        }
      }
    }
  }

  report.excelNamesSeen = [...seenExcelNames].sort();
  for (const name of report.excelNamesSeen) {
    const hit = resolveName(name);
    if (hit === 'ambiguous') report.ambiguousNames.push(name);
    else if (!hit) report.unmatchedNames.push(name);
    else {
      if (!report.matched.some((m) => m.excelName === name)) {
        report.matched.push({
          excelName: name,
          employeeID: hit.employeeID,
          manageEmployeeId: hit.id,
          username: hit.username,
        });
      }
    }
  }

  const matchedIds = [...new Set(report.matched.map((m) => m.manageEmployeeId))];
  const rangeStart = devicePunchToStorageDate(`${DATE_FROM} 00:00:00`);
  const rangeEnd = devicePunchToStorageDate(`${DATE_TO} 23:59:59`);
  if (!rangeStart || !rangeEnd) throw new Error('Invalid date range');

  const existing = matchedIds.length
    ? await prisma.process_att_logs.findMany({
        where: {
          manage_employee_id: { in: matchedIds },
          punch_time: { gte: rangeStart, lte: rangeEnd },
        },
        select: { manage_employee_id: true, punch_time: true },
      })
    : [];

  const existingDays = new Set<string>();
  const existingPunchMs = new Set<string>();
  for (const row of existing) {
    if (row.manage_employee_id == null || !row.punch_time) continue;
    const fmt = formatDevicePunchStorage(row.punch_time);
    if (fmt) existingDays.add(`${row.manage_employee_id}|${fmt.dateKey}`);
    existingPunchMs.add(`${row.manage_employee_id}|${row.punch_time.getTime()}`);
  }

  const esslBatch: Prisma.essl_raw_attlogCreateManyInput[] = [];
  const processBatch: Prisma.process_att_logsCreateManyInput[] = [];
  const batchDays = new Set<string>();
  const batchPunchMs = new Set<string>();

  for (const day of dayTimes.values()) {
    const dayKey = `${day.emp.id}|${day.dateKey}`;
    if (existingDays.has(dayKey) || batchDays.has(dayKey)) {
      report.skippedDayAlreadyPresent++;
      continue;
    }

    const sorted = [...day.times].sort();
    const useTimes = sorted.length === 1 ? sorted : [sorted[0], sorted[sorted.length - 1]];
    let addedForDay = 0;

    for (const timeStr of useTimes) {
      const punchStr = `${day.dateKey} ${timeStr}`;
      const punchDate = devicePunchToStorageDate(punchStr);
      if (!punchDate) continue;
      report.punchesParsed++;
      const punchKey = `${day.emp.id}|${punchDate.getTime()}`;
      if (existingPunchMs.has(punchKey) || batchPunchMs.has(punchKey)) {
        report.skippedDuplicatePunch++;
        continue;
      }
      batchPunchMs.add(punchKey);
      const emp = day.emp;
      const rawBody = `EXCEL-HIST ${emp.deviceEmpCode} ${punchStr} 1 1 FINGER`;
      esslBatch.push({
        device_sn: emp.deviceSN,
        user_id: emp.deviceEmpCode,
        punch_time: punchStr,
        auth_type: 'FINGER',
        raw_body: rawBody,
        log_type: 'EXCEL_HIST',
        is_valid: true,
        export: 1,
        created_at: new Date(),
      });
      processBatch.push({
        device_sn: emp.deviceSN,
        user_id: emp.deviceEmpCode,
        username: emp.username,
        punch_time: punchDate,
        company_name: emp.companyName,
        branch_name: emp.branchName,
        department_name: emp.departmentName,
        device_emp_code: emp.deviceEmpCode,
        manage_employee_id: emp.id,
        device_id: emp.deviceID,
        device_name: emp.deviceName,
        device_type: emp.deviceType,
        auth_type: 'FINGER',
        raw_body: rawBody,
        status: '0',
        processed_at: new Date(),
      });
      addedForDay++;
    }
    if (addedForDay > 0) batchDays.add(dayKey);
  }

  report.skippedUnmatched = report.unmatchedNames.length;

  if (!dryRun) {
    const CHUNK = 500;
    for (let i = 0; i < esslBatch.length; i += CHUNK) {
      const r = await prisma.essl_raw_attlog.createMany({ data: esslBatch.slice(i, i + CHUNK) });
      report.esslInserted += r.count;
    }
    for (let i = 0; i < processBatch.length; i += CHUNK) {
      const r = await prisma.process_att_logs.createMany({ data: processBatch.slice(i, i + CHUNK) });
      report.processInserted += r.count;
    }
  } else {
    report.esslInserted = esslBatch.length;
    report.processInserted = processBatch.length;
  }

  const reportPath = path.join(ROOT, 'scripts/import/excel-attendance-jan-aug-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n--- Excel historical attendance import ---');
  console.log(`Mode:                 ${dryRun ? 'DRY RUN (no writes)' : 'LIVE INSERT'}`);
  console.log(`Files:                ${report.filesRead.length}`);
  console.log(`Excel names:          ${report.excelNamesSeen.length}`);
  console.log(`Matched employees:    ${report.matched.length}`);
  console.log(`Unmatched names:      ${report.unmatchedNames.join(', ') || '(none)'}`);
  console.log(`Ambiguous names:      ${report.ambiguousNames.join(', ') || '(none)'}`);
  console.log(`Parsed punches:       ${report.punchesParsed}`);
  console.log(`Skipped no time:      ${report.skippedNoTime}`);
  console.log(`Skipped day present:  ${report.skippedDayAlreadyPresent}`);
  console.log(`Skipped duplicate:    ${report.skippedDuplicatePunch}`);
  console.log(`essl_raw_attlog:      ${report.esslInserted}${dryRun ? ' (would insert)' : ''}`);
  console.log(`process_att_logs:     ${report.processInserted}${dryRun ? ' (would insert)' : ''}`);
  console.log(`Report:               ${reportPath}`);
  if (report.matched.length) {
    console.log('\nMatches:');
    for (const m of report.matched) {
      console.log(`  ${m.excelName} -> ${m.username} (${m.employeeID}, id=${m.manageEmployeeId})`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
