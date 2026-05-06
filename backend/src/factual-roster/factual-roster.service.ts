import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFactualRosterDto } from './dto/create-factual-roster.dto';
import { UpdateFactualRosterDto } from './dto/update-factual-roster.dto';

@Injectable()
export class FactualRosterService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateFactualRosterDto) {
    return this.prisma.factualRoster.create({
      data: {
        serviceProviderID: dto.serviceProviderID,
        companyID: dto.companyID,
        branchesID: dto.branchesID,
        departmentID: dto.departmentID,
        designationID: dto.designationID,
        fromDate: new Date(dto.fromDate),
        toDate: new Date(dto.toDate),
        rosterPeriod: dto.rosterPeriod || '',
        createdBy: dto.createdBy || 0,
      },
    });
  }

  async findAll(query: {
    serviceProviderID?: number;
    companyID?: number;
    branchesID?: number;
    departmentID?: number;
  }) {
    const where: any = {};
    if (query.serviceProviderID) where.serviceProviderID = Number(query.serviceProviderID);
    if (query.companyID) where.companyID = Number(query.companyID);
    if (query.branchesID) where.branchesID = Number(query.branchesID);
    if (query.departmentID) where.departmentID = Number(query.departmentID);

    return this.prisma.factualRoster.findMany({
      where,
      include: {
        employees: {
          include: {
            days: {
              include: { factualWorkShift: true },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const roster = await this.prisma.factualRoster.findUnique({
      where: { id },
      include: {
        employees: {
          include: {
            days: {
              include: { factualWorkShift: true },
            },
          },
        },
      },
    });
    if (!roster) throw new NotFoundException(`FactualRoster #${id} not found`);
    return roster;
  }

  async update(id: number, dto: UpdateFactualRosterDto) {
    await this.findOne(id);
    const data: any = {};
    if (dto.serviceProviderID !== undefined) data.serviceProviderID = dto.serviceProviderID;
    if (dto.companyID !== undefined) data.companyID = dto.companyID;
    if (dto.branchesID !== undefined) data.branchesID = dto.branchesID;
    if (dto.departmentID !== undefined) data.departmentID = dto.departmentID;
    if (dto.designationID !== undefined) data.designationID = dto.designationID;
    if (dto.fromDate !== undefined) data.fromDate = new Date(dto.fromDate);
    if (dto.toDate !== undefined) data.toDate = new Date(dto.toDate);
    if (dto.rosterPeriod !== undefined) data.rosterPeriod = dto.rosterPeriod;
    return this.prisma.factualRoster.update({ where: { id }, data });
  }

  async updateStatus(id: number, status: string) {
    await this.findOne(id);
    return this.prisma.factualRoster.update({ where: { id }, data: { status } });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.factualRoster.delete({ where: { id } });
    return { message: `FactualRoster #${id} deleted` };
  }
}
