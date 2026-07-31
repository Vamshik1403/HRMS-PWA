import { Injectable, BadRequestException } from '@nestjs/common';
import { wallClockInZoneToStorageDate } from '../common/device-punch-time';
import { reverseGeocode } from '../common/reverse-geocode';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceLocationDto } from './dto/create-attendance-location.dto';
import { MarkAbsentDto } from './dto/mark-absent.dto';
import {
  computePwaDayDurations,
  getEffectiveDisplayPunches,
} from './pwa-punch-metrics.util';

const VALID_TYPES = ['CHECK_IN', 'CHECK_OUT', 'BREAK_IN', 'BREAK_OUT'] as const;
type PunchType = (typeof VALID_TYPES)[number];

@Injectable()
export class EmpLocationAttendanceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Day bounds in app wall-clock storage (aligned with PWA punch times).
   * @param wallClockNow Already-normalized storage time from wallClockInZoneToStorageDate().
   * Do not pass a raw UTC instant here — dayWindow reads UTC field components as wall clock.
   */
  private dayWindow(wallClockNow: Date = wallClockInZoneToStorageDate()) {
    const y = wallClockNow.getUTCFullYear();
    const m = wallClockNow.getUTCMonth();
    const d = wallClockNow.getUTCDate();
    return {
      startOfDay: new Date(Date.UTC(y, m, d, 0, 0, 0, 0)),
      endOfDay: new Date(Date.UTC(y, m, d, 23, 59, 59, 999)),
    };
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

  /** True when the employee still has an open work session (checked in, not yet out). */
  private hasOpenWorkSession(records: { checkType: string; checkinTime?: Date }[]): boolean {
    const dated = records.filter((r): r is { checkType: string; checkinTime: Date } => !!r.checkinTime);
    const last = this.getLastPunch(dated);
    if (!last) return false;
    const state = this.getPunchState(last.checkType);
    return state === 'IN' || state === 'ON_BREAK';
  }

  private validatePunch(
    lastType: string | null,
    checkType: PunchType,
    todayRecords: { checkType: string; checkinTime?: Date }[],
  ) {
    const state = this.getPunchState(lastType);

    if (checkType === 'CHECK_IN') {
      if (this.hasOpenWorkSession(todayRecords)) {
        throw new BadRequestException(
          'You are already checked in. Please mark OUT before checking in again.',
        );
      }
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
    return computePwaDayDurations(records, now);
  }

  /**
   * Returns today's device-punch times from process_att_logs (sorted ascending).
   * Device punches have no checkType — treated as alternating IN/OUT.
   */
  private async todayDevicePunchTimes(
    employeeId: number,
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<Date[]> {
    const logs = await this.prisma.process_att_logs.findMany({
      where: {
        manage_employee_id: employeeId,
        device_sn: { not: 'LOCATION_APP' },
        punch_time: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { punch_time: 'asc' },
      select: { punch_time: true },
    });
    return logs.filter((l) => l.punch_time != null).map((l) => l.punch_time as Date);
  }

  /**
   * Derive effective check state from device punches only.
   * Device punches alternate IN/OUT by position (1st=IN, 2nd=OUT, ...).
   */
  private devicePunchState(times: Date[]): 'IN' | 'OUT' {
    // odd count = currently IN, even = OUT
    return times.length % 2 === 1 ? 'IN' : 'OUT';
  }

  async checkIn(employeeId: number, dto: CreateAttendanceLocationDto, ipAddress: string) {
    if (!VALID_TYPES.includes(dto.checkType as PunchType)) {
      throw new BadRequestException('checkType must be CHECK_IN, CHECK_OUT, BREAK_IN, or BREAK_OUT');
    }

    // PWA / location-app punches: enable mobile attendance on first use so portal
    // employees are not blocked by the default (false) flag in admin setup.
    const eligibility = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: { mobileAttendanceEnabled: true },
    });
    if (!eligibility?.mobileAttendanceEnabled) {
      await this.prisma.manageEmployee.update({
        where: { id: employeeId },
        data: { mobileAttendanceEnabled: true },
      });
    }

    const now = wallClockInZoneToStorageDate();
    const { startOfDay, endOfDay } = this.dayWindow(now);

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

    // Resolve a human-readable address from the GPS coordinates. Cached and
    // time-boxed so it never blocks the punch; falls back to null on failure.
    const address = await reverseGeocode(dto.latitude, dto.longitude);

    const record = await this.prisma.$transaction(async (tx) => {
      const todayRecords = await tx.attendanceLocation.findMany({
        where: {
          employeeId,
          checkinTime: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { checkinTime: 'asc' },
      });

      let effectiveLastType: string | null = null;
      if (todayRecords.length === 0) {
        const deviceTimes = await tx.process_att_logs.findMany({
          where: {
            manage_employee_id: employeeId,
            device_sn: { not: 'LOCATION_APP' },
            punch_time: { gte: startOfDay, lte: endOfDay },
          },
          orderBy: { punch_time: 'asc' },
          select: { punch_time: true },
        });
        const times = deviceTimes
          .filter((l) => l.punch_time != null)
          .map((l) => l.punch_time as Date);
        if (this.devicePunchState(times) === 'IN') {
          effectiveLastType = 'CHECK_IN';
        }
      } else {
        effectiveLastType = this.getLastPunch(todayRecords)?.checkType ?? null;
      }

      this.validatePunch(effectiveLastType, dto.checkType as PunchType, todayRecords);

      const created = await tx.attendanceLocation.create({
        data: {
          employeeId,
          checkType: dto.checkType,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracy: dto.accuracy ?? null,
          address,
          ipAddress,
          deviceType: dto.deviceType ?? null,
          browser: dto.browser ?? null,
          operatingSystem: dto.operatingSystem ?? null,
          userAgent: dto.userAgent ?? null,
          checkinTime: now,
        },
      });

      try {
        const fullName = [employee?.employeeFirstName, employee?.employeeLastName]
          .filter(Boolean)
          .join(' ') || String(employeeId);

        const checkType = dto.checkType as PunchType;
        const shouldWrite = checkType !== 'BREAK_IN' && checkType !== 'BREAK_OUT';

        if (shouldWrite) {
          if (checkType === 'CHECK_OUT') {
            await tx.process_att_logs.create({
            data: {
              device_sn: 'LOCATION_APP',
              user_id: employee?.employeeID ?? String(employeeId),
              username: fullName,
              punch_time: created.checkinTime,
              company_name: employee?.company?.companyName ?? null,
              branch_name: employee?.branches?.branchName ?? null,
              department_name: employee?.departments?.departmentName ?? null,
              device_emp_code: employee?.employeeID ?? null,
              manage_employee_id: employeeId,
              device_id: null,
              raw_body: JSON.stringify({ source: 'location_attendance', checkType, latitude: dto.latitude, longitude: dto.longitude, accuracy: dto.accuracy ?? null, address, ipAddress }),
              status: '0',
              device_name: 'Location Attendance App',
              device_type: dto.deviceType ?? null,
              auth_type: 'GPS',
            },
          });
          } else if (checkType === 'CHECK_IN') {
            const alreadyCheckedInToday = todayRecords.some((r) => r.checkType === 'CHECK_IN');
            const existingInMirror = await tx.process_att_logs.count({
              where: {
                manage_employee_id: employeeId,
                device_sn: 'LOCATION_APP',
                punch_time: { gte: startOfDay, lte: endOfDay },
              },
            });

            if (!alreadyCheckedInToday && existingInMirror === 0) {
              await tx.process_att_logs.create({
              data: {
                device_sn: 'LOCATION_APP',
                user_id: employee?.employeeID ?? String(employeeId),
                username: fullName,
                punch_time: created.checkinTime,
                company_name: employee?.company?.companyName ?? null,
                branch_name: employee?.branches?.branchName ?? null,
                department_name: employee?.departments?.departmentName ?? null,
                device_emp_code: employee?.employeeID ?? null,
                manage_employee_id: employeeId,
                device_id: null,
                raw_body: JSON.stringify({ source: 'location_attendance', checkType, latitude: dto.latitude, longitude: dto.longitude, accuracy: dto.accuracy ?? null, address, ipAddress }),
                status: '0',
                device_name: 'Location Attendance App',
                device_type: dto.deviceType ?? null,
                auth_type: 'GPS',
              },
            });
            }
          }
        }
      } catch {
        // Non-critical
      }

      return created;
    });

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
    const empFlags = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: { mobileBreakEnabled: true, mobileAttendanceEnabled: true },
    });
    const breakEnabled = empFlags?.mobileBreakEnabled !== false;
    const mobileAttendanceEnabled = empFlags?.mobileAttendanceEnabled === true;

    const now = wallClockInZoneToStorageDate();
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
    const { firstIn, lastOut } = getEffectiveDisplayPunches(records);

    // Merge device-punch state when no PWA punches exist yet today
    let deviceCheckIn: { checkinTime: Date } | null = null;
    let deviceCheckOut: { checkinTime: Date } | null = null;
    let deviceCheckedIn = false;
    if (records.length === 0) {
      const deviceTimes = await this.todayDevicePunchTimes(employeeId, startOfDay, endOfDay);
      if (deviceTimes.length > 0) {
        deviceCheckedIn = this.devicePunchState(deviceTimes) === 'IN';
        deviceCheckIn = { checkinTime: deviceTimes[0] };
        if (deviceTimes.length > 1 && !deviceCheckedIn) {
          deviceCheckOut = { checkinTime: deviceTimes[deviceTimes.length - 1] };
        }
      }
    }

    const checkIn = firstIn ?? (deviceCheckIn as typeof checkIns[0] | null);
    const checkOut = lastOut ?? (deviceCheckOut as typeof checkOuts[0] | null);
    const lastPunch = this.getLastPunch(records);
    const punchState = records.length > 0
      ? this.getPunchState(lastPunch?.checkType ?? null)
      : (deviceCheckedIn ? 'IN' : 'OUT');
    const { workMinutes, breakMinutes, workSeconds, breakSeconds } = this.computeMinutes(records, now);

    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const absentDeclaration = await this.prisma.empAbsentDeclaration.findUnique({
      where: {
        employeeId_absentDate: { employeeId, absentDate: todayDate },
      },
    });

    const hasPunches = records.length > 0 || deviceCheckedIn;
    const isAbsentToday = !!absentDeclaration;

    return {
      isCheckedIn: punchState === 'IN' || punchState === 'ON_BREAK',
      isCheckedOut: punchState === 'OUT' && checkOuts.length > 0,
      isAbsentToday,
      absentDeclaration,
      punchState,
      canCheckIn: punchState === 'OUT' && !isAbsentToday,
      canCheckOut: punchState === 'IN',
      mobileAttendanceEnabled,
      mobileBreakEnabled: breakEnabled,
      canBreakIn: breakEnabled && punchState === 'IN',
      canBreakOut: breakEnabled && punchState === 'ON_BREAK',
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
      deviceCheckedIn,
    };
  }

  async markAbsent(employeeId: number, dto: MarkAbsentDto) {
    const now = wallClockInZoneToStorageDate();
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
