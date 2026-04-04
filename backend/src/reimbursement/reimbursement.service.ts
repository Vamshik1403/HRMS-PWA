import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateReimbursementDto } from './dto/create-reimbursement.dto';
import { UpdateReimbursementDto } from './dto/update-reimbursement.dto';

@Injectable()
export class ReimbursementService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.findOne(created.id);
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
    return this.prisma.reimbursement.findMany({
      where: { manageEmployeeID: empId },
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
    const { items, ...parent } = dto;

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
            })),
          });
        }
      }
    });

    return this.findOne(id);
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

    return this.prisma.reimbursement.update({
      where: { id },
      data: {
        ...approvalData,
        status: approvalData.status ?? 'Approved', // Default to 'Approved' when updating approval
      },
      include: this.includeRels(),
    });
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

  /** ─────────────── UTILS ─────────────── */
  private async ensureExists(id: number) {
    const ok = await this.prisma.reimbursement.findUnique({ where: { id } });
    if (!ok) throw new NotFoundException(`Reimbursement id ${id} not found`);
  }
}