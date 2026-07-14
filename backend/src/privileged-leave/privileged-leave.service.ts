import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrivilegedLeaveDto } from './dto/create-privileged-leave.dto';
import { UpdatePrivilegedLeaveDto } from './dto/update-privileged-leave.dto';

const APPROVED_LEAVE_STATUSES = ['Approved', 'Accepted', 'Partially Approved'] as const;
const PAID_LEAVE_TYPES = ['Sick', 'Casual', 'Privileged', 'CompOff', 'Earn', 'PL', 'MtL', 'PtL'] as const;

function addDateRangeToSet(
  target: Set<string>,
  start: Date,
  end: Date,
  fromDate?: string,
  toDate?: string,
) {
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split('T')[0];
    if (fromDate && key < fromDate) continue;
    if (toDate && key > toDate) continue;
    target.add(key);
  }
}

@Injectable()
export class PrivilegedLeaveService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePrivilegedLeaveDto) {
    return this.prisma.privilegedLeaveLedger.create({
      data: {
        serviceProviderID: dto.serviceProviderID,
        companyID: dto.companyID,
        branchesID: dto.branchesID,
        employeeID: dto.employeeID,
        leavePolicyID: dto.leavePolicyID,
        creditedLeaves: dto.creditedLeaves ?? 0,
        usedLeaves: dto.usedLeaves ?? 0,
        balanceLeaves: dto.balanceLeaves ?? 0,
        creditDate: new Date(dto.creditDate),
        description: dto.description,
      },
      include: {
        manageEmployee: true,
        leavePolicy: true,
      },
    });
  }
  
  async findAll() {
    return this.prisma.privilegedLeaveLedger.findMany({
      include: {
        manageEmployee: true,
        leavePolicy: true,
      },
      orderBy: { creditDate: 'desc' },
    });
  }

  async findOne(id: number) {
    const record = await this.prisma.privilegedLeaveLedger.findUnique({
      where: { id },
      include: {
        manageEmployee: true,
        leavePolicy: true,
      },
    });
    if (!record) {
      throw new NotFoundException(`Privileged leave ledger entry #${id} not found`);
    }
    return record;
  }

  async findByEmployee(employeeID: number) {
    return this.prisma.privilegedLeaveLedger.findMany({
      where: { employeeID },
      include: {
        manageEmployee: true,
        leavePolicy: true,
      },
      orderBy: { creditDate: 'desc' },
    });
  }

  async getBalance(employeeID: number) {
    const ledger = await this.prisma.privilegedLeaveLedger.findMany({
      where: { employeeID },
    });
    const totalCredited = ledger.reduce((sum, e) => sum + e.creditedLeaves, 0);
    const totalUsed = ledger.reduce((sum, e) => sum + e.usedLeaves, 0);

    // Also check lapses
    const lapses = await this.prisma.privilegedLeaveLapse.findMany({
      where: { employeeID },
    });
    const totalLapsed = lapses.reduce((sum, e) => sum + e.leaveCount, 0);

    return {
      employeeID,
      totalCredited,
      totalUsed,
      totalLapsed,
      balance: totalCredited - totalUsed - totalLapsed,
    };
  }

  async creditPL(employeeID: number, leavePolicyID: number) {
    // Get the leave policy to determine ratio
    const policy = await this.prisma.leavePolicy.findUnique({
      where: { id: leavePolicyID },
    });
    if (!policy || !policy.isPrivilegedLeaveApplicable) {
      throw new NotFoundException('Leave policy not found or PL not applicable');
    }

    // Parse ratio (e.g., "20:1" means 20 working days = 1 PL)
    const ratio = policy.privilegedLeaveRatio || '20:1';
    const [workDays, plDays] = ratio.split(':').map(Number);
    if (!workDays || !plDays) {
      throw new NotFoundException('Invalid PL ratio configured');
    }

    // Calculate credits (this is a simplified version - in production, 
    // you'd count actual working days from attendance)
    const creditedLeaves = plDays; // crediting based on ratio

    return this.prisma.privilegedLeaveLedger.create({
      data: {
        serviceProviderID: policy.serviceProviderID,
        companyID: policy.companyID,
        branchesID: policy.branchesID,
        employeeID,
        leavePolicyID,
        creditedLeaves,
        usedLeaves: 0,
        balanceLeaves: creditedLeaves,
        creditDate: new Date(),
        description: `Auto credit: ${workDays} working days = ${plDays} PL`,
      },
      include: {
        manageEmployee: true,
        leavePolicy: true,
      },
    });
  }

  async update(id: number, dto: UpdatePrivilegedLeaveDto) {
    await this.findOne(id);
    return this.prisma.privilegedLeaveLedger.update({
      where: { id },
      data: {
        ...dto,
        creditDate: dto.creditDate ? new Date(dto.creditDate) : undefined,
      },
      include: {
        manageEmployee: true,
        leavePolicy: true,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.privilegedLeaveLedger.delete({
      where: { id },
    });
  }

  // === LAPSE LOGIC ===
  async processLapse(employeeID: number, leavePolicyID: number) {
    const policy = await this.prisma.leavePolicy.findUnique({
      where: { id: leavePolicyID },
    });
    if (!policy) throw new NotFoundException('Leave policy not found');

    const limit = policy.plCarryForwardLimit ?? 0;
    const balance = await this.getBalance(employeeID);

    if (balance.balance > limit && limit > 0) {
      const lapseCount = balance.balance - limit;

      await this.prisma.privilegedLeaveLapse.create({
        data: {
          serviceProviderID: policy.serviceProviderID,
          companyID: policy.companyID,
          branchesID: policy.branchesID,
          employeeID,
          leavePolicyID,
          leaveCount: lapseCount,
          lapseDate: new Date(),
          reason: `Auto lapse: Balance ${balance.balance} exceeded limit ${limit}`,
        },
      });

      return {
        message: `Lapsed ${lapseCount} PL for employee #${employeeID}`,
        lapsedCount: lapseCount,
        newBalance: limit,
      };
    }

    return {
      message: 'No lapse needed',
      balance: balance.balance,
      limit,
    };
  }

  // === LAPSE RECORDS ===
  async getLapseHistory(employeeID: number) {
    return this.prisma.privilegedLeaveLapse.findMany({
      where: { employeeID },
      include: {
        manageEmployee: true,
        leavePolicy: true,
      },
      orderBy: { lapseDate: 'desc' },
    });
  }

  // === ATTENDANCE-BASED PL CALCULATION ===
  async getAttendanceCount(employeeID: number, fromDate?: string, toDate?: string) {
    const dateFilter: any = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      dateFilter.lte = to;
    }

    const punches = await this.prisma.process_att_logs.findMany({
      where: {
        manage_employee_id: employeeID,
        ...(Object.keys(dateFilter).length > 0 ? { punch_time: dateFilter } : {}),
      },
      select: { punch_time: true },
    });

    const dateSet = new Set<string>();
    for (const p of punches) {
      if (p.punch_time) {
        dateSet.add(p.punch_time.toISOString().split('T')[0]);
      }
    }
    return {
      employeeID,
      totalPunches: punches.length,
      distinctDays: dateSet.size,
      dates: [...dateSet].sort(),
    };
  }

  async calculateAndCreditFromAttendance(
    employeeID: number,
    leavePolicyID: number,
    fromDate?: string,
    toDate?: string,
    dryRun = false,
  ) {
    const policy = await this.prisma.leavePolicy.findUnique({
      where: { id: leavePolicyID },
    });
    if (!policy || !policy.isPrivilegedLeaveApplicable) {
      throw new NotFoundException('Leave policy not found or PL not applicable');
    }

    const ratio = policy.privilegedLeaveRatio || '20:1';
    const [workDays, plDays] = ratio.split(':').map(Number);
    if (!workDays || !plDays) {
      throw new NotFoundException('Invalid PL ratio configured in policy');
    }

    const dateFilter: any = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      dateFilter.lte = to;
    }

    // 1. Count distinct punch days from process_att_logs
    const punches = await this.prisma.process_att_logs.findMany({
      where: {
        manage_employee_id: employeeID,
        ...(Object.keys(dateFilter).length > 0 ? { punch_time: dateFilter } : {}),
      },
      select: { punch_time: true },
    });

    const workingDates = new Set<string>();
    for (const p of punches) {
      if (p.punch_time) {
        workingDates.add(p.punch_time.toISOString().split('T')[0]);
      }
    }

    // 2. If weekOffConsideredInPL, also count EmployeeWeeklyOff dates
    if (policy.weekOffConsideredInPL) {
      const weeklyOffs = await this.prisma.employeeWeeklyOff.findMany({
        where: {
          employeeID,
          ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
        },
      });
      for (const wo of weeklyOffs) {
        workingDates.add(wo.date.toISOString().split('T')[0]);
      }
    }

    // 3. If paidLeaveConsideredInPL, also count approved paid leave days
    if (policy.paidLeaveConsideredInPL) {
      const paidLeaves = await this.prisma.leaveApplication.findMany({
        where: {
          manageEmployeeID: employeeID,
          status: { in: [...APPROVED_LEAVE_STATUSES] },
          appliedLeaveType: { in: [...PAID_LEAVE_TYPES] },
          ...(fromDate || toDate
            ? {
                fromDate: {
                  ...(fromDate ? { gte: new Date(fromDate) } : {}),
                  ...(toDate ? { lte: new Date(toDate) } : {}),
                },
              }
            : {}),
        },
        select: { fromDate: true, toDate: true, dayStatuses: true },
      });
      for (const lv of paidLeaves) {
        const ds = lv.dayStatuses as Array<{ date?: string; status?: string }> | null;
        if (Array.isArray(ds) && ds.length > 0) {
          for (const day of ds) {
            if (!day?.date || !day?.status) continue;
            const key = new Date(day.date).toISOString().split('T')[0];
            if (fromDate && key < fromDate) continue;
            if (toDate && key > toDate) continue;
            workingDates.add(key);
          }
        } else if (lv.fromDate && lv.toDate) {
          addDateRangeToSet(
            workingDates,
            new Date(lv.fromDate),
            new Date(lv.toDate),
            fromDate,
            toDate,
          );
        }
      }
    }

    // 4. If holidayConsideredInPL, count public holidays linked to this policy
    if (policy.holidayConsideredInPL) {
      const policyHolidays = await this.prisma.leavePolicyHoliday.findMany({
        where: { leavePolicyID },
        include: { publicHoliday: true },
      });
      for (const link of policyHolidays) {
        const pub = link.publicHoliday;
        if (!pub?.startDate) continue;
        const start = new Date(pub.startDate);
        const end = pub.endDate ? new Date(pub.endDate) : new Date(pub.startDate);
        addDateRangeToSet(workingDates, start, end, fromDate, toDate);
      }
    }

    const totalWorkingDays = workingDates.size;
    const plEarned = Math.floor(totalWorkingDays / workDays) * plDays;

    // 5. Get already credited PL from auto-credit entries
    const existingAuto = await this.prisma.privilegedLeaveLedger.aggregate({
      where: {
        employeeID,
        leavePolicyID,
        description: { contains: 'Auto credit from attendance' },
      },
      _sum: { creditedLeaves: true },
    });
    const alreadyCredited = existingAuto._sum.creditedLeaves ?? 0;
    const toCredit = plEarned - alreadyCredited;

    if (dryRun) {
      return {
        message: toCredit > 0
          ? `${toCredit} PL ready to credit (${totalWorkingDays} working days, ratio ${workDays}:${plDays})`
          : `No new PL to credit (${totalWorkingDays} working days, ${plEarned} earned, ${alreadyCredited} already credited)`,
        totalWorkingDays,
        plEarned,
        alreadyCredited,
        toCredit,
        ratio: `${workDays}:${plDays}`,
        weekOffConsidered: policy.weekOffConsideredInPL ?? false,
        holidayConsidered: policy.holidayConsideredInPL ?? false,
        paidLeaveConsidered: policy.paidLeaveConsideredInPL ?? false,
      };
    }

    if (toCredit <= 0) {
      return {
        message: `No new PL to credit. Employee has ${totalWorkingDays} working days, earned ${plEarned} PL, already credited ${alreadyCredited}.`,
        totalWorkingDays,
        plEarned,
        alreadyCredited,
        newlyCredited: 0,
      };
    }

    // 6. Credit the difference
    const entry = await this.prisma.privilegedLeaveLedger.create({
      data: {
        serviceProviderID: policy.serviceProviderID,
        companyID: policy.companyID,
        branchesID: policy.branchesID,
        employeeID,
        leavePolicyID,
        creditedLeaves: toCredit,
        usedLeaves: 0,
        balanceLeaves: toCredit,
        creditDate: new Date(),
        description: `Auto credit from attendance: ${totalWorkingDays} working days, ${plEarned} PL earned, ${alreadyCredited} previously credited`,
      },
      include: { manageEmployee: true, leavePolicy: true },
    });

    return {
      message: `Credited ${toCredit} PL for employee #${employeeID} (${totalWorkingDays} working days)`,
      totalWorkingDays,
      plEarned,
      alreadyCredited,
      newlyCredited: toCredit,
      entry,
    };
  }
}
