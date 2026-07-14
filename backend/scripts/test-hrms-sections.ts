/**
 * HRMS section smoke + CRUD integration tests (API + policy logic).
 * Run: cd backend && npx ts-node -r dotenv/config scripts/test-hrms-sections.ts
 */
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import { execSync } from 'child_process';
import { computeDayStatus } from '../src/dashboard-overview/attendance-status.engine';

const MARKER = '__HRMS_SECTION_TEST__';
const API = process.env.HRMS_API_URL || 'http://127.0.0.1:3001/backend';
const prisma = new PrismaClient();

type Result = {
  section: string;
  list: 'pass' | 'fail' | 'skip';
  create?: 'pass' | 'fail' | 'skip';
  update?: 'pass' | 'fail' | 'skip';
  approve?: 'pass' | 'fail' | 'skip';
  delete?: 'pass' | 'fail' | 'skip';
  detail: string;
};

const results: Result[] = [];

function tokenFor(user: { id: number; username: string; role: string }) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role, type: 'user' },
    process.env.JWT_SECRET || 'secret123',
    { expiresIn: '1h' },
  );
}

async function api(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; data: any; text: string }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, text: text.slice(0, 300) };
}

function record(r: Result) {
  results.push(r);
  const bits = [
    `list=${r.list}`,
    r.create ? `create=${r.create}` : null,
    r.update ? `update=${r.update}` : null,
    r.approve ? `approve=${r.approve}` : null,
    r.delete ? `delete=${r.delete}` : null,
  ]
    .filter(Boolean)
    .join(' ');
  const icon =
    r.list === 'fail' ||
    r.create === 'fail' ||
    r.update === 'fail' ||
    r.approve === 'fail' ||
    r.delete === 'fail'
      ? '✗'
      : '✓';
  console.log(`${icon} ${r.section.padEnd(28)} ${bits} — ${r.detail}`);
}

async function crudSection(
  section: string,
  base: string,
  token: string,
  createBody: Record<string, unknown>,
  patchBody: Record<string, unknown>,
) {
  const listRes = await api('GET', `/${base}`, token);
  if (listRes.status !== 200) {
    record({ section, list: 'fail', detail: `GET ${listRes.status}: ${listRes.text}` });
    return;
  }

  const createRes = await api('POST', `/${base}`, token, createBody);
  if (createRes.status !== 201 && createRes.status !== 200) {
    record({
      section,
      list: 'pass',
      create: 'fail',
      detail: `POST ${createRes.status}: ${createRes.text}`,
    });
    return;
  }

  const id = createRes.data?.id ?? createRes.data?.data?.id;
  if (!id) {
    record({ section, list: 'pass', create: 'pass', update: 'skip', delete: 'skip', detail: 'created but no id returned' });
    return;
  }

  const patchRes = await api('PATCH', `/${base}/${id}`, token, patchBody);
  const delRes = await api('DELETE', `/${base}/${id}`, token);

  record({
    section,
    list: 'pass',
    create: 'pass',
    update: patchRes.status === 200 ? 'pass' : 'fail',
    delete: delRes.status === 200 || delRes.status === 204 ? 'pass' : 'fail',
    detail:
      patchRes.status === 200 && (delRes.status === 200 || delRes.status === 204)
        ? 'CRUD ok'
        : `PATCH ${patchRes.status}, DELETE ${delRes.status}`,
  });
}

async function listOnly(section: string, path: string, token: string, expectOk = true) {
  const res = await api('GET', path, token);
  const ok = expectOk ? res.status === 200 : res.status < 500;
  record({
    section,
    list: ok ? 'pass' : 'fail',
    detail: ok ? `GET ${res.status}` : `GET ${res.status}: ${res.text}`,
  });
}

function pastDateIso(daysAgo = 7): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function weekdayName(isoDate: string): string {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[new Date(`${isoDate}T12:00:00`).getDay()];
}

