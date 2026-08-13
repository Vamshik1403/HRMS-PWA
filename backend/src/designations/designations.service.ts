import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDesignationsDto } from './dto/create-designation.dto';
import { UpdateDesignationsDto } from './dto/update-designation.dto';

@Injectable()
export class DesignationsService {
  constructor(private prisma: PrismaService) {}

  private async assertParentSameCompany(
    companyID: number | null | undefined,
    parentDesignationID: number | null | undefined,
  ) {
    if (!parentDesignationID) return;
    const parent = await this.prisma.designations.findUnique({
      where: { id: parentDesignationID },
      select: { id: true, companyID: true },
    });
    if (!parent) throw new BadRequestException('Parent designation not found');
    if (companyID && parent.companyID && parent.companyID !== companyID) {
      throw new BadRequestException('Parent designation must belong to the same company');
    }
  }

  async create(data: CreateDesignationsDto) {
    await this.assertParentSameCompany(data.companyID, data.parentDesignationID);
    return this.prisma.designations.create({
      data: {
        ...data,
        departmentID: data.departmentID ?? null,
        parentDesignationID: data.parentDesignationID ?? null,
      },
      include: {
        department: { select: { id: true, departmentName: true } },
        parentDesignation: { select: { id: true, designation: true } },
        branches: true,
        company: true,
      },
    });
  }

  findAllForList() {
    return this.prisma.designations.findMany({
      select: {
        id: true,
        designation: true,
        serviceProviderID: true,
        companyID: true,
        branchesID: true,
        departmentID: true,
        parentDesignationID: true,
        shiftEligibility: true,
        nightShiftEligibility: true,
        maxHoursPerDay: true,
        weeklyOffPattern: true,
        noticePeriodDaysForResignation: true,
        noticePeriodDaysForTermination: true,
        branches: { select: { id: true, branchName: true } },
        company: { select: { id: true, companyName: true } },
        serviceProvider: { select: { id: true, companyName: true } },
        department: { select: { id: true, departmentName: true } },
        parentDesignation: { select: { id: true, designation: true } },
      },
      orderBy: { id: 'desc' },
    });
  }

  findAll() {
    return this.prisma.designations.findMany({
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
        department: { select: { id: true, departmentName: true } },
        parentDesignation: { select: { id: true, designation: true } },
      },
    });
  }

  findOne(id: number) {
    return this.prisma.designations.findUnique({
      where: { id },
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
        department: { select: { id: true, departmentName: true } },
        parentDesignation: { select: { id: true, designation: true } },
        childDesignations: { select: { id: true, designation: true } },
      },
    });
  }

  async update(id: number, data: UpdateDesignationsDto) {
    const companyID =
      data.companyID !== undefined
        ? data.companyID
        : (
            await this.prisma.designations.findUnique({
              where: { id },
              select: { companyID: true },
            })
          )?.companyID;
    if (data.parentDesignationID != null && Number(data.parentDesignationID) === Number(id)) {
      throw new BadRequestException('Designation cannot be its own parent');
    }
    await this.assertParentSameCompany(companyID, data.parentDesignationID);
    return this.prisma.designations.update({
      where: { id },
      data,
      include: {
        department: { select: { id: true, departmentName: true } },
        parentDesignation: { select: { id: true, designation: true } },
        branches: true,
        company: true,
      },
    });
  }

  remove(id: number) {
    return this.prisma.designations.delete({ where: { id } });
  }
}
