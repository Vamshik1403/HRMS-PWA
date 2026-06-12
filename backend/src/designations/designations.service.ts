import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDesignationsDto } from './dto/create-designation.dto';
import { UpdateDesignationsDto } from './dto/update-designation.dto';

@Injectable()
export class DesignationsService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateDesignationsDto) {
    return this.prisma.designations.create({ data });
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
        shiftEligibility: true,
        nightShiftEligibility: true,
        maxHoursPerDay: true,
        weeklyOffPattern: true,
        noticePeriodDaysForResignation: true,
        noticePeriodDaysForTermination: true,
        branches: { select: { id: true, branchName: true } },
        departments: { select: { id: true, departmentName: true } },
        company: { select: { id: true, companyName: true } },
        serviceProvider: { select: { id: true, companyName: true } },
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
        departments: true,
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
        departments: true,
      },
    });
  }

  update(id: number, data: UpdateDesignationsDto) {
    return this.prisma.designations.update({
      where: { id },
      data,
    });
  }

  remove(id: number) {
    return this.prisma.designations.delete({ where: { id } });
  }
}