async function findTestEmployee(companyId: number) {
  return (
    (await prisma.manageEmployee.findFirst({
      where: {
        isDeleted: false,
        companyID: companyId,
        leavePolicyID: { not: null },
        attendancePolicyID: { not: null },
        monthlyPayGradeID: { not: null },
      },
      orderBy: { id: 'asc' },
    })) ||
    (await prisma.manageEmployee.findFirst({
      where: { isDeleted: false, companyID: companyId, leavePolicyID: { not: null } },
      orderBy: { id: 'asc' },
    })) ||
    (await prisma.manageEmployee.findFirst({
      where: { isDeleted: false, companyID: companyId },
      orderBy: { id: 'asc' },
    }))
  );
}

async function testRegularisationFlow(
  token: string,
  companyId: number,
  spId: number,
  branchId: number | undefined,
  employeeId: number,
) {
  const section = 'regularisation';
  const attendanceDate = pastDateIso(10);
  const day = weekdayName(attendanceDate);

  const listRes = await api('GET', '/emp-attendance-regularise', token);
  if (listRes.status !== 200) {
    record({ section, list: 'fail', detail: `GET ${listRes.status}: ${listRes.text}` });
    return;
  }

  const statusRes = await api(
    'GET',
    `/emp-attendance-regularise/fetch-status?employeeId=${employeeId}&date=${attendanceDate}`,
    token,
  );
  if (statusRes.status !== 200) {
    record({
      section,
      list: 'pass',
      create: 'fail',
      detail: `fetch-status ${statusRes.status}: ${statusRes.text}`,
    });
    return;
  }

  await prisma.empAttendanceRegularise.deleteMany({
    where: {
      manageEmployeeID: employeeId,
      attendanceDate: new Date(`${attendanceDate}T12:00:00.000Z`),
      OR: [{ reason: { contains: MARKER } }, { status: 'Pending' }],
    },
  });

  const createBody = {
    serviceProviderID: spId,
    companyID: companyId,
    branchesID: branchId,
    manageEmployeeID: employeeId,
    attendanceDate,
    day,
    checkInTime: `${attendanceDate}T09:00:00.000Z`,
    checkOutTime: `${attendanceDate}T18:00:00.000Z`,
    actualStatus: 'ABSENT',
    requestedStatus: 'PRESENT',
    reason: `${MARKER} absent day regularisation`,
    remarks: `${MARKER} pending`,
    status: 'Pending',
  };

  const createRes = await api('POST', '/emp-attendance-regularise', token, createBody);
  if (createRes.status !== 201 && createRes.status !== 200) {
    record({
      section,
      list: 'pass',
      create: 'fail',
      detail: `POST ${createRes.status}: ${createRes.text}`,
    });
    return;
  }

  const id = createRes.data?.id;
  if (!id) {
    record({ section, list: 'pass', create: 'pass', detail: 'created but no id' });
    return;
  }

  const patchRes = await api('PATCH', `/emp-attendance-regularise/${id}`, token, {
    remarks: `${MARKER} updated`,
  });
  const approveRes = await api('PATCH', `/emp-attendance-regularise/${id}`, token, {
    status: 'Approved',
  });
  const afterApprove = await api(
    'GET',
    `/emp-attendance-regularise/fetch-status?employeeId=${employeeId}&date=${attendanceDate}`,
    token,
  );
  const delRes = await api('DELETE', `/emp-attendance-regularise/${id}`, token);

  const approvedOk = approveRes.status === 200;
  const regularized =
    afterApprove.status === 200 && afterApprove.data?.isRegularized === true;

  record({
    section,
    list: 'pass',
    create: 'pass',
    update: patchRes.status === 200 ? 'pass' : 'fail',
    approve: approvedOk && regularized ? 'pass' : 'fail',
    delete: delRes.status === 200 || delRes.status === 204 ? 'pass' : 'fail',
    detail:
      approvedOk && regularized
        ? `CRUD+approve ok (fetch-status regularized)`
        : `PATCH ${patchRes.status}, approve ${approveRes.status}, regularized=${regularized}`,
  });
}

