import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Map appliedLeaveType values to balance columns
const LEAVE_TYPE_MAP: Record<string, string> = {
  sick:       'sickUsed',
  Sick:       'sickUsed',
  casual:     'casualUsed',
  Casual:     'casualUsed',
  privileged: 'privilegedUsed',
  Privileged: 'privilegedUsed',
  compoff:    'compOffUsed',
  CompOff:    'compOffUsed',
  maternity:  'maternityUsed',
  MtL:        'maternityUsed',
  paternity:  'paternityUsed',
  PtL:        'paternityUsed',
};

@Injectable()
export class EmpLeaveBalanceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get or initialize balance for an employee.
   * On first call the used counts are seeded from all existing approved leaves.
   */
  async getOrInit(manageEmployeeID: number) {
    const existing = await this.prisma.empLeaveBalance.findUnique({
      where: { manageEmployeeID },
    });
    if (existing) return existing;

    // Seed from existing approved/accepted leaves
    const approvedLeaves = await this.prisma.leaveApplication.findMany({
      where: { manageEmployeeID, status: { in: ['Approved', 'Accepted'] } },
    });

    const used = {
      sickUsed: 0,
      casualUsed: 0,
      privilegedUsed: 0,
      compOffUsed: 0,
      maternityUsed: 0,
      paternityUsed: 0,
    };

    for (const leave of approvedLeaves) {
      const col = LEAVE_TYPE_MAP[leave.appliedLeaveType ?? ''];
      if (!col) continue;

      let days = 0;
      const ds = leave.dayStatuses as any[] | null;
      if (Array.isArray(ds) && ds.length > 0) {
        // Count each day entry that belongs to this leave type
        days = ds.filter(
          (d: any) => !d.status || d.status === leave.appliedLeaveType || d.status === col,
        ).length || ds.length;
      } else if (leave.fromDate && leave.toDate) {
        const from = new Date(leave.fromDate);
        const to = new Date(leave.toDate);
        days =
          Math.ceil(Math.abs(to.getTime() - from.getTime()) / 86400000) + 1;
      }

      (used as any)[col] = (used as any)[col] + days;
    }

    return this.prisma.empLeaveBalance.create({
      data: { manageEmployeeID, ...used },
    });
  }

  /**
   * Called when a leave application is approved.
   * Adds the leave days to the corresponding used counter.
   */
  async deductLeave(
    manageEmployeeID: number,
    appliedLeaveType: string,
    days: number,
  ) {
    if (days <= 0) return;
    const col = LEAVE_TYPE_MAP[appliedLeaveType];
    if (!col) return; // LoP / ShortLeave don't affect balance

    const existing = await this.prisma.empLeaveBalance.findUnique({
      where: { manageEmployeeID },
    });

    if (!existing) {
      // No record yet — seed from all historical approved/accepted leaves
      // (which already includes the current one just approved).
      // The seed counts it, so we do NOT double-increment.
      await this.getOrInit(manageEmployeeID);
      return;
    }

    await this.prisma.empLeaveBalance.update({
      where: { manageEmployeeID },
      data: { [col]: { increment: days } },
    });
  }

  /**
   * Called when an approved leave is revoked (undo the deduction).
   */
  async addBackLeave(
    manageEmployeeID: number,
    appliedLeaveType: string,
    days: number,
  ) {
    if (days <= 0) return;
    const col = LEAVE_TYPE_MAP[appliedLeaveType];
    if (!col) return;

    const balance = await this.prisma.empLeaveBalance.findUnique({
      where: { manageEmployeeID },
    });
    if (!balance) return;

    const current = (balance as any)[col] as number;
    await this.prisma.empLeaveBalance.update({
      where: { manageEmployeeID },
      data: { [col]: Math.max(0, current - days) },
    });
  }
}
