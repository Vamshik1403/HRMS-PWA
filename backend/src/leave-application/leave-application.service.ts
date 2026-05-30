import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveApplicationDto } from './dto/create-leave-application.dto';
import { UpdateLeaveApplicationDto } from './dto/update-leave-application.dto';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { EmpLeaveBalanceService } from '../emp-leave-balance/emp-leave-balance.service';

@Injectable()
export class LeaveApplicationService {
  constructor(
    private prisma: PrismaService,
    private pushService: PushNotificationsService,
    private leaveBalanceService: EmpLeaveBalanceService,
  ) {}

  create(createLeaveApplicationDto: CreateLeaveApplicationDto) {
    return this.prisma.leaveApplication.create({
      data: createLeaveApplicationDto,
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

  async findByEmployee(empId: number) {
  return this.prisma.leaveApplication.findMany({
    where: { manageEmployeeID: empId },
    include: {
      serviceProvider: true,
      company: true,
      branches: true,
      manageEmployee: true,
    },
    orderBy: { id: 'desc' },
  });
}


  findAll() {
    return this.prisma.leaveApplication.findMany({
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.leaveApplication.findUnique({
      where: { id },
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

 async revokeLeave(id: number, revokedReason?: string) {
  const leave = await this.prisma.leaveApplication.findUnique({ where: { id } })
  if (!leave) throw new NotFoundException('Leave not found')

  // Only approved leaves can go to revoke request
  if (leave.status !== 'Approved') {
    throw new BadRequestException('Only approved leaves can be revoked')
  }

  // === Append to old revoke history (in the same String field) ===
  const oldReason = leave.revokedReason ? leave.revokedReason + '\n' : ''
  const reasonLog =
    oldReason +
    `[${new Date().toLocaleString()}] Revoke requested: ${
      revokedReason ?? '(no reason provided)'
    }`

  // === Update leave record ===
  const updated = await this.prisma.leaveApplication.update({
    where: { id },
    data: {
      status: 'RevokePending', // waiting for manager approval
      revokedReason: reasonLog, // append old + new reasons
      revokedAt: new Date(), // store last request date/time
    },
  })

  return {
    message: 'Revoke request logged and waiting for approval',
    data: updated,
  }
}





  private static readonly BALANCE_LEAVE_TYPES = [
    'Sick',
    'Casual',
    'Privileged',
    'CompOff',
    'MtL',
    'PtL',
  ] as const;

  private async countUsedLeaveDaysByType(
    manageEmployeeID: number,
    excludeApplicationId?: number,
  ): Promise<Record<string, number>> {
    const used: Record<string, number> = {};
    const leaves = await this.prisma.leaveApplication.findMany({
      where: {
        manageEmployeeID,
        status: { in: ['Approved', 'Accepted', 'Partly Approved'] },
        ...(excludeApplicationId ? { id: { not: excludeApplicationId } } : {}),
      },
    });

    for (const leave of leaves) {
      const ds = leave.dayStatuses as { status?: string }[] | null;
      if (Array.isArray(ds) && ds.length > 0) {
        for (const day of ds) {
          const t = day?.status;
          if (t) used[t] = (used[t] || 0) + 1;
        }
        continue;
      }
      if (!leave.fromDate || !leave.toDate || !leave.appliedLeaveType) continue;
      const from = new Date(String(leave.fromDate));
      const to = new Date(String(leave.toDate));
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) continue;
      const days =
        Math.ceil(Math.abs(to.getTime() - from.getTime()) / 86400000) + 1;
      const t = leave.appliedLeaveType;
      used[t] = (used[t] || 0) + days;
    }
    return used;
  }

  private async assertApprovalWithinLeaveBalance(
    manageEmployeeID: number,
    excludeApplicationId: number,
    dayStatuses: { status?: string }[],
  ) {
    if (!dayStatuses?.length) return;

    const employee = await this.prisma.manageEmployee.findUnique({
      where: { id: manageEmployeeID },
      include: {
        leavePolicy: true,
        empLeavePolicy: {
          include: { leavePolicy: true },
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
    });
    if (!employee) {
      throw new BadRequestException('Employee not found');
    }

    const policy =
      employee.leavePolicy ?? employee.empLeavePolicy?.[0]?.leavePolicy;

    const totals: Record<string, number> = {
      Sick: Number(policy?.sickLeaveCount) || 0,
      Casual: Number(policy?.casualLeaveCount) || 0,
      Privileged: 0,
      CompOff: 0,
      MtL: Number(policy?.maternityLeaveCount) || 182,
      PtL: Number(policy?.paternityLeaveCount) || 15,
    };

    const used = await this.countUsedLeaveDaysByType(
      manageEmployeeID,
      excludeApplicationId,
    );

    const requested: Record<string, number> = {};
    for (const day of dayStatuses) {
      const t = day?.status;
      if (!t || t === 'LoP' || t === 'ShortLeave') continue;
      requested[t] = (requested[t] || 0) + 1;
    }

    for (const type of LeaveApplicationService.BALANCE_LEAVE_TYPES) {
      const req = requested[type] || 0;
      if (req === 0) continue;
      const total = totals[type] ?? 0;
      if (total <= 0) continue;
      const usedCount = used[type] || 0;
      const remaining = Math.max(total - usedCount, 0);
      if (req > remaining) {
        throw new BadRequestException(
          `Cannot approve ${req} ${type} day(s): only ${remaining} day(s) remaining in balance.`,
        );
      }
    }
  }

  async update(id: number, updateLeaveApplicationDto: UpdateLeaveApplicationDto) {
    // Fetch the current leave record so we know the previous status
    const current = await this.prisma.leaveApplication.findUnique({ where: { id } });

    const APPROVED_STATUSES = ['Approved', 'Accepted', 'Partly Approved'];
    const nextStatus = updateLeaveApplicationDto.status ?? current?.status ?? '';
    const ds = updateLeaveApplicationDto.dayStatuses as
      | { status?: string }[]
      | undefined;

    if (
      APPROVED_STATUSES.includes(nextStatus) &&
      current?.manageEmployeeID &&
      Array.isArray(ds) &&
      ds.some((d) => d?.status)
    ) {
      await this.assertApprovalWithinLeaveBalance(
        current.manageEmployeeID,
        id,
        ds,
      );
    }

    const updated = await this.prisma.leaveApplication.update({
      where: { id },
      data: updateLeaveApplicationDto,
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });

    const isNowApproved = APPROVED_STATUSES.includes(updated.status ?? '');
    const wasNotApproved = !APPROVED_STATUSES.includes(current?.status ?? '');

    // Deduct leave balance when status changes to Approved/Partly Approved for the first time
    if (isNowApproved && wasNotApproved && updated.manageEmployeeID) {
      try {
        const ds = updated.dayStatuses as { status?: string }[] | null;
        if (Array.isArray(ds) && ds.some((d) => d?.status)) {
          await this.leaveBalanceService.deductFromDayStatuses(
            updated.manageEmployeeID,
            ds,
          );
        } else {
          let days = 0;
          if (updated.fromDate && updated.toDate) {
            const from = new Date(updated.fromDate as any);
            const to = new Date(updated.toDate as any);
            days =
              Math.ceil(Math.abs(to.getTime() - from.getTime()) / 86400000) + 1;
          }
          if (days > 0) {
            await this.leaveBalanceService.deductLeave(
              updated.manageEmployeeID,
              updated.appliedLeaveType ?? '',
              days,
            );
          }
        }
      } catch (_) { /* non-critical */ }
    }

    const empId = updated.manageEmployeeID;
    if (empId) {
      const newStatus = updated.status ?? '';
      const prevStatus = current?.status ?? '';
      if (newStatus === 'Rejected' && prevStatus !== 'Rejected') {
        this.pushService
          .sendToEmployee(
            empId,
            'Leave Rejected',
            'Your leave application has been rejected.',
            { url: '/empLeaveApplication' },
          )
          .catch(() => null);
      } else if (
        newStatus === 'Partly Approved' &&
        prevStatus !== 'Partly Approved'
      ) {
        const ds = (updated.dayStatuses as { status?: string }[]) || [];
        const approved = ds.filter((d) => d?.status).length;
        const total = ds.length;
        this.pushService
          .sendToEmployee(
            empId,
            'Leave Partly Approved',
            `Your leave was partly approved: ${approved} of ${total} day(s) approved.`,
            { url: '/empLeaveApplication' },
          )
          .catch(() => null);
      } else if (
        (newStatus === 'Approved' || newStatus === 'Accepted') &&
        !['Approved', 'Accepted'].includes(prevStatus)
      ) {
        this.pushService
          .sendToEmployee(
            empId,
            'Leave Approved',
            'Your leave application has been approved.',
            { url: '/empLeaveApplication' },
          )
          .catch(() => null);
      }
    }

    return updated;
  }

  remove(id: number) {
    return this.prisma.leaveApplication.delete({
      where: { id },
    });
  }
}
