import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCanteenSetupDto } from './dto/update-canteen-setup.dto';

@Injectable()
export class CanteenService {
  constructor(private prisma: PrismaService) {}

  private getDateRange(dateStr?: string) {
    // punch_time is stored as naive TIMESTAMP (no timezone) with literal IST values.
    // We need to build UTC Date objects whose UTC representation matches the
    // calendar-day boundaries 00:00:00 – 23:59:59 in the stored (naive) time.
    const dateOnly = dateStr
      ? dateStr.slice(0, 10)                       // "YYYY-MM-DD"
      : new Date().toISOString().slice(0, 10);
    const start = new Date(`${dateOnly}T00:00:00.000Z`);
    const end   = new Date(`${dateOnly}T23:59:59.999Z`);
    return { start, end };
  }

  /**
   * Returns a set of manage_employee_id values belonging to the given company.
   * If companyId is not provided, returns null (meaning no filtering).
   */
  private async getCompanyEmployeeIds(companyId?: number): Promise<Set<number> | null> {
    if (!companyId) return null;
    const employees = await this.prisma.manageEmployee.findMany({
      where: { companyID: companyId },
      select: { id: true },
    });
    return new Set(employees.map((e) => e.id));
  }

  private filterByCompany<T extends { manage_employee_id: number | null }>(
    records: T[],
    empIds: Set<number> | null,
  ): T[] {
    if (!empIds) return records;
    return records.filter((r) => r.manage_employee_id != null && empIds.has(r.manage_employee_id));
  }

  // ── Setup ──────────────────────────────────────────────

  async getSetup() {
    let setup = await this.prisma.canteen_setup.findFirst();
    if (!setup) {
      setup = await this.prisma.canteen_setup.create({
        data: { default_token_enabled: false },
      });
    }
    return setup;
  }

  async updateSetup(dto: UpdateCanteenSetupDto) {
    let setup = await this.prisma.canteen_setup.findFirst();
    if (!setup) {
      return this.prisma.canteen_setup.create({
        data: { default_token_enabled: dto.default_token_enabled },
      });
    }
    return this.prisma.canteen_setup.update({
      where: { id: setup.id },
      data: { default_token_enabled: dto.default_token_enabled },
    });
  }

  // ── Dashboard ──────────────────────────────────────────

  async getDashboard(dateStr?: string, companyId?: number) {
    const { start, end } = this.getDateRange(dateStr);
    const setup = await this.getSetup();
    const defaultEnabled = setup.default_token_enabled;
    const empIds = await this.getCompanyEmployeeIds(companyId);

    // Checkins from process_att_logs for the date
    // AT+TR devices route attendance punches here too (with ATT auth), so include all device types.
    const allCheckins = await this.prisma.process_att_logs.findMany({
      where: { punch_time: { gte: start, lte: end } },
      distinct: ['user_id'],
      select: {
        user_id: true,
        username: true,
        manage_employee_id: true,
        device_sn: true,
        punch_time: true,
      },
    });
    const checkins = this.filterByCompany(allCheckins, empIds);

    const checkinCount = checkins.length;

    // TR logs (token register / cancel) for the date
    const allTrLogs = await this.prisma.canteen_tr_logs.findMany({
      where: { punch_time: { gte: start, lte: end } },
      distinct: ['user_id'],
      select: { user_id: true, username: true, manage_employee_id: true },
    });
    const trLogs = this.filterByCompany(allTrLogs, empIds);
    const trCount = trLogs.length;

    // TV logs (token verified/consumed) for the date
    const allTvLogs = await this.prisma.canteen_tv_logs.findMany({
      where: { punch_time: { gte: start, lte: end } },
      distinct: ['user_id'],
      select: { user_id: true, username: true, manage_employee_id: true },
    });
    const tvLogs = this.filterByCompany(allTvLogs, empIds);
    const tvUserIds = new Set(tvLogs.map((l) => l.user_id));

    const checkinUserIds = new Set(checkins.map((c) => c.user_id));
    const trUserIds = new Set(trLogs.map((l) => l.user_id));

    let tokenAssigned: number;
    let tokenCancel: number;
    let tokenConsumed: number;
    if (defaultEnabled) {
      // Default ON: all checkins get token automatically.
      // TR punch = employee cancels lunch.
      tokenCancel = trCount;
      tokenAssigned = Math.max(0, checkinCount - tokenCancel);
      // Consumed = verified employees who were assigned (checked in and NOT cancelled)
      tokenConsumed = tvLogs.filter(
        (tv) => checkinUserIds.has(tv.user_id) && !trUserIds.has(tv.user_id),
      ).length;
    } else {
      // Default OFF: only TR-registered employees get token.
      // No cancel concept when disabled.
      tokenCancel = 0;
      tokenAssigned = trCount;
      // Consumed = verified employees who were assigned (registered via TR)
      tokenConsumed = tvLogs.filter(
        (tv) => trUserIds.has(tv.user_id),
      ).length;
    }

    const tokenNotConsumed = Math.max(0, tokenAssigned - tokenConsumed);

    return {
      date: (dateStr || new Date().toISOString().split('T')[0]),
      defaultTokenEnabled: defaultEnabled,
      checkin: checkinCount,
      tokenAssigned,
      tokenCancel,
      tokenConsumed,
      tokenNotConsumed,
    };
  }

