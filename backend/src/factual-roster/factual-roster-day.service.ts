import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertFactualRosterDayDto } from './dto/upsert-factual-roster-day.dto';
import { BulkUpsertFactualRosterDaysDto } from './dto/bulk-upsert-factual-roster-days.dto';
import { FactualRosterEmployeeService } from './factual-roster-employee.service';

@Injectable()
export class FactualRosterDayService {
  constructor(
    private prisma: PrismaService,
    private factualRosterEmployeeService: FactualRosterEmployeeService,
  ) {}

  async upsert(dto: UpsertFactualRosterDayDto) {
    const workDate = new Date(dto.workDate);
    return this.prisma.factualRosterDay.upsert({
      where: {
        factualRosterEmployeeID_workDate: {
          factualRosterEmployeeID: dto.factualRosterEmployeeID,
          workDate,
        },
      },
      create: {
        factualRosterEmployeeID: dto.factualRosterEmployeeID,
        workDate,
        dayType: dto.dayType,
        factualWorkShiftID: dto.factualWorkShiftID ?? null,
        leaveType: dto.leaveType ?? null,
      },
      update: {
        dayType: dto.dayType,
        factualWorkShiftID: dto.factualWorkShiftID ?? null,
        leaveType: dto.leaveType ?? null,
      },
      include: { factualWorkShift: true },
    });
  }

  private async getOrCreateFactualRoster(employeeID: number): Promise<number> {
    // Try to find an existing factual roster employee record
    const existing = await this.prisma.factualRosterEmployee.findFirst({
      where: { employeeID },
      orderBy: { id: 'desc' },
    });
    if (existing) return existing.factualRosterID;

    // Get employee details
    const employee = await this.prisma.manageEmployee.findUnique({ where: { id: employeeID } });
    if (!employee) throw new Error(`Employee ${employeeID} not found`);

    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Create a new factual roster
    const roster = await this.prisma.factualRoster.create({
      data: {
        serviceProviderID: employee.serviceProviderID || 0,
        companyID: employee.companyID || 0,
        branchesID: employee.branchesID || 0,
        departmentID: employee.departmentNameID || 0,
        fromDate: today,
        toDate: nextMonth,
        rosterPeriod: `FCT-${today.toLocaleString('default', { month: 'short' })}-${today.getFullYear()}`,
        status: 'DRAFT',
        createdBy: 0,
      },
    });
    return roster.id;
  }

  async bulkUpsert(dto: BulkUpsertFactualRosterDaysDto) {
    const { employeeID, fromDate, toDate, dayType, leaveType } = dto;
    // workShiftID alias for compatibility with frontend
    const shiftID = dto.factualWorkShiftID ?? dto.workShiftID ?? null;

    let factualRosterID = dto.factualRosterID;
    if (!factualRosterID) {
      factualRosterID = await this.getOrCreateFactualRoster(employeeID);
    }

    const rosterEmployee = await this.factualRosterEmployeeService.findOrCreate(factualRosterID, employeeID);

    const from = new Date(fromDate);
    const to = new Date(toDate);
    const results: any[] = [];

    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const workDate = new Date(d);
      const result = await this.prisma.factualRosterDay.upsert({
        where: {
          factualRosterEmployeeID_workDate: {
            factualRosterEmployeeID: rosterEmployee.id,
            workDate,
          },
        },
        create: {
          factualRosterEmployeeID: rosterEmployee.id,
          workDate,
          dayType,
          factualWorkShiftID: shiftID,
          leaveType: leaveType ?? null,
        },
        update: {
          dayType,
          factualWorkShiftID: shiftID,
          leaveType: leaveType ?? null,
        },
      });
      results.push(result);
    }

    return results;
  }

  async findByRosterEmployee(factualRosterEmployeeID: number) {
    return this.prisma.factualRosterDay.findMany({
      where: { factualRosterEmployeeID },
      include: { factualWorkShift: true },
      orderBy: { workDate: 'asc' },
    });
  }

  async remove(id: number) {
    await this.prisma.factualRosterDay.delete({ where: { id } });
    return { message: `FactualRosterDay #${id} deleted` };
  }
}