async function testLeaveApplicationFlow(
  token: string,
  companyId: number,
  spId: number,
  branchId: number | undefined,
  employeeId: number,
) {
  const section = 'leave-applications';
  const fromDate = '2099-09-02';
  const toDate = '2099-09-02';

  const listRes = await api('GET', '/leave-application', token);
  if (listRes.status !== 200) {
    record({ section, list: 'fail', detail: `GET ${listRes.status}: ${listRes.text}` });
    return;
  }

  await prisma.leaveApplication.deleteMany({
    where: {
      manageEmployeeID: employeeId,
      purpose: { contains: MARKER },
    },
  });

  const createRes = await api('POST', '/leave-application', token, {
    serviceProviderID: spId,
    companyID: companyId,
    branchesID: branchId,
    manageEmployeeID: employeeId,
    appliedLeaveType: 'LoP',
    fromDate,
    toDate,
    purpose: `${MARKER} single-day LoP`,
    status: 'Pending',
  });

  if (createRes.status !== 201 && createRes.status !== 200) {
    record({
      section,
      list: 'pass',
      create: 'fail',
      detail: `POST ${createRes.status}: ${createRes.text}`,
    });
    return;
  }

  const id = createRes.data?.id;
  if (!id) {
    record({ section, list: 'pass', create: 'pass', detail: 'created but no id' });
    return;
  }

  const patchRes = await api('PATCH', `/leave-application/${id}`, token, {
    purpose: `${MARKER} updated`,
    actorRole: 'COMPANY_ADMIN',
  });
  const approveRes = await api('PATCH', `/leave-application/${id}`, token, {
    status: 'Approved',
    appliedLeaveType: 'LoP',
    dayStatuses: [{ date: fromDate, status: 'LoP' }],
    actorRole: 'COMPANY_ADMIN',
  });
  const getOne = await api('GET', `/leave-application/${id}`, token);
  const delRes = await api('DELETE', `/leave-application/${id}`, token);

  const approved =
    approveRes.status === 200 &&
    (approveRes.data?.status === 'Approved' || getOne.data?.status === 'Approved');

  record({
    section,
    list: 'pass',
    create: 'pass',
    update: patchRes.status === 200 ? 'pass' : 'fail',
    approve: approved ? 'pass' : 'fail',
    delete: delRes.status === 200 || delRes.status === 204 ? 'pass' : 'fail',
    detail: approved
      ? 'CRUD+approve ok (LoP day approved)'
      : `PATCH ${patchRes.status}, approve ${approveRes.status}`,
  });
}

async function testRunPayrollGenerateFlow(
  token: string,
  companyId: number,
  spId: number,
  branchId: number | undefined,
  employeeId: number,
) {
  const section = 'run-payroll';
  const monthPeriod = `${MARKER} August 2099`;

  const listRes = await api('GET', '/generate-salary', token);
  if (listRes.status !== 200) {
    record({ section, list: 'fail', detail: `GET ${listRes.status}: ${listRes.text}` });
    return;
  }

  await prisma.generateSalary.deleteMany({
    where: { employeeID: employeeId, monthPeriod: { contains: MARKER } },
  });

  const createRes = await api('POST', '/generate-salary', token, {
    serviceProviderID: spId,
    companyID: companyId,
    branchesID: branchId,
    employeeID: employeeId,
    monthPeriod,
    paymentRemark: `${MARKER} generate`,
  });

  if (createRes.status !== 201 && createRes.status !== 200) {
    record({
      section,
      list: 'pass',
      create: 'fail',
      detail: `POST ${createRes.status}: ${createRes.text}`,
    });
    return;
  }

  const id = createRes.data?.id;
  if (!id) {
    record({ section, list: 'pass', create: 'pass', detail: 'created but no id' });
    return;
  }

  const patchRes = await api('PATCH', `/generate-salary/${id}`, token, {
    paymentRemark: `${MARKER} updated`,
    status: 'Generated',
  });
  const getOne = await api('GET', `/generate-salary/${id}`, token);
  const delRes = await api('DELETE', `/generate-salary/${id}`, token);

  const generated =
    patchRes.status === 200 &&
    (patchRes.data?.status === 'Generated' || getOne.data?.status === 'Generated');

  record({
    section,
    list: 'pass',
    create: 'pass',
    update: generated ? 'pass' : 'fail',
    delete: delRes.status === 200 || delRes.status === 204 ? 'pass' : 'fail',
    detail: generated ? 'CRUD+generate ok' : `PATCH ${patchRes.status}`,
  });
}

