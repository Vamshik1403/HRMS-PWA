import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalaryAdvanceDto } from './dto/create-salary-advance.dto';
import { UpdateSalaryAdvanceDto } from './dto/update-salary-advance.dto';
import { EmpManagerScopeService } from '../common/emp-manager-scope.service';
import { EmployeeMemoService } from '../employee-memo/employee-memo.service';

@Injectable()
export class SalaryAdvanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly managerScope: EmpManagerScopeService,
    private readonly employeeMemoService: EmployeeMemoService,
  ) {}

  private includeRels() {
    return {
      company: true,
      branches: true,
      serviceProvider: true,
      manageEmployee: true,
    };
  }

  private employeeDisplayName(emp?: {
    employeeFirstName?: string | null;
    employeeLastName?: string | null;
    employeeID?: string | null;
  } | null): string {
    if (!emp) return 'An employee';
    const name = `${emp.employeeFirstName ?? ''} ${emp.employeeLastName ?? ''}`.trim();
    return name || emp.employeeID || 'An employee';
  }

  private postLoanBroadcast(rec: {
    companyID?: number | null;
    branchesID?: number | null;
    serviceProviderID?: number | null;
    manageEmployeeID?: number | null;
    status?: string | null;
    advanceAmount?: string | null;
    manageEmployee?: {
      employeeFirstName?: string | null;
      employeeLastName?: string | null;
      employeeID?: string | null;
    } | null;
  }): void {
    if (!rec.companyID || !rec.manageEmployeeID) return;
    const amount = rec.advanceAmount?.trim() ? ` — ${rec.advanceAmount.trim()}` : '';
    void this.employeeMemoService
      .createSystemStaffBroadcast({
        companyID: rec.companyID,
        branchesID: rec.branchesID,
        serviceProviderID: rec.serviceProviderID,
        subjectEmployeeIDs: [rec.manageEmployeeID],
        description: `Loan advance ${rec.status || 'Pending'}: ${this.employeeDisplayName(rec.manageEmployee)}${amount}`,
      })
      .catch(() => null);
  }

  async create(dto: CreateSalaryAdvanceDto) {
    const created = await this.prisma.salaryAdvance.create({
      data: dto,
      include: this.includeRels(),
    });
    this.postLoanBroadcast(created);
    return created;
  }

  async findAll() {
    return this.prisma.salaryAdvance.findMany({
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

  async findByEmployee(empId: number) {
    const scopeIds = await this.managerScope.getReporteeIds(empId);
    return this.prisma.salaryAdvance.findMany({
      where: { manageEmployeeID: { in: scopeIds } },
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const rec = await this.prisma.salaryAdvance.findUnique({
      where: { id },
      include: this.includeRels(),
    });
    if (!rec) throw new NotFoundException(`SalaryAdvance id ${id} not found`);
    return rec;
  }

  async update(id: number, dto: UpdateSalaryAdvanceDto) {
    const before = await this.ensureExists(id);
    const updated = await this.prisma.salaryAdvance.update({
      where: { id },
      data: dto,
      include: this.includeRels(),
    });
    if ((dto.status || updated.status) && before.status !== updated.status) {
      this.postLoanBroadcast(updated);
    }
    return updated;
  }

  async remove(id: number) {
    await this.ensureExists(id);
    return this.prisma.salaryAdvance.delete({
      where: { id },
      include: this.includeRels(),
    });
  }

  private async ensureExists(id: number) {
    const ok = await this.prisma.salaryAdvance.findUnique({ where: { id } });
    if (!ok) throw new NotFoundException(`SalaryAdvance id ${id} not found`);
    return ok;
  }
}
