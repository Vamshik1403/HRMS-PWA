import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentsDto } from './dto/create-department.dto';
import { UpdateDepartmentsDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateDepartmentsDto) {
    return this.prisma.departments.create({ data });
  }

  findAll() {
    return this.prisma.departments.findMany({
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
      },
    });
  }

  /** Departments with active employee counts (primary departmentNameID on ManageEmployee). */
  async findAllWithHeadcount() {
    const depts = await this.prisma.departments.findMany({
      select: {
        id: true,
        departmentName: true,
        companyID: true,
        branchesID: true,
      },
    });
    const counts = await this.prisma.manageEmployee.groupBy({
      by: ['departmentNameID'],
      where: {
        isDeleted: false,
        departmentNameID: { not: null },
      },
      _count: { id: true },
    });
    const countMap = new Map(
      counts
        .filter((c) => c.departmentNameID != null)
        .map((c) => [c.departmentNameID as number, c._count.id]),
    );
    return depts.map((d) => ({
      id: d.id,
      departmentName: d.departmentName ?? 'Unnamed',
      companyID: d.companyID,
      branchesID: d.branchesID,
      employeeCount: countMap.get(d.id) ?? 0,
    }));
  }

  findOne(id: number) {
    return this.prisma.departments.findUnique({
      where: { id },
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
      },
    });
  }

  update(id: number, data: UpdateDepartmentsDto) {
    return this.prisma.departments.update({
      where: { id },
      data,
    });
  }

  remove(id: number) {
    return this.prisma.departments.delete({ where: { id } });
  }
}