async function testHolidayInAttendanceEngine() {
  const testDate = '2099-06-03'; // Monday
  const shift = {
    isFlexible: false,
    isRotating: false,
    workShiftDay: [
      {
        weekDay: 'Monday',
        shiftType: 'WORK',
        startTime: '09:00',
        endTime: '18:00',
        breakStart: '13:00',
        breakEnd: '14:00',
        totalMinutes: 480,
      },
    ],
  };
  const onHoliday = computeDayStatus({
    date: testDate,
    employeeId: 1,
    companyId: 1,
    branchId: 1,
    punches: [],
    workShift: shift as any,
    policy: { checkin_grace_time_min: 15 } as any,
    publicHolidays: [
      {
        companyID: 1,
        branchesID: null,
        startDate: testDate,
        endDate: testDate,
      },
    ],
    lateMarkTracker: new Map(),
    noCheckoutTracker: new Map(),
    actualMode: true,
  });
  record({
    section: 'policy:holiday-attendance',
    list: onHoliday.type === 'HOLIDAY' || onHoliday.label?.toLowerCase().includes('holiday') ? 'pass' : 'fail',
    detail: `holiday status=${onHoliday.type} label=${onHoliday.label}`,
  });
}

async function main() {
  console.log('\n=== HRMS Full Section Integration Test ===\n');
  console.log(`API: ${API}\n`);

  const superadmin = await prisma.user.findFirst({ where: { role: 'SUPERADMIN', isActive: true } });
  const companyAdmin =
    (await prisma.user.findFirst({ where: { username: 'companyadmin', isActive: true } })) ||
    (await prisma.user.findFirst({ where: { role: 'COMPANY_ADMIN', isActive: true } }));

  if (!superadmin || !companyAdmin) {
    console.error('Missing test users (SUPERADMIN / COMPANY_ADMIN).');
    process.exit(1);
  }

  const superToken = tokenFor(superadmin);
  const companyToken = tokenFor(companyAdmin);

  const company = companyAdmin.companyID
    ? await prisma.company.findUnique({ where: { id: companyAdmin.companyID } })
    : await prisma.company.findFirst();
  const branch = company
    ? await prisma.branches.findFirst({ where: { companyID: company.id } })
    : null;
  const spId = company?.serviceProviderID ?? companyAdmin.serviceProviderID ?? 1;
  const companyId = company?.id ?? companyAdmin.companyID ?? 1;
  const branchId = branch?.id ?? companyAdmin.branchesID ?? undefined;

  console.log(`Superadmin: ${superadmin.username} | Company admin: ${companyAdmin.username} | companyId=${companyId}\n`);

  // --- Superadmin sections ---
  await listOnly('service-providers', '/service-provider', superToken);
  await listOnly('tenants', '/company', superToken);
  await listOnly('system-users', '/users', superToken);
  await listOnly('subscriptions', '/subscription', superToken);
  await listOnly('system-dashboard', '/system-dashboard/live', superToken);

  // --- Company setup ---
  await crudSection(
    'departments',
    'departments',
    companyToken,
    { departmentName: `${MARKER} Dept`, companyID: companyId, branchesID: branchId },
    { departmentName: `${MARKER} Dept Updated` },
  );
  await crudSection(
    'designations',
    'designations',
    companyToken,
    { designation: `${MARKER} Role`, companyID: companyId, branchesID: branchId },
    { designation: `${MARKER} Role Updated` },
  );
  await listOnly('branches', '/branches', companyToken);
  await listOnly('devices', '/devices', companyToken);
  await listOnly('employees', '/manage-emp', companyToken);

  // --- Policies ---
  await crudSection(
    'leave-policy',
    'leave-policy',
    companyToken,
    {
      leavePolicyName: `${MARKER} LP`,
      companyID: companyId,
      serviceProviderID: spId,
      branchesID: branchId,
      sickLeaveCount: '12',
      casualLeaveCount: '12',
      isPrivilegedLeaveApplicable: true,
      privilegedLeaveRatio: '20:1',
      paidLeaveConsideredInPL: true,
    },
    { sickLeaveCount: '10' },
  );

  await crudSection(
    'attendance-policy',
    'attendance-policy',
    companyToken,
    {
      attendancePolicyName: `${MARKER} AP`,
      companyID: companyId,
      serviceProviderID: spId,
      branchesID: branchId,
      checkin_grace_time_min: 15,
      min_work_hours_half_day_min: 240,
    },
    { checkin_grace_time_min: 20 },
  );

  await crudSection(
    'manage-holidays',
    'manage-holiday',
    companyToken,
    {
      holidayName: `${MARKER} Holiday`,
      companyID: companyId,
      serviceProviderID: spId,
      branchesID: branchId,
    },
    { holidayName: `${MARKER} Holiday Updated` },
  );

  await crudSection(
    'public-holiday',
    'public-holiday',
    companyToken,
    {
      companyID: companyId,
      serviceProviderID: spId,
      branchesID: branchId,
      startDate: '2099-12-25',
      endDate: '2099-12-25',
      financialYear: '2099-2099',
    },
    { financialYear: '2099-2100' },
  );

  await listOnly('work-shifts', '/work-shift', companyToken);
  await listOnly('roster', '/rosters', companyToken);

  const testEmp = await findTestEmployee(companyId);
  if (testEmp) {
    await testRegularisationFlow(companyToken, companyId, spId, branchId, testEmp.id);
  } else {
    record({ section: 'regularisation', list: 'skip', detail: 'no employee for regularisation test' });
  }

  // --- Payroll policy ---
  await crudSection(
    'salary-allowances',
    'salary-allowance',
    companyToken,
    {
      salaryAllowanceName: `${MARKER} Allow`,
      companyID: companyId,
      serviceProviderID: spId,
      branchesID: branchId,
      allowanceType: 'Fixed',
      salaryAllowanceValue: '1000',
    },
    { salaryAllowanceValue: '1200' },
  );

  await crudSection(
    'salary-deductions',
    'salary-deduction',
    companyToken,
    {
      salaryDeductionName: `${MARKER} Ded`,
      companyID: companyId,
      serviceProviderID: spId,
      branchesID: branchId,
      salaryDeductionType: 'Fixed',
      salaryDeductionValue: '100',
    },
    { salaryDeductionValue: '150' },
  );

  await listOnly('salary-cycle', '/salary-cycle', companyToken);
  await listOnly('monthly-pay-grade', '/monthly-pay-grade', companyToken);
  await listOnly('bonus-setup', '/bonus-setup', companyToken);

  // --- Payroll ops ---
  await listOnly('bonus-allocations', '/bonus-allocation', companyToken);
  await listOnly('salary-advance', '/salary-advance', companyToken);
  await listOnly('reimbursement', '/reimbursement', companyToken);

  if (testEmp) {
    await testRunPayrollGenerateFlow(companyToken, companyId, spId, branchId, testEmp.id);
    await testLeaveApplicationFlow(companyToken, companyId, spId, branchId, testEmp.id);
  } else {
    record({ section: 'run-payroll', list: 'skip', detail: 'no employee for payroll test' });
    record({ section: 'leave-applications', list: 'skip', detail: 'no employee for leave test' });
  }

  const emp = testEmp;
  if (emp?.leavePolicyID) {
    const plBalance = await api('GET', `/privileged-leave/balance/${emp.id}`, companyToken);
    const plCalc = await api('POST', `/privileged-leave/calculate-from-attendance`, companyToken, {
      employeeID: emp.id,
      leavePolicyID: emp.leavePolicyID,
      fromDate: '2099-01-01',
      toDate: '2099-01-31',
      dryRun: true,
    });
    record({
      section: 'privileged-leave',
      list: plBalance.status === 200 ? 'pass' : 'fail',
      create: plCalc.status === 200 || plCalc.status === 201 ? 'pass' : 'fail',
      detail: `balance=${plBalance.status} calc=${plCalc.status}`,
    });
  } else {
    record({ section: 'privileged-leave', list: 'skip', detail: 'no employee with leave policy' });
  }

  // --- Messaging & reports ---
  await listOnly('internal-messaging', '/employee-memo', companyToken);
  await listOnly('attendance-reports', '/process-att-logs', companyToken);

  // --- Holiday in attendance engine ---
  await testHolidayInAttendanceEngine();

  // --- Policy integration (attendance, leave balance, PL) ---
  console.log('\n--- Policy deep integration (Prisma) ---\n');
  try {
    execSync('npx ts-node -r dotenv/config scripts/test-policy-integration.ts', {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    record({ section: 'policy-integration', list: 'pass', detail: 'all policy checks passed' });
  } catch {
    record({ section: 'policy-integration', list: 'fail', detail: 'see policy test output above' });
  }

  // Cleanup any stray test rows by name marker
  await prisma.departments.deleteMany({ where: { departmentName: { contains: MARKER } } }).catch(() => undefined);
  await prisma.designations.deleteMany({ where: { designation: { contains: MARKER } } }).catch(() => undefined);
  await prisma.leavePolicy.deleteMany({ where: { leavePolicyName: { contains: MARKER } } }).catch(() => undefined);
  await prisma.attendancePolicy.deleteMany({ where: { attendancePolicyName: { contains: MARKER } } }).catch(() => undefined);
  await prisma.manageHoliday.deleteMany({ where: { holidayName: { contains: MARKER } } }).catch(() => undefined);
  await prisma.salaryAllowance.deleteMany({ where: { salaryAllowanceName: { contains: MARKER } } }).catch(() => undefined);
  await prisma.salaryDeduction.deleteMany({ where: { salaryDeductionName: { contains: MARKER } } }).catch(() => undefined);
  await prisma.empAttendanceRegularise
    .deleteMany({ where: { reason: { contains: MARKER } } })
    .catch(() => undefined);
  await prisma.leaveApplication
    .deleteMany({ where: { purpose: { contains: MARKER } } })
    .catch(() => undefined);
  await prisma.generateSalary
    .deleteMany({ where: { monthPeriod: { contains: MARKER } } })
    .catch(() => undefined);

  const failed = results.filter(
    (r) =>
      r.list === 'fail' ||
      r.create === 'fail' ||
      r.update === 'fail' ||
      r.approve === 'fail' ||
      r.delete === 'fail',
  );

  console.log('\n=== FINAL REPORT ===');
  console.log(`Sections tested: ${results.length}`);
  console.log(`Fully passing: ${results.length - failed.length}`);
  console.log(`With failures: ${failed.length}`);

  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) {
      console.log(`  - ${f.section}: ${f.detail}`);
    }
    process.exit(1);
  }

  console.log('\nAll section and policy tests passed.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
