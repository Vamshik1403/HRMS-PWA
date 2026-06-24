/**
 * Backfill missing punch-in for a calendar day (default: today).
 * Inserts attendance_locations CHECK_IN + process_att_logs for employees
 * with no punch-in that day, excluding named absent employees.
 *
 * Usage:
 *   npx ts-node -r dotenv/config scripts/backfill-missing-punch-in.ts
 *   npx ts-node -r dotenv/config scripts/backfill-missing-punch-in.ts --date 2026-06-24 --time 10:00
 */
import { PrismaClient } from '@prisma/client';
import { devicePunchToStorageDate } from '../src/common/device-punch-time';

const prisma = new PrismaClient();

const EXCLUDED_NAMES: [string, string][] = [
  ['sagar', 'madhav'],
  ['mangesh', 'yewale'],
  ['bhavesh', 'bhatkar'],
  ['vinayak', 'patkar'],
  ['bhalchandra', 'hiwase'],
  ['test', 'test'],
];

function parseArgs() {
  const args = process.argv.slice(2);
  let date = new Date().toISOString().slice(0, 10);
  let time = '10:00:00';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) date = args[++i];
    else if (args[i] === '--time' && args[i + 1]) time = args[++i];
  }
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error('time must be HH:MM');
  const hhmm = time.length === 5 ? `${time}:00` : time;
  return { date, punchLabel: `${date} ${hhmm}` };
}

function isExcluded(first: string | null, last: string | null): boolean {
  const f = (first ?? '').trim().toLowerCase();
  const l = (last ?? '').trim().toLowerCase();
  return EXCLUDED_NAMES.some(([ef, el]) => f === ef && l === el);
}

async function main() {
  const { date, punchLabel } = parseArgs();
  const punchTime = devicePunchToStorageDate(punchLabel);
  if (!punchTime) throw new Error(`Invalid punch time: ${punchLabel}`);

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

  const employees = await prisma.manageEmployee.findMany({
    where: {
      isDeleted: false,
      OR: [{ employmentStatus: null }, { employmentStatus: { not: 'Terminated' } }],
      lifecycleStatus: 'ACTIVE',
    },
    include: {
      company: { select: { companyName: true } },
      branches: { select: { branchName: true } },
      departments: { select: { departmentName: true } },
      empDeviceMapping: { include: { device: true }, take: 1 },
    },
  });

  let inserted = 0;
  const skipped: string[] = [];

  for (const emp of employees) {
    const name = `${emp.employeeFirstName ?? ''} ${emp.employeeLastName ?? ''}`.trim();
    if (isExcluded(emp.employeeFirstName, emp.employeeLastName)) {
      skipped.push(`${name} (absent — excluded)`);
      continue;
    }

    const [devicePunch, pwaIn] = await Promise.all([
      prisma.process_att_logs.findFirst({
        where: {
          manage_employee_id: emp.id,
          punch_time: { gte: dayStart, lte: dayEnd },
        },
        orderBy: { punch_time: 'asc' },
      }),
      prisma.attendanceLocation.findFirst({
        where: {
          employeeId: emp.id,
          checkType: 'CHECK_IN',
          checkinTime: { gte: dayStart, lte: dayEnd },
        },
        orderBy: { checkinTime: 'asc' },
      }),
    ]);

    if (devicePunch || pwaIn) {
      skipped.push(`${name} (already has punch-in)`);
      continue;
    }

    const fullName = name || emp.employeeID || String(emp.id);
    const device = emp.empDeviceMapping[0]?.device;
    const deviceSn = device?.deviceSN ?? 'MANUAL_BACKFILL';
    const deviceName = device?.deviceName ?? 'Manual backfill';
    const rawBody = JSON.stringify({
      source: 'admin_backfill',
      reason: 'missing_punch_in_after_restore',
      checkType: 'CHECK_IN',
      punchLabel,
    });

    await prisma.$transaction(async (tx) => {
      if (emp.mobileAttendanceEnabled) {
        await tx.attendanceLocation.create({
          data: {
            employeeId: emp.id,
            checkType: 'CHECK_IN',
            latitude: 19.2038,
            longitude: 72.843,
            accuracy: null,
            address: 'Backfill punch-in 10:00 AM',
            companyID: emp.companyID,
            branchesID: emp.branchesID,
            serviceProviderID: emp.serviceProviderID,
            checkinTime: punchTime,
          },
        });

        await tx.process_att_logs.create({
          data: {
            device_sn: 'LOCATION_APP',
            user_id: emp.employeeID ?? String(emp.id),
            username: fullName,
            punch_time: punchTime,
            company_name: emp.company?.companyName ?? null,
            branch_name: emp.branches?.branchName ?? null,
            department_name: emp.departments?.departmentName ?? null,
            device_emp_code: emp.employeeID ?? null,
            manage_employee_id: emp.id,
            device_id: device?.id ?? null,
            device_name: 'Location Attendance App',
            device_type: 'MOBILE',
            auth_type: 'GPS',
            raw_body: rawBody,
            status: '0',
          },
        });
      } else {
        await tx.process_att_logs.create({
          data: {
            device_sn: deviceSn,
            user_id: emp.employeeID ?? String(emp.id),
            username: fullName,
            punch_time: punchTime,
            company_name: emp.company?.companyName ?? null,
            branch_name: emp.branches?.branchName ?? null,
            department_name: emp.departments?.departmentName ?? null,
            device_emp_code: emp.employeeID ?? null,
            manage_employee_id: emp.id,
            device_id: device?.id ?? null,
            device_name: deviceName,
            device_type: device?.deviceType ?? 'AT',
            auth_type: 'FINGER',
            raw_body: `IMPORTED ${emp.employeeID ?? emp.id} ${punchLabel} 1 1 BACKFILL`,
            status: '0',
          },
        });
      }
    });

    inserted++;
    console.log(`+ ${fullName} (${emp.company?.companyName}) → ${punchLabel}`);
  }

  console.log(`\nDone: ${inserted} punch-in(s) added for ${date}`);
  if (skipped.length) {
    console.log(`Skipped (${skipped.length}):`);
    for (const s of skipped) console.log(`  - ${s}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
