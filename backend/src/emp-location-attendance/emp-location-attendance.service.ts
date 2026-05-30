import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceLocationDto } from './dto/create-attendance-location.dto';
import { MarkAbsentDto } from './dto/mark-absent.dto';

const VALID_TYPES = ['CHECK_IN', 'CHECK_OUT', 'BREAK_IN', 'BREAK_OUT'] as const;
type PunchType = (typeof VALID_TYPES)[number];

@Injectable()
export class EmpLocationAttendanceService {
  constructor(private prisma: PrismaService) {}

  private dayWindow(now = new Date()) {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { startOfDay, endOfDay };
  }

  private getLastPunch(records: { checkType: string; checkinTime: Date }[]) {
    if (!records.length) return null;
    return [...records].sort((a, b) => a.checkinTime.getTime() - b.checkinTime.getTime()).at(-1)!;
  }

  private getPunchState(lastType: string | null): 'OUT' | 'IN' | 'ON_BREAK' {
    if (!lastType || lastType === 'CHECK_OUT') return 'OUT';
    if (lastType === 'CHECK_IN' || lastType === 'BREAK_OUT') return 'IN';
    if (lastType === 'BREAK_IN') return 'ON_BREAK';
    return 'OUT';
  }

  private validatePunch(lastType: string | null, checkType: PunchType) {
    const state = this.getPunchState(lastType);

    if (checkType === 'CHECK_IN') {
      if (state !== 'OUT') {
        throw new BadRequestException('You must check out before checking in again.');
      }
      return;
    }

    if (checkType === 'CHECK_OUT') {
      if (state === 'OUT') {
        throw new BadRequestException('You must check in before checking out.');
      }
      if (state === 'ON_BREAK') {
        throw new BadRequestException('Please end your break before checking out.');
      }
      return;
    }

    if (checkType === 'BREAK_IN') {
      if (state !== 'IN') {
        throw new BadRequestException('You must be checked in to start a break.');
      }
      return;
    }

    if (checkType === 'BREAK_OUT') {
      if (state !== 'ON_BREAK') {
        throw new BadRequestException('No active break to end.');
      }
    }
  }

  private computeMinutes(records: { checkType: string; checkinTime: Date }[], now = new Date()) {
    const sorted = [...records].sort((a, b) => a.checkinTime.getTime() - b.checkinTime.getTime());
    let workMs = 0;
    let breakMs = 0;
    let workStart: Date | null = null;
    let breakStart: Date | null = null;

    for (const rec of sorted) {
      const t = rec.checkinTime;

      if (rec.checkType === 'CHECK_IN') {
        workStart = t;
      } else if (rec.checkType === 'BREAK_IN') {
        if (workStart) {
          workMs += t.getTime() - workStart.getTime();
        }
        workStart = null;
        breakStart = t;
      } else if (rec.checkType === 'BREAK_OUT') {
        if (breakStart) {
          breakMs += t.getTime() - breakStart.getTime();
        }
        breakStart = null;
        workStart = t;
      } else if (rec.checkType === 'CHECK_OUT') {
        if (workStart) {
          workMs += t.getTime() - workStart.getTime();
        }
        workStart = null;
        breakStart = null;
      }
    }

    const state = this.getPunchState(sorted.at(-1)?.checkType ?? null);
    if (state === 'IN' && workStart) {
      workMs += now.getTime() - workStart.getTime();
    }
    if (state === 'ON_BREAK' && breakStart) {
      breakMs += now.getTime() - breakStart.getTime();
    }

    return {
      workMinutes: Math.max(0, Math.round(workMs / 60000)),
      breakMinutes: Math.max(0, Math.round(breakMs / 60000)),
      workSeconds: Math.max(0, Math.round(workMs / 1000)),
      breakSeconds: Math.max(0, Math.round(breakMs / 1000)),
    };
  }

  async checkIn(employeeId: number, dto: CreateAttendanceLocationDto, ipAddress: string) {
    if (!VALID_TYPES.includes(dto.checkType as PunchType)) {
      throw new BadRequestException('checkType must be CHECK_IN, CHECK_OUT, BREAK_IN, or BREAK_OUT');
    }

    const now = new Date();
    const { startOfDay, endOfDay } = this.dayWindow(now);

    const todayRecords = await this.prisma.attendanceLocation.findMany({
      where: {
        employeeId,
        checkinTime: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { checkinTime: 'asc' },
    });

    const lastPunch = this.getLastPunch(todayRecords);
    this.validatePunch(lastPunch?.checkType ?? null, dto.checkType as PunchType);

    const employee = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: {
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        company: { select: { companyName: true } },
        branches: { select: { branchName: true } },
        departments: { select: { departmentName: true } },
      },
    });

    const record = await this.prisma.attendanceLocation.create({
      data: {
        employeeId,
        checkType: dto.checkType,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy ?? null,
        ipAddress,
        deviceType: dto.deviceType ?? null,
        browser: dto.browser ?? null,
        operatingSystem: dto.operatingSystem ?? null,
        userAgent: dto.userAgent ?? null,
      },
    });

