import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFactualAttendancePolicyDto } from './dto/create-factual-attendance-policy.dto';
import { UpdateFactualAttendancePolicyDto } from './dto/update-factual-attendance-policy.dto';

@Injectable()
export class FactualAttendancePolicyService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateFactualAttendancePolicyDto) {
    return this.prisma.factualAttendancePolicy.create({ data: dto as any });
  }

  async findAll(query: {
    serviceProviderID?: number;
    companyID?: number;
    branchesID?: number;
  }) {
    const where: any = {};
    if (query.serviceProviderID) where.serviceProviderID = Number(query.serviceProviderID);
    if (query.companyID) where.companyID = Number(query.companyID);
    if (query.branchesID) where.branchesID = Number(query.branchesID);
    return this.prisma.factualAttendancePolicy.findMany({ where, orderBy: { id: 'desc' } });
  }

  async findOne(id: number) {
    const policy = await this.prisma.factualAttendancePolicy.findUnique({ where: { id } });
    if (!policy) throw new NotFoundException(`FactualAttendancePolicy #${id} not found`);
    return policy;
  }

  async update(id: number, dto: UpdateFactualAttendancePolicyDto) {
    await this.findOne(id);
    return this.prisma.factualAttendancePolicy.update({ where: { id }, data: dto as any });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.factualAttendancePolicy.delete({ where: { id } });
    return { message: `FactualAttendancePolicy #${id} deleted` };
  }
}
