import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeHolidayOverrideDto } from './dto/create-employee-holiday-override.dto';
import { UpdateEmployeeHolidayOverrideDto } from './dto/update-employee-holiday-override.dto';

@Injectable()
export class EmployeeHolidayOverrideService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateEmployeeHolidayOverrideDto) {
    return this.prisma.employeeHolidayOverride.create({
      data: {
        serviceProviderID: dto.serviceProviderID,
        companyID: dto.companyID,
        branchesID: dto.branchesID,
        employeeID: dto.employeeID,
        holidayId: dto.holidayId,
        fromDate: new Date(dto.fromDate),
        toDate: new Date(dto.toDate),
        reason: dto.reason,
      },
      include: {
        manageEmployee: true,
        publicHoliday: { include: { manageHoliday: true } },
      },
    });
  }

  async findAll() {
    return this.prisma.employeeHolidayOverride.findMany({
      include: {
        manageEmployee: true,
        publicHoliday: { include: { manageHoliday: true } },
      },
    });
  }

  async findOne(id: number) {
    const record = await this.prisma.employeeHolidayOverride.findUnique({
      where: { id },
      include: {
        manageEmployee: true,
        publicHoliday: { include: { manageHoliday: true } },
      },
    });
    if (!record) {
      throw new NotFoundException(`Employee holiday override #${id} not found`);
    }
    return record;
  }

  async findByEmployee(employeeID: number) {
    return this.prisma.employeeHolidayOverride.findMany({
      where: { employeeID },
      include: {
        manageEmployee: true,
        publicHoliday: { include: { manageHoliday: true } },
      },
    });
  }

  async update(id: number, dto: UpdateEmployeeHolidayOverrideDto) {
    await this.findOne(id);
    return this.prisma.employeeHolidayOverride.update({
      where: { id },
      data: {
        ...dto,
        fromDate: dto.fromDate ? new Date(dto.fromDate) : undefined,
        toDate: dto.toDate ? new Date(dto.toDate) : undefined,
      },
      include: {
        manageEmployee: true,
        publicHoliday: { include: { manageHoliday: true } },
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.employeeHolidayOverride.delete({
      where: { id },
    });
  }
}