    try {
      const fullName = [employee?.employeeFirstName, employee?.employeeLastName]
        .filter(Boolean)
        .join(' ') || String(employeeId);

      await this.prisma.process_att_logs.create({
        data: {
          device_sn: 'LOCATION_APP',
          user_id: employee?.employeeID ?? String(employeeId),
          username: fullName,
          punch_time: record.checkinTime,
          company_name: employee?.company?.companyName ?? null,
          branch_name: employee?.branches?.branchName ?? null,
          department_name: employee?.departments?.departmentName ?? null,
          device_emp_code: employee?.employeeID ?? null,
          manage_employee_id: employeeId,
          device_id: null,
          raw_body: JSON.stringify({
            source: 'location_attendance',
            checkType: dto.checkType,
            latitude: dto.latitude,
            longitude: dto.longitude,
            accuracy: dto.accuracy ?? null,
            ipAddress,
          }),
          status: '0',
          device_name: 'Location Attendance App',
          device_type: dto.deviceType ?? null,
          auth_type: 'GPS',
        },
      });
    } catch {
      // Non-critical
    }

    return record;
  }

  async getMyRecords(
    employeeId: number,
    opts?: { from?: Date; to?: Date; limit?: number },
  ) {
    const where: { employeeId: number; checkinTime?: { gte?: Date; lte?: Date } } = {
      employeeId,
    };
    if (opts?.from || opts?.to) {
      where.checkinTime = {};
      if (opts.from) where.checkinTime.gte = opts.from;
      if (opts.to) where.checkinTime.lte = opts.to;
    }
    return this.prisma.attendanceLocation.findMany({
      where,
      orderBy: { checkinTime: 'desc' },
      take: opts?.limit ?? 500,
    });
  }

  async getTodayStatus(employeeId: number) {
    const now = new Date();
    const { startOfDay, endOfDay } = this.dayWindow(now);

    const records = await this.prisma.attendanceLocation.findMany({
      where: {
        employeeId,
        checkinTime: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { checkinTime: 'asc' },
    });

    const checkIns = records.filter((r) => r.checkType === 'CHECK_IN');
    const checkOuts = records.filter((r) => r.checkType === 'CHECK_OUT');
    const checkIn = checkIns[0] ?? null;
    const checkOut = checkOuts.at(-1) ?? null;
    const lastPunch = this.getLastPunch(records);
    const punchState = this.getPunchState(lastPunch?.checkType ?? null);
    const { workMinutes, breakMinutes, workSeconds, breakSeconds } = this.computeMinutes(records, now);

    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const absentDeclaration = await this.prisma.empAbsentDeclaration.findUnique({
      where: {
        employeeId_absentDate: { employeeId, absentDate: todayDate },
      },
    });

    const hasPunches = records.length > 0;
    const isAbsentToday = !!absentDeclaration;

    return {
      isCheckedIn: punchState === 'IN' || punchState === 'ON_BREAK',
      isCheckedOut: punchState === 'OUT' && checkOuts.length > 0,
      isAbsentToday,
      absentDeclaration,
      punchState,
      canCheckIn: punchState === 'OUT' && !isAbsentToday,
      canCheckOut: punchState === 'IN',
      canBreakIn: punchState === 'IN',
      canBreakOut: punchState === 'ON_BREAK',
      canMarkAbsent: !hasPunches && !isAbsentToday && punchState === 'OUT',
      checkIn,
      checkOut,
      lastPunch,
      allToday: records,
      workMinutes,
      breakMinutes,
      workSeconds,
      breakSeconds,
      sessionCount: checkIns.length,
    };
  }

  async markAbsent(employeeId: number, dto: MarkAbsentDto) {
    const now = new Date();
    const { startOfDay, endOfDay } = this.dayWindow(now);
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const existingPunches = await this.prisma.attendanceLocation.count({
      where: { employeeId, checkinTime: { gte: startOfDay, lte: endOfDay } },
    });
    if (existingPunches > 0) {
      throw new BadRequestException('Cannot mark absent after attendance has been recorded today.');
    }

    const existingAbsent = await this.prisma.empAbsentDeclaration.findUnique({
      where: { employeeId_absentDate: { employeeId, absentDate: todayDate } },
    });
    if (existingAbsent) {
      throw new BadRequestException('You have already marked absent for today.');
    }

    const employee = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: { serviceProviderID: true, companyID: true, branchesID: true },
    });
    if (!employee) throw new BadRequestException('Employee not found');

    const dateStr = todayDate.toISOString().slice(0, 10);
    const leaveApp = await this.prisma.leaveApplication.create({
      data: {
        serviceProviderID: employee.serviceProviderID ?? undefined,
        companyID: employee.companyID ?? undefined,
        branchesID: employee.branchesID ?? undefined,
        manageEmployeeID: employeeId,
        appliedLeaveType: null,
        fromDate: new Date(dateStr),
        toDate: new Date(dateStr),
        purpose: `[Absent – emergency] ${dto.reason}`,
        status: 'Pending',
        dayStatuses: JSON.stringify([{ date: dateStr, status: 'absent' }]),
      },
    });

    const declaration = await this.prisma.empAbsentDeclaration.create({
      data: {
        employeeId,
        absentDate: todayDate,
        reason: dto.reason,
        leaveType: '',
        leaveApplicationId: leaveApp.id,
      },
    });

    return { declaration, leaveApplication: leaveApp };
  }
}
