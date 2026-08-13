/**
 * Import Attendance + Attendance Reports integration test.
 * Run: cd backend && npx ts-node -r dotenv/config scripts/test-import-attendance.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { ImportAttendanceService } from '../src/import-attendance/import-attendance.service';
import { ProcessAttLogsService } from '../src/process_att_logs/process_att_logs.service';

const prisma = new PrismaClient();
const importService = new ImportAttendanceService(prisma as any);
const reportsService = new ProcessAttLogsService(prisma as any);

const TEST_DATE = '10/07/2026';
const TEST_DATE_ISO = '2026-07-10';

async function findImportableEmployee(deviceSn: string) {
  const mapping = await prisma.empDeviceMapping.findFirst({
    where: { device: { deviceSN: deviceSn }, deviceEmpCode: { not: null } },
    include: {
      manageEmployee: { select: { id: true, employeeID: true, companyID: true, branchesID: true } },
    },
  });
  if (mapping?.deviceEmpCode && mapping.manageEmployee) {
    return {
      empId: mapping.deviceEmpCode,
      manageEmployeeId: mapping.manageEmployee.id,
      companyID: mapping.manageEmployee.companyID,
      branchesID: mapping.manageEmployee.branchesID,
      source: 'device-mapping',
    };
  }

  const device = await prisma.devices.findFirst({ where: { deviceSN: deviceSn } });
  if (!device) return null;

  const emp = await prisma.manageEmployee.findFirst({
    where: { isDeleted: false, employeeID: { not: null } },
    orderBy: { id: 'asc' },
    select: { id: true, employeeID: true, companyID: true, branchesID: true },
  });
  if (!emp?.employeeID) return null;

  return {
    empId: emp.employeeID,
    manageEmployeeId: emp.id,
    companyID: emp.companyID,
    branchesID: emp.branchesID,
    source: 'employeeID-fallback',
  };
}

async function cleanupTestRows(empId: string, deviceSn: string) {
  await prisma.essl_raw_attlog.deleteMany({
    where: {
      log_type: 'IMPORT',
      user_id: empId,
      device_sn: deviceSn,
      punch_time: { contains: '2026-07-10' },
    },
  });
  await prisma.process_att_logs.deleteMany({
    where: {
      user_id: empId,
      device_sn: deviceSn,
      raw_body: { contains: 'IMPORTED' },
      punch_time: {
        gte: new Date(`${TEST_DATE_ISO}T00:00:00.000Z`),
        lte: new Date(`${TEST_DATE_ISO}T23:59:59.999Z`),
      },
    },
  });
}

/** Mirrors Attendance Reports client logic: logs only count when manage_employee_id matches. */
function countReportsVisibleLogs(
  logs: Array<{ manage_employee_id: number | null }>,
  employeeId: number,
): number {
  return logs.filter((log) => Number(log.manage_employee_id) === employeeId).length;
}