  // ── Detail lists for dashboard cards ──────────────────

  async getCheckinEmployees(dateStr?: string, companyId?: number) {
    const { start, end } = this.getDateRange(dateStr);
    const empIds = await this.getCompanyEmployeeIds(companyId);
    const all = await this.prisma.process_att_logs.findMany({
      where: { punch_time: { gte: start, lte: end } },
      distinct: ['user_id'],
      select: {
        user_id: true,
        username: true,
        manage_employee_id: true,
        device_sn: true,
        punch_time: true,
        device_name: true,
      },
      orderBy: { punch_time: 'asc' },
    });
    return this.filterByCompany(all, empIds);
  }

  async getTokenAssigned(dateStr?: string, companyId?: number) {
    const { start, end } = this.getDateRange(dateStr);
    const setup = await this.getSetup();
    const defaultEnabled = setup.default_token_enabled;
    const empIds = await this.getCompanyEmployeeIds(companyId);

    if (defaultEnabled) {
      // All checkins minus those who cancelled via TR
      const allCheckins = await this.prisma.process_att_logs.findMany({
        where: { punch_time: { gte: start, lte: end }, NOT: { device_type: 'AT+TR' } },
        distinct: ['user_id'],
        select: {
          user_id: true,
          username: true,
          manage_employee_id: true,
          punch_time: true,
        },
      });
      const checkins = this.filterByCompany(allCheckins, empIds);

      const allTrLogs = await this.prisma.canteen_tr_logs.findMany({
        where: { punch_time: { gte: start, lte: end } },
        distinct: ['user_id'],
        select: { user_id: true, manage_employee_id: true },
      });
      const trLogs = this.filterByCompany(allTrLogs, empIds);
      const trUserIds = new Set(trLogs.map((l) => l.user_id));

      return checkins.filter((c) => !trUserIds.has(c.user_id));
    } else {
      // Only those who registered via TR device
      const allTrLogs = await this.prisma.canteen_tr_logs.findMany({
        where: { punch_time: { gte: start, lte: end } },
        distinct: ['user_id'],
        select: {
          user_id: true,
          username: true,
          manage_employee_id: true,
          punch_time: true,
        },
        orderBy: { punch_time: 'asc' },
      });
      return this.filterByCompany(allTrLogs, empIds);
    }
  }

  async getTokenCancel(dateStr?: string, companyId?: number) {
    const { start, end } = this.getDateRange(dateStr);
    const empIds = await this.getCompanyEmployeeIds(companyId);
    const all = await this.prisma.canteen_tr_logs.findMany({
      where: { punch_time: { gte: start, lte: end } },
      distinct: ['user_id'],
      select: {
        user_id: true,
        username: true,
        manage_employee_id: true,
        punch_time: true,
      },
      orderBy: { punch_time: 'asc' },
    });
    return this.filterByCompany(all, empIds);
  }

