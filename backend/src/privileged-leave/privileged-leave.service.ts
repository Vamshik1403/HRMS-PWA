import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrivilegedLeaveDto } from './dto/create-privileged-leave.dto';
import { UpdatePrivilegedLeaveDto } from './dto/update-privileged-leave.dto';

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
}
