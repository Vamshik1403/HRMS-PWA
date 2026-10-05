import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { wallClockInZoneToStorageDate } from '../common/device-punch-time';
import { reverseGeocode } from '../common/reverse-geocode';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceLocationDto } from './dto/create-attendance-location.dto';
import { MarkAbsentDto } from './dto/mark-absent.dto';
import {
  computePwaDayDurations,
  getEffectiveDisplayPunches,
} from './pwa-punch-metrics.util';
import {
  assertWithinFence,
  composeAddressParts,
  fenceRadiusWithAccuracy,
  isClosedTaskStatus,
  normalizePhotoUrl,
  parseRadiusMeters,
  resolveCoords,
  taskActiveOnDate,
  wallDateKey,
  type FencePoint,
  type SessionFence,
} from './emp-punch-geofence';

const VALID_TYPES = ['CHECK_IN', 'CHECK_OUT', 'BREAK_IN', 'BREAK_OUT'] as const;
type PunchType = (typeof VALID_TYPES)[number];

const BRANCH_FENCE_SELECT = {
  id: true,
  geofenchradius: true,
  latitude: true,
  longitude: true,
  address: true,
  city: true,
  state: true,
  pincode: true,
  country: true,
} as const;

type BranchFenceRow = {
  id: number;
  geofenchradius?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
};

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
      return;
    }

    if (checkType === 'BREAK_IN') {
      throw new BadRequestException('Break is not available.');
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

  private async persistEmptyCoords(
    kind: 'branch' | 'site' | 'employee',
    id: number,
    lat: number,
    lng: number,
  ) {
    try {
      if (kind === 'branch') {
        await this.prisma.branches.update({
          where: { id },
          data: { latitude: String(lat), longitude: String(lng) },
        });
      } else if (kind === 'site') {
        await this.prisma.taskCustomerSite.update({
          where: { id },
          data: { latitude: String(lat), longitude: String(lng) },
        });
      } else {
        await this.prisma.manageEmployee.update({
          where: { id },
          data: { wfhHomeLatitude: lat, wfhHomeLongitude: lng },
        });
      }
    } catch {
      // Non-critical — punch can proceed with in-memory coords.
    }
  }

  private async tryOfficeFencePoint(branch: BranchFenceRow | null): Promise<FencePoint | null> {
    if (!branch) return null;
    const resolved = await resolveCoords({
      latitude: branch.latitude,
      longitude: branch.longitude,
      address: composeAddressParts(
        branch.address,
        branch.city,
        branch.state,
        branch.pincode,
        branch.country,
      ),
    });
    if (!resolved) return null;
    if (resolved.fromGeocode) {
      await this.persistEmptyCoords('branch', branch.id, resolved.lat, resolved.lng);
    }
    return { lat: resolved.lat, lng: resolved.lng, type: 'OFFICE' };
  }

  private pickFenceRadius(
    branches: Array<BranchFenceRow | null | undefined>,
    accuracy?: number | null,
  ): number {
    let base: number | null = null;
    for (const branch of branches) {
      const radius = parseRadiusMeters(branch?.geofenchradius);
      if (radius != null) {
        base = radius;
        break;
      }
    }
    if (base == null) {
      throw new BadRequestException(
        'Geofence radius is not set for your branch. Ask admin to set Geofence Radius (meters) in My Company → Branches.',
      );
    }
    return fenceRadiusWithAccuracy(base, accuracy);
  }

  private async companyOfficeFencePoints(opts: {
    companyID?: number | null;
    assignedBranch: BranchFenceRow | null;
    empBranch: BranchFenceRow | null;
  }): Promise<{ points: FencePoint[]; branches: BranchFenceRow[] }> {
    const byId = new Map<number, BranchFenceRow>();
    if (opts.assignedBranch) byId.set(opts.assignedBranch.id, opts.assignedBranch);
    if (opts.empBranch) byId.set(opts.empBranch.id, opts.empBranch);
    if (opts.companyID) {
      const companyBranches = await this.prisma.branches.findMany({
        where: { companyID: opts.companyID },
        select: BRANCH_FENCE_SELECT,
      });
      for (const branch of companyBranches) byId.set(branch.id, branch);
    }
    const branches = [...byId.values()];
    const points: FencePoint[] = [];
    const seen = new Set<string>();
    for (const branch of branches) {
      const point = await this.tryOfficeFencePoint(branch);
      if (!point) continue;
      const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      points.push(point);
    }
    return { points, branches };
  }

  private async homeFencePoint(
    employee: {
      id: number;
      wfhAllowed?: boolean | null;
      wfhHomeAddress?: string | null;
      wfhHomeLatitude?: number | null;
      wfhHomeLongitude?: number | null;
    },
    required: boolean,
  ): Promise<FencePoint | null> {
    if (!employee.wfhAllowed) {
      if (required) {
        throw new BadRequestException(
          'Home address is not set. Ask admin to set the work-from-home address.',
        );
      }
      return null;
    }
    const resolved = await resolveCoords({
      latitude: employee.wfhHomeLatitude,
      longitude: employee.wfhHomeLongitude,
      address: employee.wfhHomeAddress,
    });
    if (!resolved) {
      if (required) {
        throw new BadRequestException(
          'Home address is not set. Ask admin to set the work-from-home address.',
        );
      }
      return null;
    }
    if (resolved.fromGeocode) {
      await this.persistEmptyCoords('employee', employee.id, resolved.lat, resolved.lng);
    }
    return { lat: resolved.lat, lng: resolved.lng, type: 'HOME' };
  }

  private async siteFencePoints(employeeId: number, todayKey: string): Promise<FencePoint[]> {
    const tasks = await this.prisma.taskProject.findMany({
      where: {
        isDeleted: false,
        OR: [
          { assignments: { some: { manageEmployeeID: employeeId } } },
          { engineerAssignments: { some: { manageEmployeeID: employeeId } } },
        ],
      },
      select: {
        status: true,
        scheduleDateTime: true,
        dueDateTime: true,
        site: {
          select: {
            id: true,
            latitude: true,
            longitude: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
            country: true,
          },
        },
        assignments: {
          where: { manageEmployeeID: employeeId },
          select: { assignedAt: true },
        },
        engineerAssignments: {
          where: { manageEmployeeID: employeeId },
          select: { assignedDate: true, createdAt: true },
        },
      },
    });

    const points: FencePoint[] = [];
    const seen = new Set<number>();
    for (const task of tasks) {
      if (isClosedTaskStatus(task.status)) continue;
      const assignedDates = [
        ...task.assignments.map((a) => a.assignedAt),
        ...task.engineerAssignments.map((a) => a.assignedDate ?? a.createdAt),
      ];
      if (
        !taskActiveOnDate({
          todayKey,
          scheduleDateTime: task.scheduleDateTime,
          dueDateTime: task.dueDateTime,
          assignedDates,
        })
      ) {
        continue;
      }
      const site = task.site;
      if (!site || seen.has(site.id)) continue;
      seen.add(site.id);
      const resolved = await resolveCoords({
        latitude: site.latitude,
        longitude: site.longitude,
        address: composeAddressParts(
          site.address,
          site.city,
          site.state,
          site.pincode,
          site.country,
        ),
      });
      if (!resolved) continue;
      if (resolved.fromGeocode) {
        await this.persistEmptyCoords('site', site.id, resolved.lat, resolved.lng);
      }
      points.push({
        lat: resolved.lat,
        lng: resolved.lng,
        type: 'SITE',
        siteId: site.id,
      });
    }
    return points;
  }

  private async resolvePunchFence(opts: {
    employeeId: number;
    todayKey: string;
    companyID?: number | null;
    accuracy?: number | null;
    branch: BranchFenceRow | null;
    empBranch: BranchFenceRow | null;
    wfhAllowed?: boolean | null;
    wfhHomeAddress?: string | null;
    wfhHomeLatitude?: number | null;
    wfhHomeLongitude?: number | null;
  }): Promise<{ radiusMeters: number; points: FencePoint[]; session: SessionFence }> {
    const offices = await this.companyOfficeFencePoints({
      companyID: opts.companyID,
      assignedBranch: opts.branch,
      empBranch: opts.empBranch,
    });
    const radiusMeters = this.pickFenceRadius(
      [opts.branch, opts.empBranch, ...offices.branches],
      opts.accuracy,
    );

    const points: FencePoint[] = [...offices.points];
    const home = await this.homeFencePoint(
      {
        id: opts.employeeId,
        wfhAllowed: opts.wfhAllowed,
        wfhHomeAddress: opts.wfhHomeAddress,
        wfhHomeLatitude: opts.wfhHomeLatitude,
        wfhHomeLongitude: opts.wfhHomeLongitude,
      },
      false,
    );
    if (home) points.push(home);

    const sitePoints = await this.siteFencePoints(opts.employeeId, opts.todayKey);
    points.push(...sitePoints);

    if (!points.length) {
      throw new BadRequestException(
        'No allowed punch location is configured. Ask admin to set office, home, or site coordinates.',
      );
    }

    const session: SessionFence = offices.points.length
      ? { type: 'OFFICE' }
      : home
        ? { type: 'HOME' }
        : { type: 'SITE', siteId: sitePoints[0]?.siteId };
    return { radiusMeters, points, session };
  }

  async checkIn(employeeId: number, dto: CreateAttendanceLocationDto, ipAddress: string) {
    if (!VALID_TYPES.includes(dto.checkType as PunchType)) {
      throw new BadRequestException('checkType must be CHECK_IN, CHECK_OUT, BREAK_IN, or BREAK_OUT');
    }

    const checkType = dto.checkType as PunchType;
    const employee = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: {
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        mobileAttendanceEnabled: true,
        photoPunchEnabled: true,
        wfhAllowed: true,
        wfhHomeAddress: true,
        wfhHomeLatitude: true,
        wfhHomeLongitude: true,
        companyID: true,
        company: { select: { companyName: true } },
        departments: { select: { departmentName: true } },
        branches: {
          select: {
            ...BRANCH_FENCE_SELECT,
            branchName: true,
          },
        },
        empBranch: {
          orderBy: { id: 'desc' },
          take: 1,
          select: {
            branchesID: true,
            branch: { select: BRANCH_FENCE_SELECT },
          },
        },
      },
    });
    if (!employee?.mobileAttendanceEnabled) {
      throw new ForbiddenException(
        'Mobile app attendance is not enabled. Please mark IN/OUT on your attendance device.',
      );
    }

    const photoPunchEnabled = employee.photoPunchEnabled === true;
    const photoUrl =
      photoPunchEnabled && (checkType === 'CHECK_IN' || checkType === 'CHECK_OUT')
        ? normalizePhotoUrl(dto.photoUrl)
        : null;
    if (photoPunchEnabled && (checkType === 'CHECK_IN' || checkType === 'CHECK_OUT') && !photoUrl) {
      throw new BadRequestException('A photo is required to mark IN or OUT.');
    }

    const now = wallClockInZoneToStorageDate();
    const { startOfDay, endOfDay } = this.dayWindow(now);
    const todayKey = wallDateKey(now);

    const todayPreview = await this.prisma.attendanceLocation.findMany({
      where: {
        employeeId,
        checkinTime: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { checkinTime: 'asc' },
    });

    let sessionFence: SessionFence | null = null;
    if (photoPunchEnabled && (checkType === 'CHECK_IN' || checkType === 'CHECK_OUT')) {
      const fence = await this.resolvePunchFence({
        employeeId,
        todayKey,
        companyID: employee.companyID,
        accuracy: dto.accuracy,
        branch: employee.branches,
        empBranch: employee.empBranch[0]?.branch ?? null,
        wfhAllowed: employee.wfhAllowed,
        wfhHomeAddress: employee.wfhHomeAddress,
        wfhHomeLatitude: employee.wfhHomeLatitude,
        wfhHomeLongitude: employee.wfhHomeLongitude,
      });
      const matched = assertWithinFence(
        dto.latitude,
        dto.longitude,
        fence.points,
        fence.radiusMeters,
      );
      sessionFence = {
        type: matched.type,
        siteId: matched.siteId ?? fence.session.siteId ?? null,
      };
    }

    const address = await reverseGeocode(dto.latitude, dto.longitude);
    const rawBody = JSON.stringify({
      source: 'location_attendance',
      checkType,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy ?? null,
      address,
      ipAddress,
      photoUrl,
      fenceType: sessionFence?.type ?? null,
      fenceSiteId: sessionFence?.siteId ?? null,
    });

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

      this.validatePunch(effectiveLastType, checkType, todayRecords);

      const created = await tx.attendanceLocation.create({
        data: {
          employeeId,
          checkType,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracy: dto.accuracy ?? null,
          address,
          ipAddress,
          deviceType: dto.deviceType ?? null,
          browser: dto.browser ?? null,
          operatingSystem: dto.operatingSystem ?? null,
          userAgent: dto.userAgent ?? null,
          photoUrl,
          fenceType: sessionFence?.type ?? null,
          fenceSiteId: sessionFence?.siteId ?? null,
          checkinTime: now,
        },
      });

      try {
        const fullName = [employee?.employeeFirstName, employee?.employeeLastName]
          .filter(Boolean)
          .join(' ') || String(employeeId);
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
                raw_body: rawBody,
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
                  raw_body: rawBody,
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

  /**
   * Display-only: for days with no GPS CHECK_IN/CHECK_OUT, synthesize records
   * from biometric process_att_logs so the Attendance tab matches reports.
   */
  async mergeDevicePunchesIntoRecords<T extends {
    id: number;
    checkType: string;
    checkinTime: Date;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }>(
    employeeId: number,
    from: Date | undefined,
    to: Date | undefined,
    records: T[],
  ): Promise<T[]> {
    const punchTime =
      from || to
        ? {
            punch_time: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {};

    const logSelect = {
      id: true,
      punch_time: true,
      device_sn: true,
      device_id: true,
    } as const;

    const notLocationApp = {
      OR: [{ device_sn: null }, { device_sn: { not: 'LOCATION_APP' } }],
    };

    let logs = await this.prisma.process_att_logs.findMany({
      where: {
        manage_employee_id: employeeId,
        AND: [notLocationApp],
        ...punchTime,
      },
      orderBy: { punch_time: 'asc' },
      select: logSelect,
    });

    if (!logs.length) {
      const emp = await this.prisma.manageEmployee.findUnique({
        where: { id: employeeId },
        select: { employeeID: true },
      });
      const code = emp?.employeeID?.trim();
      if (code) {
        logs = await this.prisma.process_att_logs.findMany({
          where: {
            AND: [notLocationApp],
            OR: [{ user_id: code }, { device_emp_code: code }],
            ...punchTime,
          },
          orderBy: { punch_time: 'asc' },
          select: logSelect,
        });
      }
    }

    if (!logs.length) return records;

    const gpsDays = new Set<string>();
    for (const r of records) {
      if (r.checkType !== 'CHECK_IN' && r.checkType !== 'CHECK_OUT') continue;
      gpsDays.add(this.punchDateKey(r.checkinTime));
    }

    const byDay = new Map<string, typeof logs>();
    for (const log of logs) {
      if (!log.punch_time) continue;
      const key = this.punchDateKey(log.punch_time);
      if (gpsDays.has(key)) continue;
      const arr = byDay.get(key) ?? [];
      arr.push(log);
      byDay.set(key, arr);
    }
    if (byDay.size === 0) return records;

    const deviceSnSet = new Set<string>();
    const deviceIdSet = new Set<number>();
    for (const dayLogs of byDay.values()) {
      for (const log of dayLogs) {
        if (log.device_sn) deviceSnSet.add(log.device_sn);
        if (log.device_id != null) deviceIdSet.add(log.device_id);
      }
    }
    const deviceLocOr: { id?: { in: number[] }; deviceSN?: { in: string[] } }[] = [];
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
    const latLngByDeviceId = new Map<number, { latitude: number | null; longitude: number | null }>();
    const latLngByDeviceSn = new Map<string, { latitude: number | null; longitude: number | null }>();
    for (const d of deviceRows) {
      const addr = d.address?.trim() || null;
      addressByDeviceId.set(d.id, addr);
      addressByDeviceSn.set(d.deviceSN, addr);
      latLngByDeviceId.set(d.id, { latitude: d.latitude, longitude: d.longitude });
      latLngByDeviceSn.set(d.deviceSN, { latitude: d.latitude, longitude: d.longitude });
    }

    const synthesized: T[] = [];
    for (const dayLogs of byDay.values()) {
      const sorted = [...dayLogs].sort(
        (a, b) => (a.punch_time?.getTime() ?? 0) - (b.punch_time?.getTime() ?? 0),
      );
      sorted.forEach((log, index) => {
        if (!log.punch_time) return;
        const checkType = index % 2 === 0 ? 'CHECK_IN' : 'CHECK_OUT';
        const address =
          (log.device_id != null ? addressByDeviceId.get(log.device_id) : null) ??
          (log.device_sn ? addressByDeviceSn.get(log.device_sn) : null) ??
          null;
        const coords =
          (log.device_id != null ? latLngByDeviceId.get(log.device_id) : null) ??
          (log.device_sn ? latLngByDeviceSn.get(log.device_sn) : null);
        synthesized.push({
          id: -log.id,
          employeeId,
          checkType,
          checkinTime: log.punch_time,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          accuracy: null,
          address,
          ipAddress: null,
          deviceType: null,
          browser: null,
          operatingSystem: null,
          userAgent: null,
          companyID: null,
          branchesID: null,
          serviceProviderID: null,
          createdAt: log.punch_time,
          updatedAt: log.punch_time,
        } as unknown as T);
      });
    }

    return [...records, ...synthesized].sort(
      (a, b) => b.checkinTime.getTime() - a.checkinTime.getTime(),
    );
  }

  /** Fill missing GPS addresses from process_att_logs + device location (same source as today-overview). */
  async enrichAddressesFromProcessLogs<T extends {
    checkType: string;
    checkinTime: Date;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }>(
    employeeId: number,
    from: Date | undefined,
    to: Date | undefined,
    records: T[],
  ): Promise<T[]> {
    if (!records.length) return records;
    const needsFill = records.some((r) => !String(r.address || '').trim());
    if (!needsFill) return records;

    const logs = await this.prisma.process_att_logs.findMany({
      where: {
        manage_employee_id: employeeId,
        ...(from || to
          ? {
              punch_time: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      select: {
        punch_time: true,
        device_sn: true,
        device_id: true,
        raw_body: true,
      },
      orderBy: { punch_time: 'asc' },
    });
    if (!logs.length) return records;

    const deviceSnSet = new Set<string>();
    const deviceIdSet = new Set<number>();
    for (const log of logs) {
      if (log.device_sn && log.device_sn !== 'LOCATION_APP') deviceSnSet.add(log.device_sn);
      if (log.device_id != null) deviceIdSet.add(log.device_id);
    }
    const deviceLocOr: { id?: { in: number[] }; deviceSN?: { in: string[] } }[] = [];
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
    const latLngByDeviceId = new Map<number, { latitude: number | null; longitude: number | null }>();
    const latLngByDeviceSn = new Map<string, { latitude: number | null; longitude: number | null }>();
    for (const d of deviceRows) {
      const addr = d.address?.trim() || null;
      addressByDeviceId.set(d.id, addr);
      addressByDeviceSn.set(d.deviceSN, addr);
      latLngByDeviceId.set(d.id, { latitude: d.latitude, longitude: d.longitude });
      latLngByDeviceSn.set(d.deviceSN, { latitude: d.latitude, longitude: d.longitude });
    }

    type Loc = {
      address: string | null;
      latitude: number | null;
      longitude: number | null;
    };
    const locByDay = new Map<string, { first: Loc; last: Loc }>();
    for (const log of logs) {
      if (!log.punch_time) continue;
      const key = this.punchDateKey(log.punch_time);
      const isApp = log.device_sn === 'LOCATION_APP';
      let address: string | null = null;
      let latitude: number | null = null;
      let longitude: number | null = null;
      if (isApp && log.raw_body) {
        try {
          const parsed = JSON.parse(log.raw_body);
          address = parsed?.address ?? null;
          latitude = parsed?.latitude ?? parsed?.lat ?? null;
          longitude = parsed?.longitude ?? parsed?.lng ?? null;
        } catch {
          address = null;
        }
      } else if (!isApp) {
        address =
          (log.device_id != null ? addressByDeviceId.get(log.device_id) : null) ??
          (log.device_sn ? addressByDeviceSn.get(log.device_sn) : null) ??
          null;
        const coords =
          (log.device_id != null ? latLngByDeviceId.get(log.device_id) : null) ??
          (log.device_sn ? latLngByDeviceSn.get(log.device_sn) : null);
        latitude = coords?.latitude ?? null;
        longitude = coords?.longitude ?? null;
      }
      const loc: Loc = { address, latitude, longitude };
      const existing = locByDay.get(key);
      if (!existing) locByDay.set(key, { first: loc, last: loc });
      else existing.last = loc;
    }

    return records.map((row) => {
      if (String(row.address || '').trim()) return row;
      const key = this.punchDateKey(row.checkinTime);
      const dayLoc = locByDay.get(key);
      if (!dayLoc) return row;
      const pick = row.checkType === 'CHECK_OUT' ? dayLoc.last : dayLoc.first;
      if (!pick.address && pick.latitude == null) return row;
      return {
        ...row,
        address: pick.address ?? row.address,
        latitude: row.latitude ?? pick.latitude,
        longitude: row.longitude ?? pick.longitude,
      };
    });
  }

  private punchDateKey(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  async getTodayStatus(employeeId: number) {
    const empFlags = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: { mobileAttendanceEnabled: true, photoPunchEnabled: true },
    });
    const mobileAttendanceEnabled = empFlags?.mobileAttendanceEnabled === true;
    const photoPunchEnabled = empFlags?.photoPunchEnabled === true;

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
    // A missed later field visit does not mark the day Absent. Only an absence declaration does.
    const isAbsentToday = !!absentDeclaration;

    return {
      isCheckedIn: punchState === 'IN' || punchState === 'ON_BREAK',
      isCheckedOut: punchState === 'OUT' && checkOuts.length > 0,
      isAbsentToday,
      absentDeclaration,
      punchState,
      canCheckIn: mobileAttendanceEnabled && punchState === 'OUT' && !isAbsentToday,
      canCheckOut: mobileAttendanceEnabled && (punchState === 'IN' || punchState === 'ON_BREAK'),
      mobileAttendanceEnabled,
      photoPunchEnabled,
      mobileBreakEnabled: false,
      canBreakIn: false,
      canBreakOut: false,
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

  async getPhotoReport(opts: {
    dateFrom: Date;
    dateTo: Date;
    companyID?: number;
  }) {
    return this.prisma.attendanceLocation.findMany({
      where: {
        checkType: { in: ['CHECK_IN', 'CHECK_OUT'] },
        photoUrl: { not: null },
        checkinTime: { gte: opts.dateFrom, lte: opts.dateTo },
        employee: {
          ...(opts.companyID ? { companyID: opts.companyID } : {}),
        },
      },
      select: {
        employeeId: true,
        checkType: true,
        checkinTime: true,
        photoUrl: true,
        address: true,
        employee: {
          select: {
            id: true,
            employeeID: true,
            employeeFirstName: true,
            employeeLastName: true,
          },
        },
      },
      orderBy: { checkinTime: 'asc' },
    });
  }
}
