import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type HierarchyEmployee = {
  id: number;
  employeeID: string | null;
  employeeFirstName: string | null;
  employeeLastName: string | null;
  employeePhotoUrl: string | null;
  businessEmail: string | null;
  personalEmail: string | null;
  businessPhoneNo: string | null;
  personalPhoneNo: string | null;
  joiningDate: string | null;
  employmentStatus: string | null;
  branchesID: number | null;
  departmentNameID: number | null;
  designationID: number | null;
  branchName: string | null;
  departmentName: string | null;
  designationName: string | null;
  managerIds: number[];
  reporteeIds: number[];
  isCompanyOwner: boolean;
  isL1: boolean;
};

export type EmployeeTreeNode = {
  employee: HierarchyEmployee;
  children: EmployeeTreeNode[];
};

export type DepartmentTreeNode = {
  id: number;
  departmentName: string | null;
  parentDepartmentID: number | null;
  level: number;
  branches: { id: number; branchName: string | null }[];
  employeeCount: number;
  employees: HierarchyEmployee[];
  children: DepartmentTreeNode[];
};

@Injectable()
export class CompanyHierarchyService {
  constructor(private prisma: PrismaService) {}

  async getHierarchy(companyID: number) {
    if (!Number.isFinite(companyID) || companyID <= 0) {
      throw new BadRequestException('companyID is required');
    }

    const [company, employees, departments] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyID },
        select: { id: true, companyName: true, companyLogoUrl: true },
      }),
      this.prisma.manageEmployee.findMany({
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
          businessEmail: true,
          personalEmail: true,
          businessPhoneNo: true,
          personalPhoneNo: true,
          joiningDate: true,
          employmentStatus: true,
          branchesID: true,
          departmentNameID: true,
          designationID: true,
          isCompanyOwner: true,
          branches: { select: { branchName: true } },
          departments: { select: { departmentName: true } },
          designations: { select: { designation: true } },
        },
        orderBy: [{ id: 'asc' }, { employeeFirstName: 'asc' }],
      }),
      this.prisma.departments.findMany({
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
      }),
    ]);

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
      const isL1 =
        Boolean(e.isCompanyOwner) ||
        (e.designationID != null && e.departmentNameID == null);
      byId.set(e.id, {
        id: e.id,
        employeeID: e.employeeID,
        employeeFirstName: e.employeeFirstName,
        employeeLastName: e.employeeLastName,
        employeePhotoUrl: e.employeePhotoUrl,
        businessEmail: e.businessEmail,
        personalEmail: e.personalEmail,
        businessPhoneNo: e.businessPhoneNo,
        personalPhoneNo: e.personalPhoneNo,
        joiningDate: e.joiningDate,
        employmentStatus: e.employmentStatus,
        branchesID: e.branchesID,
        departmentNameID: e.departmentNameID,
        designationID: e.designationID,
        branchName: e.branches?.branchName ?? null,
        departmentName: e.departments?.departmentName ?? null,
        designationName: e.designations?.designation ?? null,
        managerIds,
        reporteeIds,
        isCompanyOwner: Boolean(e.isCompanyOwner),
        isL1,
      });
    }

    const visited = new Set<number>();
    const buildEmployeeNode = (id: number): EmployeeTreeNode | null => {
      if (visited.has(id)) return null;
      const emp = byId.get(id);
      if (!emp) return null;
      visited.add(id);
      const children = (emp.reporteeIds || [])
        .map((childId) => buildEmployeeNode(childId))
        .filter((n): n is EmployeeTreeNode => n != null)
        .sort((a, b) => displayName(a.employee).localeCompare(displayName(b.employee)));
      return { employee: emp, children };
    };

    const l1Employees = [...byId.values()]
      .filter((e) => e.isL1)
      .sort((a, b) => {
        if (a.isCompanyOwner !== b.isCompanyOwner) return a.isCompanyOwner ? -1 : 1;
        return displayName(a).localeCompare(displayName(b));
      });

    const employeeTreeRoots = (l1Employees.length
      ? l1Employees
      : [...byId.values()].filter((e) => e.managerIds.length === 0 && e.isL1)
    )
      .map((e) => buildEmployeeNode(e.id))
      .filter((n): n is EmployeeTreeNode => n != null);

    const unlinkedEmployees = [...byId.values()]
      .filter((e) => !visited.has(e.id))
      .sort((a, b) => displayName(a).localeCompare(displayName(b)));

    const employeesByDept = new Map<number, HierarchyEmployee[]>();
    for (const emp of byId.values()) {
      if (emp.isL1) continue;
      if (emp.departmentNameID == null) continue;
      if (!employeesByDept.has(emp.departmentNameID)) employeesByDept.set(emp.departmentNameID, []);
      employeesByDept.get(emp.departmentNameID)!.push(emp);
    }
    for (const list of employeesByDept.values()) {
      list.sort((a, b) => displayName(a).localeCompare(displayName(b)));
    }

    const deptById = new Map<number, (typeof departments)[number]>();
    for (const d of departments) deptById.set(d.id, d);

    const buildDeptNode = (id: number, level: number, stack: Set<number>): DepartmentTreeNode | null => {
      if (stack.has(id)) return null;
      const d = deptById.get(id);
      if (!d) return null;
      stack.add(id);
      const employeesInDept = employeesByDept.get(d.id) ?? [];
      const children = departments
        .filter((c) => Number(c.parentDepartmentID) === d.id)
        .map((c) => buildDeptNode(c.id, Math.min(level + 1, 3), stack))
        .filter((n): n is DepartmentTreeNode => n != null);
      stack.delete(id);
      return {
        id: d.id,
        departmentName: d.departmentName,
        parentDepartmentID: d.parentDepartmentID,
        level,
        branches: d.departmentBranches
          .map((b) => ({
            id: b.branches?.id ?? b.branchesID,
            branchName: b.branches?.branchName ?? null,
          }))
          .filter((b) => b.id),
        employeeCount: employeesInDept.length,
        employees: employeesInDept,
        children,
      };
    };

    const departmentTree = departments
      .filter((d) => d.parentDepartmentID == null)
      .map((d) => buildDeptNode(d.id, 2, new Set()))
      .filter((n): n is DepartmentTreeNode => n != null);

    return {
      companyID,
      company: company
        ? {
            id: company.id,
            companyName: company.companyName,
            companyLogoUrl: company.companyLogoUrl,
          }
        : { id: companyID, companyName: 'Company', companyLogoUrl: null },
      l1Employees,
      departmentTree,
      employeeTree: employeeTreeRoots,
      unlinkedEmployees,
      // Keep previous `roots` shape so older clients still render a reporting tree.
      roots: employeeTreeRoots,
      totals: {
        employees: employees.length,
        l1: l1Employees.length,
        roots: employeeTreeRoots.length,
        departments: departments.length,
        designations: await this.prisma.designations.count({ where: { companyID } }),
      },
    };
  }
}

function displayName(e: Pick<HierarchyEmployee, 'employeeFirstName' | 'employeeLastName' | 'employeeID' | 'id'>) {
  const name = `${e.employeeFirstName ?? ''} ${e.employeeLastName ?? ''}`.trim();
  return name || e.employeeID || `Employee #${e.id}`;
}
