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





  async update(id: number, updateLeaveApplicationDto: UpdateLeaveApplicationDto) {
    // Fetch the current leave record so we know the previous status
    const current = await this.prisma.leaveApplication.findUnique({ where: { id } });

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

    const APPROVED_STATUSES = ['Approved', 'Accepted'];
    const isNowApproved = APPROVED_STATUSES.includes(updated.status ?? '');
    const wasNotApproved = !APPROVED_STATUSES.includes(current?.status ?? '');

    // Deduct leave balance when status changes to Approved/Accepted for the first time
    if (isNowApproved && wasNotApproved && updated.manageEmployeeID) {
      try {
        let days = 0;
        const ds = updated.dayStatuses as any[] | null;
        if (Array.isArray(ds) && ds.length > 0) {
          days = ds.length;
        } else if (updated.fromDate && updated.toDate) {
          const from = new Date(updated.fromDate as any);
          const to = new Date(updated.toDate as any);
          days = Math.ceil(Math.abs(to.getTime() - from.getTime()) / 86400000) + 1;
        }
        if (days > 0) {
          await this.leaveBalanceService.deductLeave(
            updated.manageEmployeeID,
            updated.appliedLeaveType ?? '',
            days,
          );
        }
      } catch (_) { /* non-critical */ }
    }

    // Send push notification when leave is approved or accepted
    if (isNowApproved && updated.manageEmployeeID) {
      this.pushService.sendToEmployee(
        updated.manageEmployeeID,
        'Leave Approved',
        'Your leave application has been approved.',
        { url: '/empLeaveApplication' },
      ).catch(() => null);
    }

    return updated;
  }

  remove(id: number) {
    return this.prisma.leaveApplication.delete({
      where: { id },
    });
  }
}
