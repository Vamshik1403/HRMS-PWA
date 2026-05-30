import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeDayStatus,
  type ComputeDayStatusInput,
  parsePunchTime,
  statusDisplayLabel,
  timeToMinutes,
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

/** Drop consecutive duplicate punch times (same as report row building). */
function dedupeSortedPunches(times: string[]): string[] {
  const sorted = sortPunchTimes(times);
  const out: string[] = [];
  for (const t of sorted) {
    if (out.length === 0 || out[out.length - 1] !== t) out.push(t);
  }
  return out;
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

@Injectable()
export class DashboardOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getTodayOverview(query: TodayOverviewQuery) {
    const today = dateKeyLocal(new Date());
    const monthStart = `${today.slice(0, 7)}-01`;
    const tomorrow = nextDateKey(today);

    const employeeWhere: Record<string, unknown> = {};
    if (query.companyID != null) employeeWhere.companyID = query.companyID;
    if (query.serviceProviderID != null) {
      employeeWhere.serviceProviderID = query.serviceProviderID;
    }
    if (query.branchId != null) employeeWhere.branchesID = query.branchId;
    if (query.departmentId != null) {
      employeeWhere.departmentNameID = query.departmentId;
    }

    const employees = await this.prisma.manageEmployee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        companyID: true,
        branchesID: true,
        departmentNameID: true,
        employeeFirstName: true,
        employeeLastName: true,
        workShiftID: true,
        attendancePolicyID: true,
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

    if (employees.length === 0) {
      return this.emptyResponse(today, query);
    }

    const empIds = employees.map((e) => e.id);
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
          punch_time: { not: null },
        },
        select: { manage_employee_id: true, punch_time: true },
        orderBy: { punch_time: 'asc' },
        take: 500000,
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

    const punchMap: PunchMap = new Map();
    for (const log of processLogs) {
      if (log.manage_employee_id == null || !log.punch_time) continue;
      const parsed = parsePunchTime(String(log.punch_time));
      if (!parsed) continue;
      if (parsed.dateKey < monthStart || parsed.dateKey > tomorrow) continue;

      const empId = log.manage_employee_id;
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
      inTime: string | null;
      outTime: string | null;
      statusType: string;
      statusLabel: string;
      statusDisplay: string;
      hasPunches: boolean;
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

      const todayPunches = empPunches[today] || [];
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
      });

      statusCounts[status.type] = (statusCounts[status.type] || 0) + 1;

      const { inTime, outTime } = punchInOut(todayPunches);

      switch (status.type) {
        case 'PRESENT':
        case 'OT':
          summary.present++;
          break;
        case 'LATE_MARK':
          summary.present++;
          summary.lateMark++;
          break;
        case 'OT':
          summary.present++;
          summary.ot++;
          break;
        case 'HALF_DAY':
          summary.halfDay++;
          if (!status.hasPunches) summary.absent++;
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
          if (status.hasPunches) summary.present++;
          break;
        default:
          if (status.hasPunches) summary.present++;
          else summary.absent++;
      }

      rows.push({
        id: emp.id,
        employeeFirstName: emp.employeeFirstName || '',
        employeeLastName: emp.employeeLastName || '',
        branchesID: emp.branchesID!,
        departmentNameID: emp.departmentNameID,
        inTime,
        outTime,
        statusType: status.type,
        statusLabel: status.label,
        statusDisplay: statusDisplayLabel(status.type, status.label),
        hasPunches: status.hasPunches,
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
