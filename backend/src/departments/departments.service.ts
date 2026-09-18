import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentsDto } from './dto/create-department.dto';
import { UpdateDepartmentsDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  private async syncBranches(departmentID: number, branchIDs?: number[], fallbackBranchID?: number | null) {
    const ids = [
      ...new Set(
        (branchIDs?.length ? branchIDs : fallbackBranchID ? [fallbackBranchID] : [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];

    await this.prisma.departmentBranch.deleteMany({ where: { departmentID } });
    if (ids.length) {
      await this.prisma.departmentBranch.createMany({
        data: ids.map((branchesID) => ({ departmentID, branchesID })),
        skipDuplicates: true,
      });
    }

    // Keep legacy branchesID in sync with first mapped branch (or null).
    await this.prisma.departments.update({
      where: { id: departmentID },
      data: { branchesID: ids[0] ?? null },
    });
  }

  async create(data: CreateDepartmentsDto) {
    const { branchIDs, parentDepartmentID, ...rest } = data;
    if (parentDepartmentID) {
      const parent = await this.prisma.departments.findUnique({
        where: { id: parentDepartmentID },
        select: { id: true, companyID: true },
      });
      if (!parent) throw new BadRequestException('Parent department not found');
      if (rest.companyID && parent.companyID && parent.companyID !== rest.companyID) {
        throw new BadRequestException('Parent department must belong to the same company');
      }
    }

    const created = await this.prisma.departments.create({
      data: {
        ...rest,
        parentDepartmentID: parentDepartmentID ?? null,
      },
    });
    await this.syncBranches(created.id, branchIDs, rest.branchesID ?? null);
    return this.findOne(created.id);
  }

  findAll() {
    return this.prisma.departments.findMany({
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
        parentDepartment: { select: { id: true, departmentName: true } },
        departmentBranches: {
          include: { branches: { select: { id: true, branchName: true } } },
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  async findAllWithHeadcount(companyID?: number) {
    const depts = await this.prisma.departments.findMany({
      where: companyID ? { companyID } : undefined,
      select: {
        id: true,
        departmentName: true,
        companyID: true,
        branchesID: true,
        parentDepartmentID: true,
      },
    });
    const counts = await this.prisma.manageEmployee.groupBy({
      by: ['departmentNameID'],
      where: {
        isDeleted: false,
        departmentNameID: { not: null },
        ...(companyID ? { companyID } : {}),
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
      parentDepartmentID: d.parentDepartmentID,
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
        parentDepartment: { select: { id: true, departmentName: true } },
        departmentBranches: {
          include: { branches: { select: { id: true, branchName: true } } },
        },
        childDepartments: { select: { id: true, departmentName: true } },
      },
    });
  }

  async update(id: number, data: UpdateDepartmentsDto) {
    const { branchIDs, parentDepartmentID, ...rest } = data as CreateDepartmentsDto & UpdateDepartmentsDto;
    if (parentDepartmentID != null && Number(parentDepartmentID) === Number(id)) {
      throw new BadRequestException('Department cannot be its own parent');
    }
    if (parentDepartmentID) {
      const parent = await this.prisma.departments.findUnique({
        where: { id: parentDepartmentID },
        select: { id: true, companyID: true },
      });
      if (!parent) throw new BadRequestException('Parent department not found');
    }

    await this.prisma.departments.update({
      where: { id },
      data: {
        ...rest,
        ...(parentDepartmentID !== undefined ? { parentDepartmentID: parentDepartmentID ?? null } : {}),
      },
    });

    if (branchIDs !== undefined || rest.branchesID !== undefined) {
      await this.syncBranches(id, branchIDs, rest.branchesID ?? null);
    }

    return this.findOne(id);
  }

  remove(id: number) {
    return this.prisma.departments.delete({ where: { id } });
  }
}
