import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type HierarchyEmployee = {
  id: number;
  employeeID: string | null;
  employeeFirstName: string | null;
  employeeLastName: string | null;
  employeePhotoUrl: string | null;
  branchesID: number | null;
  departmentNameID: number | null;
  designationID: number | null;
  branchName: string | null;
  departmentName: string | null;
  designationName: string | null;
  managerIds: number[];
  reporteeIds: number[];
  isTopLevel: boolean;
};

export type HierarchyNode = {
  employee: HierarchyEmployee;
  children: HierarchyNode[];
};

@Injectable()
export class CompanyHierarchyService {
  constructor(private prisma: PrismaService) {}

  async getHierarchy(companyID: number) {
    if (!Number.isFinite(companyID) || companyID <= 0) {
      throw new BadRequestException('companyID is required');
    }

    const employees = await this.prisma.manageEmployee.findMany({
      where: {
        companyID,
        isDeleted: false,
        lifecycleStatus: 'ACTIVE',
      },
      select: {
        id: true,
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        employeePhotoUrl: true,
        branchesID: true,
        departmentNameID: true,
        designationID: true,
        branches: { select: { branchName: true } },
        departments: { select: { departmentName: true } },
        designations: { select: { designation: true } },
      },
      orderBy: [{ employeeFirstName: 'asc' }, { employeeLastName: 'asc' }],
    });

    const links = await this.prisma.employeeLink.findMany({
      where: {
        OR: [
          { employeeId: { in: employees.map((e) => e.id) } },
          { linkedEmployeeId: { in: employees.map((e) => e.id) } },
        ],
      },
      select: { employeeId: true, linkedEmployeeId: true },
    });

    const managersByEmployee = new Map<number, number[]>();
    const reporteesByManager = new Map<number, number[]>();
    for (const link of links) {
      const empId = Number(link.employeeId);
      const mgrId = Number(link.linkedEmployeeId);
      if (!managersByEmployee.has(empId)) managersByEmployee.set(empId, []);
      managersByEmployee.get(empId)!.push(mgrId);
      if (!reporteesByManager.has(mgrId)) reporteesByManager.set(mgrId, []);
      reporteesByManager.get(mgrId)!.push(empId);
    }

    const byId = new Map<number, HierarchyEmployee>();
    for (const e of employees) {
      const managerIds = [...new Set(managersByEmployee.get(e.id) ?? [])];
      const reporteeIds = [...new Set(reporteesByManager.get(e.id) ?? [])];
      const missingOrg = e.branchesID == null || e.departmentNameID == null;
      byId.set(e.id, {
        id: e.id,
        employeeID: e.employeeID,
        employeeFirstName: e.employeeFirstName,
        employeeLastName: e.employeeLastName,
        employeePhotoUrl: e.employeePhotoUrl,
        branchesID: e.branchesID,
        departmentNameID: e.departmentNameID,
        designationID: e.designationID,
        branchName: e.branches?.branchName ?? null,
        departmentName: e.departments?.departmentName ?? null,
        designationName: e.designations?.designation ?? null,
        managerIds,
        reporteeIds,
        // Top-level: no manager, OR missing branch and/or department
        isTopLevel: managerIds.length === 0 || missingOrg,
      });
    }

    const visited = new Set<number>();
    const buildNode = (id: number): HierarchyNode | null => {
      if (visited.has(id)) return null; // cycle guard
      const emp = byId.get(id);
      if (!emp) return null;
      visited.add(id);
      const children = (emp.reporteeIds || [])
        .map((childId) => buildNode(childId))
        .filter((n): n is HierarchyNode => n != null)
        .sort((a, b) => {
          const an = `${a.employee.employeeFirstName ?? ''} ${a.employee.employeeLastName ?? ''}`.trim();
          const bn = `${b.employee.employeeFirstName ?? ''} ${b.employee.employeeLastName ?? ''}`.trim();
          return an.localeCompare(bn);
        });
      return { employee: emp, children };
    };

    // Prefer roots with no manager; also force missing-org employees to top.
    const rootIds = [
      ...new Set(
        [...byId.values()]
          .filter((e) => e.isTopLevel)
          .map((e) => e.id),
      ),
    ];

    const roots = rootIds
      .map((id) => buildNode(id))
      .filter((n): n is HierarchyNode => n != null);

    // Orphans not reached from any root (edge cases) — append as roots
    for (const id of byId.keys()) {
      if (!visited.has(id)) {
        const node = buildNode(id);
        if (node) roots.push(node);
      }
    }

    const departments = await this.prisma.departments.findMany({
      where: { companyID },
      select: {
        id: true,
        departmentName: true,
        parentDepartmentID: true,
        departmentBranches: {
          select: { branchesID: true, branches: { select: { id: true, branchName: true } } },
        },
      },
      orderBy: { departmentName: 'asc' },
    });

    const designations = await this.prisma.designations.findMany({
      where: { companyID },
      select: {
        id: true,
        designation: true,
        departmentID: true,
        parentDesignationID: true,
      },
      orderBy: { designation: 'asc' },
    });

    return {
      companyID,
      roots,
      totals: {
        employees: employees.length,
        roots: roots.length,
        departments: departments.length,
        designations: designations.length,
      },
      departments,
      designations,
    };
  }
}
