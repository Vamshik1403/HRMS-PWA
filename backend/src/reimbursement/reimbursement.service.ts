import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReimbursementDto } from './dto/create-reimbursement.dto';
import { UpdateReimbursementDto } from './dto/update-reimbursement.dto';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { MailService } from '../mail/mail.service';
import { EmpManagerScopeService } from '../common/emp-manager-scope.service';
import {
  reimbursementPushTitle,
  senderLabelFromRole,
} from '../common/notification-sender.util';

@Injectable()
export class ReimbursementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushNotificationsService,
    private readonly mailService: MailService,
    private readonly managerScope: EmpManagerScopeService,
  ) {}

  /** Include all necessary relations in queries */
  private includeRels() {
    return {
      company: true,
      branches: true,
      serviceProvider: true,
      manageEmployee: true,
      items: true, // include child line-items
    };
  }

  /** ─────────────── CREATE ─────────────── */
  async create(dto: CreateReimbursementDto) {
    const { items = [], ...parent } = dto;

    // Create parent reimbursement record
    const created = await this.prisma.reimbursement.create({
      data: {
        ...parent,
        // Ensure payment fields are included
        paymentMode: parent.paymentMode ?? null,
        paymentType: parent.paymentType ?? null,
        paymentDate: parent.paymentDate ?? null,
        paymentRemark: parent.paymentRemark ?? null,
        paymentProof: parent.paymentProof ?? null,
      },
      include: this.includeRels(),
    });

    // If line items exist, create them linked to reimbursementID
    if (items.length) {
      await this.prisma.reimbursementItem.createMany({
        data: items.map((i) => ({
          reimbursementID: created.id,
          reimbursementType: i.reimbursementType ?? null,
          amount: i.amount ?? null,
          description: i.description ?? null,
        })),
      });
    }

    const full = await this.findOne(created.id);
    if (full?.manageEmployeeID) {
      const total = (full.items ?? []).reduce(
        (s, i) => s + (Number(i.amount) || 0),
        0,
      );
      void this.mailService.sendToEmployeeWithManagerCc({
        employeeId: full.manageEmployeeID,
        companyID: full.companyID,
        eventType: 'REIMBURSEMENT',
        vars: {
          status: String(full.status ?? 'Submitted'),
          amount: String(total),
        },
      });
    }
    return full;
  }

  /** Bulk create multiple parent reimbursements */
  async createMany(dtos: CreateReimbursementDto[]) {
    return this.prisma.reimbursement.createMany({ 
      data: dtos.map(dto => ({
        ...dto,
        paymentMode: dto.paymentMode ?? null,
        paymentType: dto.paymentType ?? null,
        paymentDate: dto.paymentDate ?? null,
        paymentRemark: dto.paymentRemark ?? null,
        paymentProof: dto.paymentProof ?? null,
      }))
    });
  }

  /** ─────────────── READ ─────────────── */
  async findAll() {
    return this.prisma.reimbursement.findMany({
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

  

  async findOne(id: number) {
    const rec = await this.prisma.reimbursement.findUnique({
      where: { id },
      include: this.includeRels(),
    });
    if (!rec) throw new NotFoundException(`Reimbursement id ${id} not found`);
    return rec;
  }

  async findByEmployee(empId: number) {
    const scopeIds = await this.managerScope.getReporteeIds(empId);
    return this.prisma.reimbursement.findMany({
      where: { manageEmployeeID: { in: scopeIds } },
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

  async findByCompany(companyID: number) {
    return this.prisma.reimbursement.findMany({
      where: { companyID },
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

  // NEW: Find reimbursements by status
  async findByStatus(status: string) {
    return this.prisma.reimbursement.findMany({
      where: { status },
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

  // NEW: Find reimbursements by approval type
  async findByApprovalType(approvalType: string) {
    return this.prisma.reimbursement.findMany({
      where: { approvalType },
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

  /** ─────────────── UPDATE ─────────────── */
  async update(id: number, dto: UpdateReimbursementDto) {
    const { items, actorRole, ...parent } = dto;
    const actorLabel = actorRole ? senderLabelFromRole(actorRole) : undefined;

    const before = await this.prisma.reimbursement.findUnique({
      where: { id },
      select: { status: true, manageEmployeeID: true },
    });

    await this.ensureExists(id);

    // Transaction ensures parent & items stay consistent
    await this.prisma.$transaction(async (tx) => {
      // Update parent reimbursement with payment fields
      await tx.reimbursement.update({
        where: { id },
        data: {
          ...parent,
          // Ensure payment fields are included in update
          paymentMode: parent.paymentMode ?? null,
          paymentType: parent.paymentType ?? null,
          paymentDate: parent.paymentDate ?? null,
          paymentRemark: parent.paymentRemark ?? null,
          paymentProof: parent.paymentProof ?? null,
        },
      });

      // If items array provided, replace all existing line items
      if (items) {
        await tx.reimbursementItem.deleteMany({ where: { reimbursementID: id } });
        if (items.length) {
          await tx.reimbursementItem.createMany({
            data: items.map((i) => ({
              reimbursementID: id,
              reimbursementType: i.reimbursementType ?? null,
              amount: i.amount ?? null,
              description: i.description ?? null,
              status: i.status ?? 'Pending',
              approvalType: i.approvalType ?? null,
              paidStatus: i.paidStatus ?? null,
              paymentRemark: i.paymentRemark ?? null,
            })),
          });
        }
      }
    });

    const updated = await this.findOne(id);
    if (
      parent.status === 'Rejected' &&
      before?.status !== 'Rejected' &&
      (updated as any).manageEmployeeID
    ) {
      this.pushService
        .sendToEmployeeAndManagers(
          (updated as any).manageEmployeeID,
          reimbursementPushTitle('Rejected', actorLabel),
          'Your reimbursement claim has been rejected.',
          { url: '/empReimbursement', kind: 'reimbursement' },
        )
        .catch(() => null);
    }
    return updated;
  }

  // NEW: Update payment details specifically
  async updatePayment(id: number, paymentData: {
    paymentMode?: string;
    paymentType?: string;
    paymentDate?: string;
    paymentRemark?: string;
    paymentProof?: string;
    status?: string;
  }) {
    await this.ensureExists(id);

    return this.prisma.reimbursement.update({
      where: { id },
      data: {
        ...paymentData,
        status: paymentData.status ?? 'Paid', // Default to 'Paid' when updating payment
      },
      include: this.includeRels(),
    });
  }

  // NEW: Update approval details specifically
  async updateApproval(id: number, approvalData: {
    approvalType?: string;
    salaryPeriod?: string;
    voucherCode?: string;
    voucherDate?: string;
    status?: string;
  }) {
    await this.ensureExists(id);

    const updated = await this.prisma.reimbursement.update({
      where: { id },
      data: {
        ...approvalData,
        status: approvalData.status ?? 'Approved', // Default to 'Approved' when updating approval
      },
      include: this.includeRels(),
    });

    if ((updated as any).manageEmployeeID) {
      this.pushService.sendToEmployeeAndManagers(
        (updated as any).manageEmployeeID,
        reimbursementPushTitle('Approved'),
        'Your reimbursement request has been approved.',
        { url: '/empReimbursement', kind: 'reimbursement' },
      ).catch(() => null);
    }

    return updated;
  }

  /** ─────────────── DELETE ─────────────── */
  async remove(id: number) {
    await this.ensureExists(id);

    // Delete child items first, then parent
    await this.prisma.reimbursementItem.deleteMany({
      where: { reimbursementID: id },
    });

    return this.prisma.reimbursement.delete({
      where: { id },
      include: this.includeRels(),
    });
  }

  /** Approve a single reimbursement line (voucher only for now). */
  async approveItem(reimbursementID: number, itemId: number, actorRole?: string) {
    const actorLabel = actorRole ? senderLabelFromRole(actorRole) : undefined;
    await this.ensureExists(reimbursementID);
    const item = await this.prisma.reimbursementItem.findFirst({
      where: { id: itemId, reimbursementID },
    });
    if (!item) throw new NotFoundException(`Item ${itemId} not found`);

    await this.prisma.reimbursementItem.update({
      where: { id: itemId },
      data: {
        status: 'Approved',
        approvalType: 'Voucher',
        paidStatus: 'Unpaid',
      },
    });

    const rec = await this.syncParentStatus(reimbursementID);
    if ((rec as any).manageEmployeeID) {
      this.pushService
        .sendToEmployeeAndManagers(
          (rec as any).manageEmployeeID,
          reimbursementPushTitle('Approved', actorLabel),
          'An item on your reimbursement request has been approved.',
          { url: '/empReimbursement', kind: 'reimbursement' },
        )
        .catch(() => null);
    }
    return rec;
  }

  /** Reject a single reimbursement line. */
  async rejectItem(reimbursementID: number, itemId: number, actorRole?: string) {
    const actorLabel = actorRole ? senderLabelFromRole(actorRole) : undefined;
    await this.ensureExists(reimbursementID);
    const item = await this.prisma.reimbursementItem.findFirst({
      where: { id: itemId, reimbursementID },
    });
    if (!item) throw new NotFoundException(`Item ${itemId} not found`);

    await this.prisma.reimbursementItem.update({
      where: { id: itemId },
      data: { status: 'Rejected', paidStatus: null, paymentRemark: null },
    });

    const rec = await this.syncParentStatus(reimbursementID);
    if ((rec as any).manageEmployeeID) {
      this.pushService
        .sendToEmployeeAndManagers(
          (rec as any).manageEmployeeID,
          reimbursementPushTitle('Rejected', actorLabel),
          'An item on your reimbursement request has been rejected.',
          { url: '/empReimbursement', kind: 'reimbursement' },
        )
        .catch(() => null);
    }
    return rec;
  }

  /** Mark item paid/unpaid; remark required when marking paid. */
  async updateItemPayment(
    reimbursementID: number,
    itemId: number,
    body: { paidStatus: string; paymentRemark?: string },
  ) {
    await this.ensureExists(reimbursementID);
    const item = await this.prisma.reimbursementItem.findFirst({
      where: { id: itemId, reimbursementID },
    });
    if (!item) throw new NotFoundException(`Item ${itemId} not found`);
    if (item.status !== 'Approved') {
      throw new NotFoundException('Only approved items can be marked paid');
    }

    const paidStatus = body.paidStatus === 'Paid' ? 'Paid' : 'Unpaid';
    await this.prisma.reimbursementItem.update({
      where: { id: itemId },
      data: {
        paidStatus,
        paymentRemark:
          paidStatus === 'Paid' ? body.paymentRemark ?? null : null,
      },
    });

    const rec = await this.syncParentStatus(reimbursementID);
    if (paidStatus === 'Paid' && (rec as any).manageEmployeeID) {
      this.pushService
        .sendToEmployeeAndManagers(
          (rec as any).manageEmployeeID,
          'Reimbursement Paid',
          body.paymentRemark?.trim()
            ? `Reimbursement paid: ${body.paymentRemark.trim()}`
            : 'Your reimbursement has been marked as paid.',
          { url: '/empReimbursement', kind: 'reimbursement' },
        )
        .catch(() => null);
    }
    return rec;
  }

  private async syncParentStatus(reimbursementID: number) {
    const items = await this.prisma.reimbursementItem.findMany({
      where: { reimbursementID },
    });
    const statuses = items.map((i) => i.status || 'Pending');

    let status = 'Pending';
    let approvalType: string | null = null;

    if (items.length === 0) {
      status = 'Pending';
    } else if (statuses.every((s) => s === 'Rejected')) {
      status = 'Rejected';
    } else if (statuses.every((s) => s === 'Approved' || s === 'Rejected')) {
      status = statuses.some((s) => s === 'Rejected')
        ? 'Partially Approved'
        : 'Approved';
      if (statuses.some((s) => s === 'Approved')) {
        approvalType = 'Voucher';
      }
    } else if (
      statuses.some((s) => s === 'Approved' || s === 'Rejected')
    ) {
      status = 'Partially Approved';
      if (statuses.some((s) => s === 'Approved')) {
        approvalType = 'Voucher';
      }
    }

    const approvedItems = items.filter((i) => i.status === 'Approved');
    if (
      approvedItems.length > 0 &&
      approvedItems.every((i) => i.paidStatus === 'Paid')
    ) {
      status = 'Paid';
    }

    await this.prisma.reimbursement.update({
      where: { id: reimbursementID },
      data: {
        status,
        approvalType: approvalType ?? undefined,
      },
    });

    return this.findOne(reimbursementID);
  }

  /** ─────────────── UTILS ─────────────── */
  private async ensureExists(id: number) {
    const ok = await this.prisma.reimbursement.findUnique({ where: { id } });
    if (!ok) throw new NotFoundException(`Reimbursement id ${id} not found`);
  }
}