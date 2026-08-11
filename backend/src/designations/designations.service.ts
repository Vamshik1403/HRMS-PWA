import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDesignationsDto } from './dto/create-designation.dto';
import { UpdateDesignationsDto } from './dto/update-designation.dto';

@Injectable()
export class DesignationsService {
  constructor(private prisma: PrismaService) {}

  private async assertParentSameDepartment(
    departmentID: number | null | undefined,
    parentDesignationID: number | null | undefined,
  ) {
    if (!parentDesignationID) return;
    const parent = await this.prisma.designations.findUnique({
      where: { id: parentDesignationID },
      select: { id: true, departmentID: true },
    });
    if (!parent) throw new BadRequestException('Parent designation not found');
    if (departmentID && parent.departmentID && parent.departmentID !== departmentID) {
      throw new BadRequestException('Parent designation must belong to the same department');
    }
  }

  async create(data: CreateDesignationsDto) {
    await this.assertParentSameDepartment(data.departmentID, data.parentDesignationID);
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
    const departmentID =
      data.departmentID !== undefined
        ? data.departmentID
        : (
            await this.prisma.designations.findUnique({
              where: { id },
              select: { departmentID: true },
            })
          )?.departmentID;
    if (data.parentDesignationID != null && Number(data.parentDesignationID) === Number(id)) {
      throw new BadRequestException('Designation cannot be its own parent');
    }
    await this.assertParentSameDepartment(departmentID, data.parentDesignationID);
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
