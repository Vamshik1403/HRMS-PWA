import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeWeeklyOffDto } from './dto/create-employee-weekly-off.dto';
import { UpdateEmployeeWeeklyOffDto } from './dto/update-employee-weekly-off.dto';

@Injectable()
export class EmployeeWeeklyOffService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateEmployeeWeeklyOffDto) {
    return this.prisma.employeeWeeklyOff.create({
      data: {
        serviceProviderID: dto.serviceProviderID,
        companyID: dto.companyID,
        branchesID: dto.branchesID,
        employeeID: dto.employeeID,
        date: new Date(dto.date),
      },
      include: {
        manageEmployee: true,
      },
    });
  }

  async findAll() {
    return this.prisma.employeeWeeklyOff.findMany({
      include: {
        manageEmployee: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: number) {
    const record = await this.prisma.employeeWeeklyOff.findUnique({
      where: { id },
      include: {
        manageEmployee: true,
      },
    });
    if (!record) {
      throw new NotFoundException(`Employee weekly off #${id} not found`);
    }
    return record;
  }

  async findByEmployee(employeeID: number) {
    return this.prisma.employeeWeeklyOff.findMany({
      where: { employeeID },
      include: {
        manageEmployee: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async update(id: number, dto: UpdateEmployeeWeeklyOffDto) {
    await this.findOne(id);
    return this.prisma.employeeWeeklyOff.update({
      where: { id },
      data: {
        ...dto,
        date: dto.date ? new Date(dto.date) : undefined,
      },
      include: {
        manageEmployee: true,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.employeeWeeklyOff.delete({
      where: { id },
    });
  }
}