  async getTokenConsumed(dateStr?: string, companyId?: number) {
    const { start, end } = this.getDateRange(dateStr);
    const setup = await this.getSetup();
    const defaultEnabled = setup.default_token_enabled;
    const empIds = await this.getCompanyEmployeeIds(companyId);

    const allTvLogs = await this.prisma.canteen_tv_logs.findMany({
      where: { punch_time: { gte: start, lte: end } },
      distinct: ['user_id'],
      select: {
        user_id: true,
        username: true,
        manage_employee_id: true,
        punch_time: true,
      },
      orderBy: { punch_time: 'asc' },
    });
    const tvLogs = this.filterByCompany(allTvLogs, empIds);

    if (defaultEnabled) {
      const allCheckins = await this.prisma.process_att_logs.findMany({
        where: { punch_time: { gte: start, lte: end }, NOT: { device_type: 'AT+TR' } },
        distinct: ['user_id'],
        select: { user_id: true, manage_employee_id: true },
      });
      const checkins = this.filterByCompany(allCheckins, empIds);
      const allTrLogs = await this.prisma.canteen_tr_logs.findMany({
        where: { punch_time: { gte: start, lte: end } },
        distinct: ['user_id'],
        select: { user_id: true, manage_employee_id: true },
      });
      const trLogs = this.filterByCompany(allTrLogs, empIds);
      const checkinUserIds = new Set(checkins.map((c) => c.user_id));
      const trUserIds = new Set(trLogs.map((l) => l.user_id));
      return tvLogs.filter(
        (tv) => checkinUserIds.has(tv.user_id) && !trUserIds.has(tv.user_id),
      );
    } else {
      const allTrLogs = await this.prisma.canteen_tr_logs.findMany({
        where: { punch_time: { gte: start, lte: end } },
        distinct: ['user_id'],
        select: { user_id: true, manage_employee_id: true },
      });
      const trLogs = this.filterByCompany(allTrLogs, empIds);
      const trUserIds = new Set(trLogs.map((l) => l.user_id));
      return tvLogs.filter((tv) => trUserIds.has(tv.user_id));
    }
  }

  async getTokenNotConsumed(dateStr?: string, companyId?: number) {
    const { start, end } = this.getDateRange(dateStr);
    const setup = await this.getSetup();
    const defaultEnabled = setup.default_token_enabled;
    const empIds = await this.getCompanyEmployeeIds(companyId);

    // Get the set of verified (consumed) user_ids
    const allTvLogs = await this.prisma.canteen_tv_logs.findMany({
      where: { punch_time: { gte: start, lte: end } },
      distinct: ['user_id'],
      select: { user_id: true, manage_employee_id: true },
    });
    const tvLogs = this.filterByCompany(allTvLogs, empIds);
    const tvUserIds = new Set(tvLogs.map((l) => l.user_id));

    if (defaultEnabled) {
      const allCheckins = await this.prisma.process_att_logs.findMany({
        where: { punch_time: { gte: start, lte: end }, NOT: { device_type: 'AT+TR' } },
        distinct: ['user_id'],
        select: {
          user_id: true,
          username: true,
          manage_employee_id: true,
          punch_time: true,
        },
      });
      const checkins = this.filterByCompany(allCheckins, empIds);
      const allTrLogs = await this.prisma.canteen_tr_logs.findMany({
        where: { punch_time: { gte: start, lte: end } },
        distinct: ['user_id'],
        select: { user_id: true, manage_employee_id: true },
      });
      const trLogs = this.filterByCompany(allTrLogs, empIds);
      const trUserIds = new Set(trLogs.map((l) => l.user_id));

      return checkins.filter(
        (c) => !trUserIds.has(c.user_id) && !tvUserIds.has(c.user_id),
      );
    } else {
      const allTrLogs = await this.prisma.canteen_tr_logs.findMany({
        where: { punch_time: { gte: start, lte: end } },
        distinct: ['user_id'],
        select: {
          user_id: true,
          username: true,
          manage_employee_id: true,
          punch_time: true,
        },
      });
      const trLogs = this.filterByCompany(allTrLogs, empIds);

      return trLogs.filter((t) => !tvUserIds.has(t.user_id));
    }
  }

  // ── Reports ────────────────────────────────────────────

  private async getReportFilteredEmployeeIds(
    companyId?: number,
    branchId?: number,
    departmentId?: number,
  ): Promise<Set<number> | null> {
    const where: any = {};
    if (companyId) where.companyID = companyId;
    if (branchId) where.branchesID = branchId;
    if (departmentId) where.departmentNameID = departmentId;
    if (Object.keys(where).length === 0) return null;
    const employees = await this.prisma.manageEmployee.findMany({
      where,
      select: { id: true },
    });
    return new Set(employees.map((e) => e.id));
  }