async function main() {
  console.log('\n=== Import Attendance + Reports Test ===\n');

  const device = await prisma.devices.findFirst({
    select: { deviceSN: true },
  });
  if (!device?.deviceSN) {
    console.error('No attendance device found.');
    process.exit(1);
  }

  const target = await findImportableEmployee(device.deviceSN);
  if (!target) {
    console.error('No employee available for import test.');
    process.exit(1);
  }

  const { empId, manageEmployeeId, source } = target;
  const deviceSn = device.deviceSN;

  console.log(`Device: ${deviceSn}`);
  console.log(`Employee: emp_id=${empId}, manageEmployeeId=${manageEmployeeId} (${source})\n`);

  await cleanupTestRows(empId, deviceSn);

  const csvPath = path.join(__dirname, '.tmp-import-attendance-test.csv');
  const csv = [
    'emp_id,log_time,device_sn,auth_type',
    `${empId},${TEST_DATE} 09:00:00,${deviceSn},FINGER`,
    `${empId},${TEST_DATE} 18:00:00,${deviceSn},FINGER`,
  ].join('\n');
  fs.writeFileSync(csvPath, csv);

  const importResult = await importService.importFromBuffer(
    fs.readFileSync(csvPath),
    'test-import.csv',
  );
  console.log('Import result:', importResult);

  const test1Pass =
    importResult.success &&
    importResult.recordsInserted >= 2 &&
    importResult.recordsProcessed >= 2 &&
    (importResult.reportsReadyCount ?? 0) >= 2;
  console.log(test1Pass ? '✓ import inserts rows: PASS' : '✗ import inserts rows: FAIL');

  const importedLogs = await prisma.process_att_logs.findMany({
    where: {
      user_id: empId,
      device_sn: deviceSn,
      raw_body: { contains: 'IMPORTED' },
      punch_time: {
        gte: new Date(`${TEST_DATE_ISO}T00:00:00.000Z`),
        lte: new Date(`${TEST_DATE_ISO}T23:59:59.999Z`),
      },
    },
    orderBy: { punch_time: 'asc' },
  });

  const utcHours = importedLogs
    .map((l) => (l.punch_time ? l.punch_time.getUTCHours() : null))
    .filter((h) => h != null);
  const testTimePass =
    utcHours.includes(9) &&
    utcHours.includes(18) &&
    !utcHours.includes(3) &&
    !utcHours.includes(12);
  console.log(
    testTimePass
      ? `✓ stored wall-clock times (UTC getters show 09:00 & 18:00): PASS [${utcHours.join(', ')}]`
      : `✗ stored wall-clock times: FAIL got UTC hours [${utcHours.join(', ')}] (expected 9 and 18)`,
  );

  const withEmployeeLink = importedLogs.filter((l) => l.manage_employee_id != null);
  const test2Pass =
    importedLogs.length >= 2 &&
    withEmployeeLink.length >= 2 &&
    withEmployeeLink.every((l) => l.username && l.device_id);
  console.log(
    test2Pass
      ? `✓ process_att_logs linked to employee (${withEmployeeLink.length} rows): PASS`
      : '✗ process_att_logs linked to employee: FAIL',
  );

  const apiResult = await reportsService.findAll({
    dateFrom: TEST_DATE_ISO,
    dateTo: TEST_DATE_ISO,
    limit: 10000,
  });
  const apiLogs = apiResult.data || [];
  const importedInApi = apiLogs.filter(
    (l: any) =>
      l.user_id === empId &&
      l.device_sn === deviceSn &&
      String(l.raw_body || '').includes('IMPORTED'),
  );
  const test3Pass = importedInApi.length >= 2;
  console.log(
    test3Pass
      ? `✓ attendance reports API returns imported punches (${importedInApi.length}): PASS`
      : '✗ attendance reports API returns imported punches: FAIL',
  );

  const visibleInReports = countReportsVisibleLogs(importedInApi, manageEmployeeId);
  const test4Pass = visibleInReports >= 2;
  console.log(
    test4Pass
      ? `✓ attendance reports grid would show employee punches (${visibleInReports}): PASS`
      : '✗ attendance reports grid would show employee punches: FAIL',
  );

  const legacyResult = await importService.importFromBuffer(
    Buffer.from(
      [`user_id,log_time,device_sn,auth_type`, `${empId},11/07/2026 09:00:00,${deviceSn},CARD`].join(
        '\n',
      ),
    ),
    'legacy.csv',
  );
  const test5Pass = legacyResult.success && (legacyResult.reportsReadyCount ?? 0) >= 1;
  console.log(test5Pass ? '✓ legacy user_id column: PASS' : '✗ legacy user_id column: FAIL');

  const templateBuf = await importService.downloadTemplate();
  const XLSX = await import('xlsx');
  const wb = XLSX.read(templateBuf, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const templateRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);
  const test6Pass =
    templateRows.length > 0 &&
    Object.prototype.hasOwnProperty.call(templateRows[0], 'emp_id');
  console.log(test6Pass ? '✓ template uses emp_id: PASS' : '✗ template uses emp_id: FAIL');

  await cleanupTestRows(empId, deviceSn);
  await prisma.process_att_logs.deleteMany({
    where: {
      user_id: empId,
      device_sn: deviceSn,
      raw_body: { contains: 'IMPORTED' },
      punch_time: {
        gte: new Date('2026-07-11T00:00:00.000Z'),
        lte: new Date('2026-07-11T23:59:59.999Z'),
      },
    },
  });
  fs.unlinkSync(csvPath);

  const allPass = [test1Pass, test2Pass, testTimePass, test3Pass, test4Pass, test5Pass, test6Pass].every(Boolean);
  console.log(`\n=== ${allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'} ===\n`);
  if (!allPass) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
