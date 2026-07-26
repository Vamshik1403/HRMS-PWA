import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { wallClockInZoneToStorageDate } from '../common/device-punch-time';
import { PrismaService } from '../prisma/prisma.service';
import {
  collapsePunchBursts,
  computeDayStatus,
  type ComputeDayStatusInput,
  parsePunchTime,
  statusDisplayLabel,
  timeToMinutes,
  WEEKDAYS,
} from './attendance-status.engine';

export type TodayOverviewQuery = {
  companyID?: number;
  branchId?: number;
  departmentId?: number;
  serviceProviderID?: number;
};

function dateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function listDatesInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (cur <= end) {
    out.push(dateKeyLocal(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function nextDateKey(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return dateKeyLocal(d);
}

type PunchMap = Map<number, Record<string, string[]>>;

function sortPunchTimes(times: string[]): string[] {
  return [...times].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}

/**
 * Drop exact duplicate punch times, then collapse accidental burst punches
 * (rapid re-taps within MIN_PUNCH_GAP_MIN) so a stray punch a minute after
 * check-in is never paired as the check-out.
 */
function dedupeSortedPunches(times: string[]): string[] {
  const sorted = sortPunchTimes(times);
  const exact: string[] = [];
  for (const t of sorted) {
    if (exact.length === 0 || exact[exact.length - 1] !== t) exact.push(t);
  }
  return collapsePunchBursts(exact);
}

function punchInOut(times: string[]): { inTime: string | null; outTime: string | null } {
  const sorted = dedupeSortedPunches(times);
  if (sorted.length === 0) return { inTime: null, outTime: null };
  if (sorted.length === 1) {
    return { inTime: sorted[0].slice(0, 5), outTime: null };
  }
  return {
    inTime: sorted[0].slice(0, 5),
    outTime: sorted[sorted.length - 1].slice(0, 5),
  };
}

/** Wall-clock time string from a PWA punch Date (stored as UTC components). */
function pwaPunchTimeStr(d: Date): string {
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

type PwaDayRecord = { checkType: string; checkinTime: Date };

/**
 * PWA uses explicit CHECK_IN / CHECK_OUT — not alternating anonymous punches.
 * Only these types count toward in/out display and status (break punches excluded).
 */
function pwaAttendancePunchTimes(records: PwaDayRecord[]): string[] {
  const checkIns = records
    .filter((r) => r.checkType === 'CHECK_IN')
    .sort((a, b) => a.checkinTime.getTime() - b.checkinTime.getTime());
  const checkOuts = records
    .filter((r) => r.checkType === 'CHECK_OUT')
    .sort((a, b) => a.checkinTime.getTime() - b.checkinTime.getTime());
  const times: string[] = [];
  if (checkIns.length > 0) times.push(pwaPunchTimeStr(checkIns[0].checkinTime));
  if (checkOuts.length > 0) times.push(pwaPunchTimeStr(checkOuts[checkOuts.length - 1].checkinTime));
  return times;
}

function pwaPunchInOut(records: PwaDayRecord[]): { inTime: string | null; outTime: string | null } {
  const checkIns = records
    .filter((r) => r.checkType === 'CHECK_IN')
    .sort((a, b) => a.checkinTime.getTime() - b.checkinTime.getTime());
  const checkOuts = records
    .filter((r) => r.checkType === 'CHECK_OUT')
    .sort((a, b) => a.checkinTime.getTime() - b.checkinTime.getTime());
  return {
    inTime: checkIns.length > 0 ? pwaPunchTimeStr(checkIns[0].checkinTime).slice(0, 5) : null,
    outTime:
      checkOuts.length > 0
        ? pwaPunchTimeStr(checkOuts[checkOuts.length - 1].checkinTime).slice(0, 5)
        : null,
  };
}

@Injectable()
export class DashboardOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getTodayOverview(query: TodayOverviewQuery) {
    const nowDate = new Date();
    const today = dateKeyLocal(nowDate);
    const monthStart = `${today.slice(0, 7)}-01`;
    const tomorrow = nextDateKey(today);
    const wallNow = wallClockInZoneToStorageDate(nowDate);
    const nowMin = wallNow.getUTCHours() * 60 + wallNow.getUTCMinutes();

    const employeeWhere: Record<string, unknown> = {
      lifecycleStatus: 'ACTIVE',
      OR: [
        { employmentStatus: null },
        { employmentStatus: { not: 'Terminated' } },
      ],
    };
    if (query.companyID != null) employeeWhere.companyID = query.companyID;
    if (query.serviceProviderID != null) {
      employeeWhere.serviceProviderID = query.serviceProviderID;
    }
    if (query.branchId != null) employeeWhere.branchesID = query.branchId;
    if (query.departmentId != null) {
      employeeWhere.departmentNameID = query.departmentId;
    }

    let employees = await this.prisma.manageEmployee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        companyID: true,
        branchesID: true,
        departmentNameID: true,
        designationID: true,
        employeeFirstName: true,
        employeeLastName: true,
        departments: { select: { departmentName: true } },
        designations: { select: { designation: true } },
        workShiftID: true,
        attendancePolicyID: true,
        mobileAttendanceEnabled: true,
        maxHoursPerDay: true,
        workShift: { include: { workShiftDay: true } },
        attendancePolicy: true,
        empWorkShift: {
          take: 1,
          orderBy: { id: 'desc' },
          include: {
            workShift: { include: { workShiftDay: true } },
          },
        },
        empAttendancePolicy: {
          take: 1,
          orderBy: { id: 'desc' },
          include: { attendancePolicy: true },
        },
      },
    });

    if (employees.length > 0) {
      const approvedTerminations = await this.prisma.employeeTermination.findMany({
        where: {
          employeeId: { in: employees.map((e) => e.id) },
          exitStatus: 'APPROVED',
          lastWorkingDay: { not: null },
        },
        select: { employeeId: true, lastWorkingDay: true },
      });
      const inactiveAfterOffboarding = new Set<number>();
      for (const t of approvedTerminations) {
        if (
          t.lastWorkingDay &&
          dateKeyLocal(new Date(t.lastWorkingDay)) <= today
        ) {
          inactiveAfterOffboarding.add(t.employeeId);
        }
      }
      if (inactiveAfterOffboarding.size > 0) {
        employees = employees.filter((e) => !inactiveAfterOffboarding.has(e.id));
      }
    }

    if (employees.length === 0) {
      return this.emptyResponse(today, query);
    }

    const empIds = employees.map((e) => e.id);
    const mobileEmpIds = employees.filter((e) => e.mobileAttendanceEnabled).map((e) => e.id);
    const companyIds = [...new Set(employees.map((e) => e.companyID).filter(Boolean))] as number[];
    const branchIds = [...new Set(employees.map((e) => e.branchesID).filter(Boolean))] as number[];
    const policyIds = [
      ...new Set(
        employees
          .map((e) => e.attendancePolicyID)
          .filter((id): id is number => id != null),
      ),
    ];
    const shiftIds = [
      ...new Set(
        employees.map((e) => e.workShiftID).filter((id): id is number => id != null),
      ),
    ];

    const branchPolicyOr = companyIds.flatMap((cid) =>
      branchIds.map((bid) => ({ companyID: cid, branchesID: bid })),
    );
    const policyOrClauses = [
      ...(policyIds.length > 0 ? [{ id: { in: policyIds } }] : []),
      ...branchPolicyOr,
    ];
    const shiftOrClauses = [
      ...(shiftIds.length > 0 ? [{ id: { in: shiftIds } }] : []),
      ...companyIds.flatMap((cid) =>
        branchIds.map((bid) => ({ companyID: cid, branchesID: bid })),
      ),
    ];

    const [
      processLogs,
      policies,
      workShifts,
      regularizations,
      leaves,
      rosters,
      publicHolidays,
      absentDeclarations,
    ] = await Promise.all([
      this.prisma.process_att_logs.findMany({
        where: {
          manage_employee_id: { in: empIds },
          // Only the current tracker window is needed (month start → tomorrow).
          // Filtering at the DB avoids scanning the entire historical table.
          punch_time: {
            gte: new Date(`${monthStart}T00:00:00`),
            lte: new Date(`${tomorrow}T23:59:59`),
          },
        },
        select: { manage_employee_id: true, punch_time: true, device_sn: true },
        orderBy: { punch_time: 'asc' },
        take: 200000,
      }),
      policyOrClauses.length > 0
        ? this.prisma.attendancePolicy.findMany({ where: { OR: policyOrClauses } })
        : Promise.resolve([]),
      shiftOrClauses.length > 0
        ? this.prisma.workShift.findMany({
            where: { OR: shiftOrClauses },
            include: { workShiftDay: true },
          })
        : Promise.resolve([]),
      this.prisma.empAttendanceRegularise.findMany({
        where: {
          manageEmployeeID: { in: empIds },
          status: 'Approved',
        },
      }),
      this.prisma.leaveApplication.findMany({
        where: {
          manageEmployeeID: { in: empIds },
          status: 'Approved',
        },
      }),
      this.prisma.roster.findMany({
        where: {
          companyID: query.companyID ?? { in: companyIds },
          branchesID: query.branchId ?? { in: branchIds },
        },
        include: {
          employees: {
            where: { employeeID: { in: empIds } },
            include: {
              days: { include: { workShift: { include: { workShiftDay: true } } } },
            },
          },
        },
      }),
      this.prisma.publicHoliday.findMany({
        where: {
          companyID: query.companyID ?? { in: companyIds },
        },
      }),
      this.prisma.empAbsentDeclaration.findMany({
        where: {
          employeeId: { in: empIds },
          absentDate: {
            gte: new Date(`${monthStart}T00:00:00`),
            lte: new Date(`${tomorrow}T23:59:59`),
          },
        },
      }),
    ]);

    const pwaByEmp = new Map<number, PwaDayRecord[]>();
    if (mobileEmpIds.length > 0) {
      const pwaToday = await this.prisma.attendanceLocation.findMany({
        where: {
          employeeId: { in: mobileEmpIds },
          checkinTime: {
            gte: new Date(`${today}T00:00:00`),
            lte: new Date(`${tomorrow}T00:00:00`),
          },
        },
        select: { employeeId: true, checkType: true, checkinTime: true },
        orderBy: { checkinTime: 'asc' },
      });
      for (const r of pwaToday) {
        if (!pwaByEmp.has(r.employeeId)) pwaByEmp.set(r.employeeId, []);
        pwaByEmp.get(r.employeeId)!.push({
          checkType: r.checkType,
          checkinTime: r.checkinTime,
        });
      }
    }

    // Today's punch rows with location/source detail (small, today-only query).
    // Used to surface the exact punch address + whether it came from the mobile
    // app (GPS) or a biometric device on the admin dashboard.
    const todayLocationLogs = await this.prisma.process_att_logs.findMany({
      where: {
        manage_employee_id: { in: empIds },
        punch_time: {
          gte: new Date(`${today}T00:00:00`),
          lte: new Date(`${tomorrow}T00:00:00`),
        },
      },
      select: {
        manage_employee_id: true,
        punch_time: true,
        device_sn: true,
        device_id: true,
        device_name: true,
        raw_body: true,
      },
      orderBy: { punch_time: 'asc' },
    });

    const deviceSnSet = new Set<string>();
    const deviceIdSet = new Set<number>();
    for (const log of todayLocationLogs) {
      if (log.device_sn && log.device_sn !== 'LOCATION_APP') deviceSnSet.add(log.device_sn);
      if (log.device_id != null) deviceIdSet.add(log.device_id);
    }
    const deviceLocOr: Prisma.DevicesWhereInput[] = [];
    if (deviceIdSet.size > 0) deviceLocOr.push({ id: { in: [...deviceIdSet] } });
    if (deviceSnSet.size > 0) deviceLocOr.push({ deviceSN: { in: [...deviceSnSet] } });
    const deviceRows =
      deviceLocOr.length > 0
        ? await this.prisma.devices.findMany({
            where: { OR: deviceLocOr },
            select: { id: true, deviceSN: true, address: true, latitude: true, longitude: true },
          })
        : [];
    const addressByDeviceId = new Map<number, string | null>();
    const addressByDeviceSn = new Map<string, string | null>();
    for (const d of deviceRows) {
      const addr = d.address?.trim() || null;
      addressByDeviceId.set(d.id, addr);
      addressByDeviceSn.set(d.deviceSN, addr);
    }

    type PunchLoc = { source: 'app' | 'device'; address: string | null; deviceName: string | null };
    const locByEmp = new Map<number, { first: PunchLoc; last: PunchLoc }>();
    for (const log of todayLocationLogs) {
      const empId = log.manage_employee_id;
      if (empId == null || !log.punch_time) continue;
      const dk = dateKeyLocal(new Date(log.punch_time));
      if (dk !== today) continue;
      const isApp = log.device_sn === 'LOCATION_APP';
      let address: string | null = null;
      if (isApp && log.raw_body) {
        try {
          address = JSON.parse(log.raw_body)?.address ?? null;
        } catch {
          address = null;
        }
      } else if (!isApp) {
        address =
          (log.device_id != null ? addressByDeviceId.get(log.device_id) : null) ??
          (log.device_sn ? addressByDeviceSn.get(log.device_sn) : null) ??
          null;
      }
      const loc: PunchLoc = {
        source: isApp ? 'app' : 'device',
        address,
        deviceName: log.device_name ?? null,
      };
      const existing = locByEmp.get(empId);
      if (!existing) locByEmp.set(empId, { first: loc, last: loc });
      else existing.last = loc;
    }

    const formatPunchLocation = (loc: PunchLoc | undefined): string | null => {
      if (!loc) return null;
      return loc.address || null;
    };

    // Per-employee attendance channel: mobile-attendance employees count only
    // PWA (LOCATION_APP) punches; everyone else counts only device punches.
    // This enforces device/mobile exclusivity even for already-synced rows.
    const mobileEnabledById = new Map<number, boolean>(
      employees.map((e) => [e.id, !!e.mobileAttendanceEnabled]),
    );

    const punchMap: PunchMap = new Map();
    for (const log of processLogs) {
      if (log.manage_employee_id == null || !log.punch_time) continue;
      const parsed = parsePunchTime(String(log.punch_time));
      if (!parsed) continue;
      if (parsed.dateKey < monthStart || parsed.dateKey > tomorrow) continue;

      const empId = log.manage_employee_id;
      const isAppPunch = log.device_sn === 'LOCATION_APP';
      const mobileEnabled = mobileEnabledById.get(empId) ?? false;
      // Drop the channel that does not apply to this employee.
      if (mobileEnabled ? !isAppPunch : isAppPunch) continue;

      if (!punchMap.has(empId)) punchMap.set(empId, {});
      const row = punchMap.get(empId)!;
      if (!row[parsed.dateKey]) row[parsed.dateKey] = [];
      row[parsed.dateKey].push(parsed.timeStr);
      row[parsed.dateKey] = dedupeSortedPunches(row[parsed.dateKey]);
    }

    const shiftById = new Map(
      (workShifts as Array<{ id: number } & (typeof workShifts)[0]>).map(
        (s) => [s.id, s] as const,
      ),
    );
    const policyById = new Map(
      (policies as Array<{ id: number } & (typeof policies)[0]>).map(
        (p) => [p.id, p] as const,
      ),
    );

    const rosterByEmployee = new Map<number, (typeof rosters)[0]['employees'][0]>();
    for (const roster of rosters) {
      for (const re of roster.employees) {
        rosterByEmployee.set(re.employeeID, re);
      }
    }

    const policyByBranch = new Map<string, (typeof policies)[0]>();
    for (const p of policies) {
      if (p.companyID != null && p.branchesID != null) {
        policyByBranch.set(`${p.companyID}-${p.branchesID}`, p);
      }
    }

    const regByEmpDate = new Map<string, (typeof regularizations)[0]>();
    for (const r of regularizations) {
      if (!r.manageEmployeeID || !r.attendanceDate) continue;
      const dk = dateKeyLocal(new Date(r.attendanceDate));
      regByEmpDate.set(`${r.manageEmployeeID}-${dk}`, r);
    }

    const leaveByEmpDate = new Map<string, (typeof leaves)[0]>();
    for (const l of leaves) {
      if (!l.manageEmployeeID || !l.fromDate || !l.toDate) continue;
      const from = dateKeyLocal(new Date(l.fromDate));
      const to = dateKeyLocal(new Date(l.toDate));
      for (const d of listDatesInclusive(from, to)) {
        leaveByEmpDate.set(`${l.manageEmployeeID}-${d}`, l);
      }
    }

    const absentByEmpDate = new Set<string>();
    for (const a of absentDeclarations) {
      absentByEmpDate.add(`${a.employeeId}-${dateKeyLocal(new Date(a.absentDate))}`);
    }

    const summary = {
      total: employees.length,
      present: 0,
      absent: 0,
      lateMark: 0,
      halfDay: 0,
      noCheckout: 0,
      onLeave: 0,
      weekOff: 0,
      holiday: 0,
      ot: 0,
      regularized: 0,
    };

    const statusCounts: Record<string, number> = {};
    const rows: Array<{
      id: number;
      employeeFirstName: string;
      employeeLastName: string;
      branchesID: number;
      departmentNameID: number | null;
      departmentName: string | null;
      designationName: string | null;
      inTime: string | null;
      outTime: string | null;
      statusType: string;
      statusLabel: string;
      statusDisplay: string;
      hasPunches: boolean;
      inLocation: string | null;
      outLocation: string | null;
    }> = [];

    const trackerDates = listDatesInclusive(monthStart, today);
    const datesBeforeToday = trackerDates.filter((d) => d < today);

    for (const emp of employees) {
      const empPunches = punchMap.get(emp.id) || {};
      const lateMarkTracker = new Map<string, number>();
      const noCheckoutTracker = new Map<string, number>();

      const empShiftLink = emp.empWorkShift[0];
      let workShift =
        empShiftLink?.workShift ||
        emp.workShift ||
        (emp.workShiftID ? shiftById.get(emp.workShiftID) : undefined);
      if (
        workShift?.id &&
        (!workShift.workShiftDay || workShift.workShiftDay.length === 0)
      ) {
        const fullShift = shiftById.get(workShift.id);
        if (fullShift) workShift = fullShift;
      }

      const rosterEmp = rosterByEmployee.get(emp.id);
      const rosterDayToday = rosterEmp?.days?.find(
        (d) => dateKeyLocal(new Date(d.workDate)) === today,
      );

      if (rosterDayToday?.dayType === 'WORK' && rosterDayToday.workShiftID) {
        const rosterShift =
          shiftById.get(rosterDayToday.workShiftID) ||
          rosterDayToday.workShift;
        if (rosterShift) workShift = rosterShift;
      }

      const policy =
        emp.empAttendancePolicy[0]?.attendancePolicy ||
        emp.attendancePolicy ||
        (emp.attendancePolicyID
          ? policyById.get(emp.attendancePolicyID)
          : undefined) ||
        policyByBranch.get(`${emp.companyID}-${emp.branchesID}`) ||
        null;

      const ctxBase: Omit<
        ComputeDayStatusInput,
        'date' | 'punches' | 'nextDayPunches' | 'lateMarkTracker' | 'noCheckoutTracker'
      > = {
        employeeId: emp.id,
        companyId: emp.companyID!,
        branchId: emp.branchesID!,
        workShift: (workShift || null) as ComputeDayStatusInput['workShift'],
        rosterDay: rosterDayToday
          ? {
              dayType: rosterDayToday.dayType,
              workShift: (rosterDayToday.workShift ||
                (rosterDayToday.workShiftID
                  ? shiftById.get(rosterDayToday.workShiftID)
                  : null)) as ComputeDayStatusInput['workShift'],
            }
          : null,
        policy: policy as ComputeDayStatusInput['policy'],
        publicHolidays: publicHolidays as ComputeDayStatusInput['publicHolidays'],
        actualMode: true,
      };

      for (const date of datesBeforeToday) {
        const punches = empPunches[date] || [];
        const nextDayPunches = empPunches[nextDateKey(date)] || [];
        const rosterDay = rosterEmp?.days?.find(
          (d) => dateKeyLocal(new Date(d.workDate)) === date,
        );

        computeDayStatus({
          ...ctxBase,
          date,
          punches,
          nextDayPunches,
          regularization: regByEmpDate.get(`${emp.id}-${date}`),
          leave: leaveByEmpDate.get(`${emp.id}-${date}`),
          absentDeclared: absentByEmpDate.has(`${emp.id}-${date}`),
          lateMarkTracker,
          noCheckoutTracker,
        });
      }

      const mobileEnabled = !!emp.mobileAttendanceEnabled;
      const pwaToday = pwaByEmp.get(emp.id) || [];
      const todayPunches = mobileEnabled
        ? pwaAttendancePunchTimes(pwaToday)
        : empPunches[today] || [];
      const nextDayPunches = empPunches[tomorrow] || [];
      const status = computeDayStatus({
        ...ctxBase,
        date: today,
        punches: todayPunches,
        nextDayPunches,
        regularization: regByEmpDate.get(`${emp.id}-${today}`),
        leave: leaveByEmpDate.get(`${emp.id}-${today}`),
        absentDeclared: absentByEmpDate.has(`${emp.id}-${today}`),
        lateMarkTracker,
        noCheckoutTracker,
        dayInProgress: true,
      });

      // While an employee has checked in but not yet checked out, the day is
      // still in progress — show "Present" instead of "No checkout" until the
      // shift end (+ checkout buffer) and the employee's max working hours have
      // passed. Only after that window do we surface a missing check-out.
      let effStatus = status;
      if (status.type === 'SINGLE_PUNCH') {
        const firstPunch = todayPunches[0] || null;
        if (firstPunch) {
          const dow = WEEKDAYS[new Date(`${today}T12:00:00`).getDay()];
          const todayShiftDay = (workShift?.workShiftDay || []).find(
            (d) => d.weekDay === dow && d.shiftType === 'WORK',
          );
          const maxHours = parseFloat(String(emp.maxHoursPerDay || '')) || 0;
          const firstMin = timeToMinutes(firstPunch);
          let windowEnd = 0;
          if (todayShiftDay) {
            const startMin = timeToMinutes(todayShiftDay.startTime || '');
            const endMin = timeToMinutes(todayShiftDay.endTime || '');
            const spansMidnight = endMin < startMin;
            const buffer = (policy?.checkout_end_after_min as number) || 0;
            windowEnd = (spansMidnight ? endMin + 1440 : endMin) + buffer;
          }
          if (maxHours > 0) windowEnd = Math.max(windowEnd, firstMin + maxHours * 60);
          if (windowEnd === 0) windowEnd = firstMin + (maxHours > 0 ? maxHours * 60 : 600);
          const nowNightAware = nowMin < firstMin ? nowMin + 1440 : nowMin;
          if (nowNightAware <= windowEnd) {
            effStatus = { ...status, type: 'PRESENT', label: 'P' };
          } else {
            effStatus = { ...status, type: 'SINGLE_PUNCH', label: 'no checkout' };
          }
        }
      }

      statusCounts[effStatus.type] = (statusCounts[effStatus.type] || 0) + 1;

      const { inTime, outTime } = mobileEnabled
        ? pwaPunchInOut(pwaToday)
        : punchInOut(empPunches[today] || []);

      switch (effStatus.type) {
        case 'PRESENT':
        case 'OT':
          summary.present++;
          break;
        case 'LATE_MARK':
          summary.present++;
          summary.lateMark++;
          break;
        case 'HALF_DAY':
          summary.halfDay++;
          if (!effStatus.hasPunches) summary.absent++;
          break;
        case 'SINGLE_PUNCH':
          summary.noCheckout++;
          summary.present++;
          break;
        case 'ABSENT':
          summary.absent++;
          break;
        case 'LEAVE':
          summary.onLeave++;
          break;
        case 'WEEK_OFF':
          summary.weekOff++;
          break;
        case 'HOLIDAY':
          summary.holiday++;
          break;
        case 'REGULARIZATION':
          summary.regularized++;
          if (effStatus.hasPunches) summary.present++;
          break;
        default:
          if (effStatus.hasPunches) summary.present++;
          else summary.absent++;
      }

      const empLoc = locByEmp.get(emp.id);
      rows.push({
        id: emp.id,
        employeeFirstName: emp.employeeFirstName || '',
        employeeLastName: emp.employeeLastName || '',
        branchesID: emp.branchesID!,
        departmentNameID: emp.departmentNameID,
        departmentName: emp.departments?.departmentName ?? null,
        designationName: emp.designations?.designation ?? null,
        inTime,
        outTime,
        statusType: effStatus.type,
        statusLabel: effStatus.label,
        statusDisplay: statusDisplayLabel(effStatus.type, effStatus.label),
        hasPunches: effStatus.hasPunches,
        inLocation: formatPunchLocation(empLoc?.first),
        outLocation: formatPunchLocation(empLoc?.last),
      });
    }

    rows.sort((a, b) =>
      `${a.employeeFirstName} ${a.employeeLastName}`.localeCompare(
        `${b.employeeFirstName} ${b.employeeLastName}`,
      ),
    );

    return {
      date: today,
      filters: {
        companyID: query.companyID ?? null,
        branchId: query.branchId ?? null,
        departmentId: query.departmentId ?? null,
      },
      summary,
      statusCounts,
      employees: rows,
    };
  }

  private parseProbationMonths(text: string | null | undefined): number | null {
    if (!text?.trim()) return null;
    const m = text.trim().match(/(\d+)/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private addMonthsToDateKey(dateKey: string, months: number): string {
    const d = new Date(`${dateKey}T12:00:00`);
    d.setMonth(d.getMonth() + months);
    return dateKeyLocal(d);
  }

  async getProbationAlerts(query: {
    companyID?: number;
    branchId?: number;
    daysAhead?: number;
  }) {
    const daysAhead = query.daysAhead ?? 60;
    const today = dateKeyLocal(new Date());
    const horizon = new Date(`${today}T12:00:00`);
    horizon.setDate(horizon.getDate() + daysAhead);
    const horizonKey = dateKeyLocal(horizon);

    const where: Record<string, unknown> = { isDeleted: false };
    if (query.companyID != null) where.companyID = query.companyID;
    if (query.branchId != null) where.branchesID = query.branchId;

    const employees = await this.prisma.manageEmployee.findMany({
      where,
      select: {
        id: true,
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        joiningDate: true,
        companyID: true,
        branchesID: true,
        empEmploymentStatus: {
          orderBy: { id: 'desc' },
          take: 5,
        },
      },
    });

    const alerts: {
      employeeId: number;
      employeeCode: string | null;
      employeeName: string;
      probationPeriod: string;
      employmentStatus: string;
      effectFrom: string;
      probationEndDate: string;
      daysRemaining: number;
      isOverdue: boolean;
    }[] = [];

    for (const emp of employees) {
      const current =
        emp.empEmploymentStatus.find((s) => s.employmentStatus === 'Probation') ??
        emp.empEmploymentStatus[0];
      if (!current || current.employmentStatus !== 'Probation') continue;

      const months = this.parseProbationMonths(current.probationPeriod);
      if (!months) continue;

      const startKey =
        (current.effectFrom && String(current.effectFrom).slice(0, 10)) ||
        (emp.joiningDate && String(emp.joiningDate).slice(0, 10));
      if (!startKey) continue;

      const endKey = this.addMonthsToDateKey(startKey, months);
      if (endKey > horizonKey) continue;

      const endMs = new Date(`${endKey}T12:00:00`).getTime();
      const todayMs = new Date(`${today}T12:00:00`).getTime();
      const daysRemaining = Math.ceil((endMs - todayMs) / 86400000);

      alerts.push({
        employeeId: emp.id,
        employeeCode: emp.employeeID,
        employeeName:
          `${emp.employeeFirstName ?? ''} ${emp.employeeLastName ?? ''}`.trim() ||
          `#${emp.id}`,
        probationPeriod: current.probationPeriod ?? `${months} months`,
        employmentStatus: current.employmentStatus ?? 'Probation',
        effectFrom: startKey,
        probationEndDate: endKey,
        daysRemaining,
        isOverdue: daysRemaining < 0,
      });
    }

    alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
    return { today, daysAhead, alerts };
  }

  async getHrWidgets(query: TodayOverviewQuery) {
    const today = new Date();
    const employeeWhere: Prisma.ManageEmployeeWhereInput = {
      isDeleted: false,
      OR: [
        { employmentStatus: null },
        { employmentStatus: { not: 'Terminated' } },
      ],
    };
    if (query.companyID) employeeWhere.companyID = query.companyID;
    if (query.branchId) employeeWhere.branchesID = query.branchId;
    if (query.serviceProviderID) employeeWhere.serviceProviderID = query.serviceProviderID;

    const taskWhere: Prisma.TaskProjectWhereInput = {
      isDeleted: false,
      ...(query.companyID ? { companyID: query.companyID } : {}),
      ...(query.serviceProviderID ? { serviceProviderID: query.serviceProviderID } : {}),
    };

    const leaveWhere: Prisma.leaveApplicationWhereInput = {
      status: { in: ['Pending', 'Partially Approved'] },
      ...(query.companyID ? { companyID: query.companyID } : {}),
      ...(query.branchId ? { branchesID: query.branchId } : {}),
      ...(query.serviceProviderID ? { serviceProviderID: query.serviceProviderID } : {}),
    };

    const reimbWhere: Prisma.ReimbursementWhereInput = {
      status: 'Pending',
      ...(query.companyID ? { companyID: query.companyID } : {}),
      ...(query.branchId ? { branchesID: query.branchId } : {}),
      ...(query.serviceProviderID ? { serviceProviderID: query.serviceProviderID } : {}),
    };

    const advanceWhere: Prisma.SalaryAdvanceWhereInput = {
      status: 'Pending',
      ...(query.companyID ? { companyID: query.companyID } : {}),
      ...(query.branchId ? { branchesID: query.branchId } : {}),
      ...(query.serviceProviderID ? { serviceProviderID: query.serviceProviderID } : {}),
    };

    const memoWhere: Prisma.EmployeeMemoWhereInput = {
      parentMemoId: null,
      undoneAt: null,
      ...(query.companyID ? { companyID: query.companyID } : {}),
      ...(query.branchId ? { branchesID: query.branchId } : {}),
      ...(query.serviceProviderID ? { serviceProviderID: query.serviceProviderID } : {}),
    };

    const [
      imCount,
      taskCount,
      reimbursementCount,
      leaveCount,
      salaryAdvanceCount,
      latestTasks,
      employees,
      holidays,
      company,
    ] = await Promise.all([
      this.prisma.employeeMemo.count({ where: memoWhere }),
      this.prisma.taskProject.count({
        where: { ...taskWhere, status: { not: 'Closed' } },
      }),
      this.prisma.reimbursement.count({ where: reimbWhere }),
      this.prisma.leaveApplication.count({ where: leaveWhere }),
      this.prisma.salaryAdvance.count({ where: advanceWhere }),
      this.prisma.taskProject.findMany({
        where: taskWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          taskCode: true,
          taskName: true,
          status: true,
          priority: true,
          dueDateTime: true,
          createdAt: true,
        },
      }),
      this.prisma.manageEmployee.findMany({
        where: employeeWhere,
        select: {
          id: true,
          employeeFirstName: true,
          employeeLastName: true,
          dateOfBirth: true,
          joiningDate: true,
        },
        take: 2000,
      }),
      this.prisma.publicHoliday.findMany({
        where: {
          ...(query.companyID ? { companyID: query.companyID } : {}),
          ...(query.branchId
            ? { OR: [{ branchesID: null }, { branchesID: query.branchId }] }
            : {}),
          ...(query.serviceProviderID ? { serviceProviderID: query.serviceProviderID } : {}),
        },
        include: { manageHoliday: { select: { holidayName: true } } },
        take: 500,
      }),
      query.companyID
        ? this.prisma.company.findUnique({
            where: { id: query.companyID },
            select: { companyName: true },
          })
        : Promise.resolve(null),
    ]);

    const upcomingEvents = this.buildUpcomingEvents(employees, today);
    const newsFeed = this.buildNewsFeed(employees, holidays, company?.companyName ?? 'Company', today);

    return {
      pendingCounts: {
        im: imCount,
        tasks: taskCount,
        reimbursement: reimbursementCount,
        leave: leaveCount,
        salaryAdvance: salaryAdvanceCount,
      },
      latestTasks,
      upcomingEvents,
      newsFeed,
    };
  }

  private parseMonthDay(value: string | null | undefined): { month: number; day: number } | null {
    if (!value) return null;
    const s = String(value).trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return { month: Number(iso[2]), day: Number(iso[3]) };
    const slash = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (slash) return { month: Number(slash[2]), day: Number(slash[1]) };
    return null;
  }

  /** Full calendar date (year included) — used for onboarding news, not anniversaries. */
  private parseFullDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const s = String(value).trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0, 0);
    }
    const slash = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (slash) {
      return new Date(Number(slash[3]), Number(slash[2]) - 1, Number(slash[1]), 12, 0, 0, 0);
    }
    return null;
  }

  private daysFromToday(today: Date, target: Date): number {
    const a = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0);
    const b = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 12, 0, 0, 0);
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  private eventDateThisYear(today: Date, month: number, day: number): Date {
    return new Date(today.getFullYear(), month - 1, day, 12, 0, 0, 0);
  }

  private buildUpcomingEvents(
    employees: {
      id: number;
      employeeFirstName: string | null;
      employeeLastName: string | null;
      dateOfBirth: string | null;
      joiningDate: string | null;
    }[],
    today: Date,
  ) {
    const events: { id: string; kind: 'birthday' | 'anniversary'; label: string; date: string; when: string }[] = [];

    for (const emp of employees) {
      const name =
        `${emp.employeeFirstName ?? ''} ${emp.employeeLastName ?? ''}`.trim() || 'Employee';

      const dob = this.parseMonthDay(emp.dateOfBirth);
      if (dob) {
        const eventAt = this.eventDateThisYear(today, dob.month, dob.day);
        const diff = this.daysFromToday(today, eventAt);
        if (diff >= -1 && diff <= 14) {
          events.push({
            id: `bday-${emp.id}`,
            kind: 'birthday',
            label: `${name}'s birthday`,
            date: dateKeyLocal(eventAt),
            when:
              diff === -1
                ? 'Yesterday'
                : diff === 0
                  ? 'Today'
                  : diff === 1
                    ? 'Tomorrow'
                    : `In ${diff} days`,
          });
        }
      }

      const join = this.parseMonthDay(emp.joiningDate);
      if (join) {
        const eventAt = this.eventDateThisYear(today, join.month, join.day);
        const diff = this.daysFromToday(today, eventAt);
        if (diff >= -1 && diff <= 14) {
          const years = today.getFullYear() - (Number(String(emp.joiningDate).slice(0, 4)) || today.getFullYear());
          events.push({
            id: `anniv-${emp.id}`,
            kind: 'anniversary',
            label: years > 0 ? `${name} — ${years} yr work anniversary` : `${name} joined the company`,
            date: dateKeyLocal(eventAt),
            when:
              diff === -1
                ? 'Yesterday'
                : diff === 0
                  ? 'Today'
                  : diff === 1
                    ? 'Tomorrow'
                    : `In ${diff} days`,
          });
        }
      }
    }

    events.sort((a, b) => a.date.localeCompare(b.date));
    return events;
  }

  private buildNewsFeed(
    employees: {
      id: number;
      employeeFirstName: string | null;
      employeeLastName: string | null;
      joiningDate: string | null;
    }[],
    holidays: {
      id: number;
      startDate: Date | null;
      manageHoliday: { holidayName: string | null } | null;
    }[],
    companyName: string,
    today: Date,
  ) {
    const items: { id: string; kind: 'onboarding' | 'holiday'; title: string; subtitle: string; date: string }[] = [];

    for (const emp of employees) {
      const joinDate = this.parseFullDate(emp.joiningDate);
      if (!joinDate) continue;
      const diff = this.daysFromToday(today, joinDate);
      // Only actual new joinings (full date), not yearly work anniversaries.
      if (diff === -1 || diff === 0 || diff === 1) {
        const name =
          `${emp.employeeFirstName ?? ''} ${emp.employeeLastName ?? ''}`.trim() || 'New employee';
        const title =
          diff === 0
            ? `${name} onboarded today`
            : diff === 1
              ? `${name} joins tomorrow`
              : `${name} onboarded yesterday`;
        items.push({
          id: `onboard-${emp.id}-${dateKeyLocal(joinDate)}`,
          kind: 'onboarding',
          title,
          subtitle: `Welcome to ${companyName}`,
          date: dateKeyLocal(joinDate),
        });
      }
    }

    for (const h of holidays) {
      if (!h.startDate) continue;
      const eventAt = new Date(h.startDate);
      const diff = this.daysFromToday(today, eventAt);
      if (diff === 0 || diff === 1) {
        const holidayName = h.manageHoliday?.holidayName?.trim() || 'Public holiday';
        items.push({
          id: `holiday-${h.id}`,
          kind: 'holiday',
          title: diff === 0 ? `${holidayName} today` : `${holidayName} tomorrow`,
          subtitle: companyName,
          date: dateKeyLocal(eventAt),
        });
      }
    }

    items.sort((a, b) => b.date.localeCompare(a.date));
    return items;
  }

  private emptyResponse(date: string, query: TodayOverviewQuery) {
    return {
      date,
      filters: {
        companyID: query.companyID ?? null,
        branchId: query.branchId ?? null,
        departmentId: query.departmentId ?? null,
      },
      summary: {
        total: 0,
        present: 0,
        absent: 0,
        lateMark: 0,
        halfDay: 0,
        noCheckout: 0,
        onLeave: 0,
        weekOff: 0,
        holiday: 0,
        ot: 0,
        regularized: 0,
      },
      statusCounts: {},
      employees: [],
    };
  }
}
