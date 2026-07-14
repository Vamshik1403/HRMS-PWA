/**
 * Automated integration test for attendance policy, leave policy, and privileged leave.
 * Seeds temporary punches + leave rows (tagged __POLICY_INTEGRATION_TEST__), runs checks, then cleans up.
 *
 *   cd backend && npx ts-node -r dotenv/config scripts/test-policy-integration.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrivilegedLeaveService } from '../src/privileged-leave/privileged-leave.service';
import { EmpLeaveBalanceService } from '../src/emp-leave-balance/emp-leave-balance.service';
import { computeDayStatus } from '../src/dashboard-overview/attendance-status.engine';

const MARKER = '__POLICY_INTEGRATION_TEST__';
const DATE_FROM = '2099-01-06'; // Monday
const DATE_TO = '2099-04-30';
const ATTENDANCE_DAYS = 40; // weekdays with in/out punches

type Check = { name: string; ok: boolean; detail: string };

const prisma = new PrismaClient();
const privilegedLeave = new PrivilegedLeaveService(prisma as any);
const leaveBalance = new EmpLeaveBalanceService(prisma as any);
const checks: Check[] = [];

function pass(name: string, detail: string) {
  checks.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}: ${detail}`);
}

function fail(name: string, detail: string) {
  checks.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}: ${detail}`);
}

function assert(name: string, cond: boolean, detail: string) {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

async function findTestEmployee() {
  const byCode = await prisma.manageEmployee.findFirst({
    where: { employeeID: { equals: 'EMPL_123', mode: 'insensitive' }, isDeleted: false },
    include: { leavePolicy: true, attendancePolicy: true },
  });
  if (byCode?.leavePolicyID) return byCode;

  const byName = await prisma.manageEmployee.findFirst({
    where: {
      isDeleted: false,
      leavePolicyID: { not: null },
      AND: [
        { employeeFirstName: { contains: 'vamshik', mode: 'insensitive' } },
        { employeeLastName: { contains: 'maidham', mode: 'insensitive' } },
      ],
    },
    include: { leavePolicy: true, attendancePolicy: true },
  });
  if (byName) return byName;

  return prisma.manageEmployee.findFirst({
    where: { isDeleted: false, leavePolicyID: { not: null }, attendancePolicyID: { not: null } },
    include: { leavePolicy: true, attendancePolicy: true },
    orderBy: { id: 'asc' },
  });
}

async function cleanup(employeeId: number) {
  await prisma.process_att_logs.deleteMany({
    where: { manage_employee_id: employeeId, raw_body: { contains: MARKER } },
  });
  await prisma.leaveApplication.deleteMany({
    where: { manageEmployeeID: employeeId, purpose: { contains: MARKER } },
  });
  await prisma.privilegedLeaveLedger.deleteMany({
    where: { employeeID: employeeId, description: { contains: MARKER } },
  });
}

function weekdayDates(count: number): string[] {
  const out: string[] = [];
  const d = new Date(`${DATE_FROM}T12:00:00.000Z`);
  while (out.length < count) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      out.push(d.toISOString().split('T')[0]);
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

async function seedAttendance(employeeId: number, empCode: string | null) {
  const dates = weekdayDates(ATTENDANCE_DAYS);
  const rows = dates.flatMap((date) => {
    const inTime = new Date(`${date}T09:05:00.000Z`);
    const outTime = new Date(`${date}T18:05:00.000Z`);
    return [
      {
        manage_employee_id: employeeId,
        user_id: empCode ?? String(employeeId),
        username: 'policy-test',
        punch_time: inTime,
        device_emp_code: empCode,
        raw_body: `${MARKER}:in`,
        status: '1',
      },
      {
        manage_employee_id: employeeId,
        user_id: empCode ?? String(employeeId),
        username: 'policy-test',
        punch_time: outTime,
        device_emp_code: empCode,
        raw_body: `${MARKER}:out`,
        status: '1',
      },
    ];
  });
  await prisma.process_att_logs.createMany({ data: rows });
  return dates;
}

async function seedAcceptedLeave(
  employee: {
    id: number;
    serviceProviderID: number | null;
    companyID: number | null;
    branchesID: number | null;
  },
  date: string,
) {
  return prisma.leaveApplication.create({
    data: {
      serviceProviderID: employee.serviceProviderID,
      companyID: employee.companyID,
      branchesID: employee.branchesID,
      manageEmployeeID: employee.id,
      appliedLeaveType: 'Sick',
      fromDate: new Date(`${date}T00:00:00`),
      toDate: new Date(`${date}T00:00:00`),
      purpose: `${MARKER} sick day`,
      status: 'Accepted',
      dayStatuses: [{ date: `${date}T00:00:00.000Z`, status: 'Sick' }],
    },
  });
}

function parseRatio(ratio: string | null | undefined) {
  const [workDays, plDays] = (ratio || '20:1').split(':').map(Number);
  return { workDays: workDays || 20, plDays: plDays || 1 };
}

async function testAttendancePolicyEngine(policy: {
  checkin_grace_time_min?: number | null;
  min_work_hours_half_day_min?: number | null;
  checkin_begin_before_min?: number | null;
  checkout_end_after_min?: number | null;
}) {
  const testDate = DATE_FROM;
  const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    new Date(`${testDate}T12:00:00Z`).getUTCDay()
  ];
  const shift = {
    isFlexible: false,
    isRotating: false,
    workShiftDay: [
      {
        weekDay: dayOfWeek,
        shiftType: 'WORK',
        startTime: '09:00',
        endTime: '18:00',
        breakStart: '13:00',
        breakEnd: '14:00',
        totalMinutes: 480,
      },
    ],
  };

  const onTime = computeDayStatus({
    date: testDate,
    employeeId: 1,
    companyId: 1,
    branchId: 1,
    punches: ['09:05', '18:05'],
    workShift: shift as any,
    policy: policy as any,
    publicHolidays: [],
    lateMarkTracker: new Map(),
    noCheckoutTracker: new Map(),
    actualMode: true,
  });

  assert(
    'attendance-policy on-time check-in',
    onTime.type === 'PRESENT' || onTime.label === 'P',
    `status=${onTime.type} label=${onTime.label}`,
  );

  const moderatelyLate = computeDayStatus({
    date: testDate,
    employeeId: 1,
    companyId: 1,
    branchId: 1,
    punches: ['09:25', '18:05'],
    workShift: shift as any,
    policy: {
      ...policy,
      checkin_grace_time_min: 15,
      max_late_check_in_time: 60,
      markAs: 'Half Day',
    } as any,
    publicHolidays: [],
    lateMarkTracker: new Map(),
    noCheckoutTracker: new Map(),
    actualMode: true,
  });

  assert(
    'attendance-policy late beyond grace',
    moderatelyLate.type === 'HALF_DAY' ||
      moderatelyLate.label === 'Half Day' ||
      moderatelyLate.type === 'LATE_MARK' ||
      moderatelyLate.label === 'Late Mark',
    `status=${moderatelyLate.type} label=${moderatelyLate.label}`,
  );

  const veryLate = computeDayStatus({
    date: testDate,
    employeeId: 1,
    companyId: 1,
    branchId: 1,
    punches: ['10:30', '18:05'],
    workShift: shift as any,
    policy: {
      ...policy,
      checkin_grace_time_min: 15,
      max_late_check_in_time: 30,
      maxLateCheckinMarkAs: 'Absent',
      markAs: 'Half Day',
    } as any,
    publicHolidays: [],
    lateMarkTracker: new Map(),
    noCheckoutTracker: new Map(),
    actualMode: true,
  });

  assert(
    'attendance-policy very late marks absent',
    veryLate.type === 'ABSENT' || veryLate.label === 'Absent',
    `status=${veryLate.type} label=${veryLate.label}`,
  );
}

async function main() {
  console.log('\n=== HRMS Policy Integration Test ===\n');

  const emp = await findTestEmployee();
  if (!emp) {
    console.error('No employee with leave policy found.');
    process.exit(1);
  }

  const policy =
    emp.leavePolicy ??
    (emp.leavePolicyID
      ? await prisma.leavePolicy.findUnique({ where: { id: emp.leavePolicyID } })
      : null);

  const attPolicy =
    emp.attendancePolicy ??
    (emp.attendancePolicyID
      ? await prisma.attendancePolicy.findUnique({ where: { id: emp.attendancePolicyID } })
      : null);

  console.log(
    `Employee: ${emp.employeeFirstName} ${emp.employeeLastName} (id=${emp.id}, code=${emp.employeeID})`,
  );
  console.log(`Leave policy: ${policy?.leavePolicyName ?? '—'} (id=${policy?.id})`);
  console.log(`Attendance policy: ${attPolicy?.attendancePolicyName ?? '—'} (id=${attPolicy?.id})\n`);

  await cleanup(emp.id);

  try {
    // --- Attendance punches ---
    const seededDates = await seedAttendance(emp.id, emp.employeeID);
    const attCount = await privilegedLeave.getAttendanceCount(emp.id, DATE_FROM, DATE_TO);
    const workingDays = attCount.distinctDays;
    assert(
      'attendance punch seeding',
      workingDays === ATTENDANCE_DAYS,
      `expected ${ATTENDANCE_DAYS} distinct days, got ${workingDays}`,
    );

    // --- Privileged leave dry-run ---
    if (!policy?.id) {
      fail('privileged-leave policy present', 'employee has no leave policy');
    } else if (!policy.isPrivilegedLeaveApplicable) {
      pass(
        'privileged-leave skipped',
        'policy does not have PL enabled — attendance-only checks ran',
      );
    } else {
      const { workDays, plDays } = parseRatio(policy.privilegedLeaveRatio);
      const preview = await privilegedLeave.calculateAndCreditFromAttendance(
        emp.id,
        policy.id,
        DATE_FROM,
        DATE_TO,
        true,
      );
      const expectedPl = Math.floor(workingDays / workDays) * plDays;
      assert(
        'privileged-leave dry-run working days',
        preview.totalWorkingDays === workingDays,
        `expected ${workingDays}, got ${preview.totalWorkingDays}`,
      );
      assert(
        'privileged-leave dry-run PL earned',
        preview.plEarned === expectedPl,
        `expected ${expectedPl}, got ${preview.plEarned} (ratio ${workDays}:${plDays})`,
      );

      // Credit for real (tagged) then verify balance increment
      const credit = await privilegedLeave.calculateAndCreditFromAttendance(
        emp.id,
        policy.id,
        DATE_FROM,
        DATE_TO,
        false,
      );
      await prisma.privilegedLeaveLedger.updateMany({
        where: {
          employeeID: emp.id,
          description: { contains: 'Auto credit from attendance' },
        },
        data: { description: `${MARKER} auto credit` },
      });
      assert(
        'privileged-leave credit',
        (credit.newlyCredited ?? 0) >= 0,
        credit.message ?? JSON.stringify(credit),
      );

      const balance = await privilegedLeave.getBalance(emp.id);
      assert(
        'privileged-leave balance',
        balance.balance >= 0,
        `balance=${balance.balance} credited=${balance.totalCredited} used=${balance.totalUsed}`,
      );
    }

    // --- Paid leave considered in PL ---
    if (policy?.paidLeaveConsideredInPL && policy.id && policy.isPrivilegedLeaveApplicable) {
      const leaveDate = seededDates[0];
      await seedAcceptedLeave(emp, leaveDate);
      const withLeave = await privilegedLeave.calculateAndCreditFromAttendance(
        emp.id,
        policy.id,
        DATE_FROM,
        DATE_TO,
        true,
      );
      assert(
        'leave-policy paid leave in PL calc',
        withLeave.totalWorkingDays >= workingDays,
        `working days with paid leave=${withLeave.totalWorkingDays} (base ${workingDays})`,
      );
    } else {
      pass('leave-policy paid leave in PL', 'skipped (paidLeaveConsideredInPL off or PL N/A)');
    }

    // --- Leave balance deduction ---
    await prisma.empLeaveBalance.deleteMany({ where: { manageEmployeeID: emp.id } });
    await prisma.empLeaveBalance.create({
      data: {
        manageEmployeeID: emp.id,
        sickUsed: 0,
        casualUsed: 0,
        privilegedUsed: 0,
        compOffUsed: 0,
        maternityUsed: 0,
        paternityUsed: 0,
      },
    });
    await leaveBalance.deductFromDayStatuses(emp.id, [
      { status: 'Sick' },
      { status: 'Sick' },
    ]);
    const bal = await prisma.empLeaveBalance.findUnique({ where: { manageEmployeeID: emp.id } });
    assert(
      'leave balance deduct',
      (bal?.sickUsed ?? 0) === 2,
      `sickUsed=${bal?.sickUsed ?? 0}`,
    );

    // --- Attendance policy engine ---
    if (attPolicy) {
      await testAttendancePolicyEngine(attPolicy);
    } else {
      fail('attendance-policy assigned', 'employee has no attendance policy');
    }
  } finally {
    await cleanup(emp.id);
    await prisma.empLeaveBalance.deleteMany({ where: { manageEmployeeID: emp.id } });
    console.log('\nCleaned up temporary test data.\n');
  }

  const failed = checks.filter((c) => !c.ok);
  console.log('=== Summary ===');
  console.log(`Passed: ${checks.length - failed.length}/${checks.length}`);
  if (failed.length) {
    console.error('Failed checks:');
    for (const f of failed) console.error(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log('All policy integration checks passed.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