  async getReports(
    dateFrom?: string,
    dateTo?: string,
    type?: string,
    companyId?: number,
    branchId?: number,
    departmentId?: number,
  ) {
    const from = dateFrom ? dateFrom.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const to = dateTo ? dateTo.slice(0, 10) : from;
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T23:59:59.999Z`);

    const empIds = await this.getReportFilteredEmployeeIds(companyId, branchId, departmentId);
    const setup = await this.getSetup();
    const defaultTokenEnabled = setup.default_token_enabled;

    // Build list of dates in range
    const dates: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    // Fetch all data for the entire range
    const [allCheckins, allTrLogs, allTvLogs] = await Promise.all([
      this.prisma.process_att_logs.findMany({
        where: { punch_time: { gte: start, lte: end }, NOT: { device_type: 'AT+TR' } },
        orderBy: { punch_time: 'asc' },
      }),
      this.prisma.canteen_tr_logs.findMany({
        where: { punch_time: { gte: start, lte: end } },
        orderBy: { punch_time: 'asc' },
      }),
      this.prisma.canteen_tv_logs.findMany({
        where: { punch_time: { gte: start, lte: end } },
        orderBy: { punch_time: 'asc' },
      }),
    ]);

    const getDateStr = (pt: Date) => pt.toISOString().slice(0, 10);

    // Group records by date
    const groupByDate = <T extends { punch_time: Date }>(records: T[]) => {
      const map = new Map<string, T[]>();
      for (const r of records) {
        const d = getDateStr(r.punch_time);
        if (!map.has(d)) map.set(d, []);
        map.get(d)!.push(r);
      }
      return map;
    };

    const checkinsByDate = groupByDate(allCheckins as any[]);
    const trByDate = groupByDate(allTrLogs as any[]);
    const tvByDate = groupByDate(allTvLogs as any[]);

    // Deduplicate by manage_employee_id, keep first occurrence
    const dedup = <T extends { manage_employee_id: number | null }>(records: T[]): T[] => {
      const seen = new Set<number>();
      return records.filter((r) => {
        if (!r.manage_employee_id || seen.has(r.manage_employee_id)) return false;
        seen.add(r.manage_employee_id);
        return true;
      });
    };

    // Get assigned records for a specific date (same logic as getTokenAssigned)
    const getAssignedForDate = (dateStr: string): any[] => {
      if (defaultTokenEnabled) {
        const dayCheckins = dedup(checkinsByDate.get(dateStr) || []);
        const cancelIds = new Set(
          (trByDate.get(dateStr) || [])
            .filter((t: any) => t.manage_employee_id != null)
            .map((t: any) => t.manage_employee_id),
        );
        return dayCheckins.filter((c: any) => !cancelIds.has(c.manage_employee_id));
      } else {
        return dedup(trByDate.get(dateStr) || []);
      }
    };

    if (type === 'checkin') {
      const result: any[] = [];
      for (const dateStr of dates) {
        const dayRecords = dedup(checkinsByDate.get(dateStr) || []);
        result.push(...this.filterByCompany(dayRecords, empIds));
      }
      return result;
    }

    if (type === 'tokenAssigned') {
      const result: any[] = [];
      for (const dateStr of dates) {
        result.push(...this.filterByCompany(getAssignedForDate(dateStr), empIds));
      }
      return result;
    }

    if (type === 'tokenCancel') {
      // Token cancel only makes sense when defaultTokenEnabled
      // TR logs are the cancel records
      const result: any[] = [];
      for (const dateStr of dates) {
        const dayRecords = dedup(trByDate.get(dateStr) || []);
        result.push(...this.filterByCompany(dayRecords, empIds));
      }
      return result;
    }

    if (type === 'tokenConsumed') {
      const result: any[] = [];
      for (const dateStr of dates) {
        const assigned = getAssignedForDate(dateStr);
        const assignedIds = new Set(
          assigned
            .filter((a: any) => a.manage_employee_id != null)
            .map((a: any) => a.manage_employee_id),
        );
        const tvRecords = dedup(
          (tvByDate.get(dateStr) || []).filter((t: any) =>
            assignedIds.has(t.manage_employee_id),
          ),
        );
        result.push(...this.filterByCompany(tvRecords, empIds));
      }
      return result;
    }

    if (type === 'tokenNotConsumed') {
      const result: any[] = [];
      for (const dateStr of dates) {
        const assigned = this.filterByCompany(getAssignedForDate(dateStr), empIds);
        const consumedIds = new Set(
          (tvByDate.get(dateStr) || [])
            .filter((t: any) => t.manage_employee_id != null)
            .map((t: any) => t.manage_employee_id!),
        );
        result.push(
          ...assigned.filter(
            (a: any) =>
              a.manage_employee_id != null &&
              !consumedIds.has(a.manage_employee_id!),
          ),
        );
      }
      return result;
    }

    return [];
  }
}
