import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Employees who report to `managerEmployeeId` via Manage Employee → Manager links. */
@Injectable()
export class EmpManagerScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Direct reportees only (one management level — not transitive). */
  async getDirectReporteeIds(managerEmployeeId: number): Promise<number[]> {
    const links = await this.prisma.employeeLink.findMany({
      where: { linkedEmployeeId: managerEmployeeId },
      select: { employeeId: true },
    });
    return [...new Set(links.map((l) => l.employeeId))];
  }

  /**
   * All reportees under this manager, including skip-level (reportees of reportees).
   * Cycle-safe: never revisits an id and never includes the manager themselves.
   */
  async getDescendantReporteeIds(managerEmployeeId: number): Promise<number[]> {
    const descendants: number[] = [];
    const visited = new Set<number>([managerEmployeeId]);
    let frontier = [managerEmployeeId];

    while (frontier.length > 0) {
      const links = await this.prisma.employeeLink.findMany({
        where: { linkedEmployeeId: { in: frontier } },
        select: { employeeId: true },
      });
      frontier = [];
      for (const link of links) {
        const id = Number(link.employeeId);
        if (!Number.isFinite(id) || visited.has(id)) continue;
        visited.add(id);
        descendants.push(id);
        frontier.push(id);
      }
    }

    return descendants;
  }

  /** Self plus the full reporting tree (direct and skip-level). */
  async getReporteeIds(managerEmployeeId: number): Promise<number[]> {
    const descendants = await this.getDescendantReporteeIds(managerEmployeeId);
    return [managerEmployeeId, ...descendants];
  }

  /** Skip-level only: reportees of reportees, excluding people linked directly to this manager. */
  async getNestedReporteeIds(managerEmployeeId: number): Promise<number[]> {
    const [direct, descendants] = await Promise.all([
      this.getDirectReporteeIds(managerEmployeeId),
      this.getDescendantReporteeIds(managerEmployeeId),
    ]);
    const directSet = new Set(direct);
    return descendants.filter((id) => !directSet.has(id));
  }

  async hasReportees(managerEmployeeId: number): Promise<boolean> {
    const count = await this.prisma.employeeLink.count({
      where: { linkedEmployeeId: managerEmployeeId },
    });
    return count > 0;
  }

  /** Managers linked to this employee in Manage Employee → Manager. */
  async getManagerIdsForEmployee(employeeId: number): Promise<number[]> {
    const links = await this.prisma.employeeLink.findMany({
      where: { employeeId },
      select: { linkedEmployeeId: true },
    });
    return links.map((l) => l.linkedEmployeeId);
  }

  async getEmployeeDisplayName(employeeId: number): Promise<string> {
    const e = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: { employeeFirstName: true, employeeLastName: true, employeeID: true },
    });
    const name = [e?.employeeFirstName, e?.employeeLastName].filter(Boolean).join(' ').trim();
    return name || e?.employeeID || `Employee #${employeeId}`;
  }

  /** Manager may view the reporting tree, colleagues in the same department, or same-company directory peers. */
  async canViewEmployee(managerEmployeeId: number, targetEmployeeId: number): Promise<boolean> {
    if (managerEmployeeId === targetEmployeeId) return true;
    const descendants = await this.getDescendantReporteeIds(managerEmployeeId);
    if (descendants.includes(targetEmployeeId)) return true;

    const [manager, target] = await Promise.all([
      this.prisma.manageEmployee.findUnique({
        where: { id: managerEmployeeId },
        select: { departmentNameID: true, companyID: true },
      }),
      this.prisma.manageEmployee.findUnique({
        where: { id: targetEmployeeId },
        select: { departmentNameID: true, companyID: true, isDeleted: true },
      }),
    ]);
    if (!manager || !target || target.isDeleted) return false;
    if (manager.companyID != null && manager.companyID === target.companyID) return true;
    if (
      manager.departmentNameID != null &&
      manager.departmentNameID === target.departmentNameID
    ) {
      return true;
    }
    return false;
  }

  /** First-person employee notification → manager-facing copy. */
  managerNotificationBody(body: string, employeeName: string): string {
    return body
      .replace(/^Your /i, `${employeeName}'s `)
      .replace(/^You have been /i, `${employeeName} has been `)
      .replace(/^You have /i, `${employeeName} has `)
      .replace(/^You were /i, `${employeeName} was `);
  }
}
