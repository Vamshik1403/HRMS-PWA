import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertRosterDayDto } from './dto/upsert-roster-day.dto';
import { BulkUpsertRosterDaysDto } from './dto/bulk-upsert-roster-days.dto';
import { RosterDayType } from './enums/roster.enums';

@Injectable()
export class RosterDayService {
  constructor(private prisma: PrismaService) {}

  // Existing upsert method (for single cell updates)
  async upsert(dto: UpsertRosterDayDto) {
    if (dto.dayType !== RosterDayType.WORK && dto.workShiftID) {
      throw new BadRequestException('workShiftID not allowed for WEEKLY_OFF / LEAVE');
    }
    if (dto.dayType === RosterDayType.LEAVE && !dto.leaveType) {
      throw new BadRequestException('leaveType required when dayType is LEAVE');
    }
    if (dto.dayType !== RosterDayType.LEAVE && dto.leaveType) {
      throw new BadRequestException('leaveType allowed only when dayType is LEAVE');
    }

    return this.prisma.rosterDay.upsert({
      where: {
        rosterEmployeeID_workDate: {
          rosterEmployeeID: dto.rosterEmployeeID,
          workDate: new Date(dto.workDate),
        },
      },
      update: {
        dayType: dto.dayType,
        workShiftID: dto.workShiftID ?? null,
        leaveType: dto.leaveType ?? null,
      },
      create: {
        rosterEmployeeID: dto.rosterEmployeeID,
        workDate: new Date(dto.workDate),
        dayType: dto.dayType,
        workShiftID: dto.workShiftID ?? null,
        leaveType: dto.leaveType ?? null,
      },
    });
  }

  // Updated bulkUpsert method to handle employeeID
  async bulkUpsert(dto: BulkUpsertRosterDaysDto) {
    const start = new Date(dto.fromDate);
    const end = new Date(dto.toDate);
    if (start > end) throw new BadRequestException('Invalid range');

    if (dto.dayType !== RosterDayType.WORK && dto.workShiftID) {
      throw new BadRequestException('workShiftID not allowed for WEEKLY_OFF / LEAVE');
    }
    if (dto.dayType === RosterDayType.LEAVE && !dto.leaveType) {
      throw new BadRequestException('leaveType required when dayType is LEAVE');
    }
    if (dto.dayType !== RosterDayType.LEAVE && dto.leaveType) {
      throw new BadRequestException('leaveType allowed only when dayType is LEAVE');
    }

    // Step 1: Get or create rosterEmployee record
    const rosterEmployee = await this.getOrCreateRosterEmployee(dto.employeeID);
    const rosterEmployeeID = rosterEmployee.id;

    const queries: Prisma.PrismaPromise<any>[] = [];
    let cur = new Date(start);

    while (cur <= end) {
      const workDate = new Date(cur);

      queries.push(
        this.prisma.rosterDay.upsert({
          where: {
            rosterEmployeeID_workDate: {
              rosterEmployeeID,
              workDate,
            },
          },
          update: {
            dayType: dto.dayType,
            workShiftID: dto.workShiftID ?? null,
            leaveType: dto.leaveType ?? null,
          },
          create: {
            rosterEmployeeID,
            workDate,
            dayType: dto.dayType,
            workShiftID: dto.workShiftID ?? null,
            leaveType: dto.leaveType ?? null,
          },
        })
      );

      cur.setDate(cur.getDate() + 1);
    }

    return this.prisma.$transaction(queries);
  }

  // Helper method to get or create rosterEmployee - CORRECTED VERSION
  private async getOrCreateRosterEmployee(employeeID: number) {
    // Get employee with all required relations
    const employee = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeID },
      include: {
        departments: true,        // This is correct based on your schema
        serviceProvider: true,
        company: true,
        branches: true,           // This is correct based on your schema
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeID} not found`);
    }

    // Check if roster employee already exists
    let rosterEmployee = await this.prisma.rosterEmployee.findFirst({
      where: {
        employeeID: employeeID,
      },
      orderBy: {
        id: 'desc',
      },
    });

    if (rosterEmployee) {
      return rosterEmployee;
    }

    // Find or create a roster for this employee's department
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    // IMPORTANT: Check if employee has required organization info
    // Since these fields are optional in your schema, we need to handle nulls
    const serviceProviderID = employee.serviceProviderID;
    const companyID = employee.companyID;
    const branchesID = employee.branchesID;
    const departmentNameID = employee.departmentNameID;

    if (!serviceProviderID || !companyID || !branchesID || !departmentNameID) {
      throw new BadRequestException(
        `Employee ${employeeID} is missing required organization information. ` +
        `Please ensure the employee has Service Provider, Company, Branch, and Department assigned. ` +
        `Missing: ${!serviceProviderID ? 'Service Provider, ' : ''}${!companyID ? 'Company, ' : ''}${!branchesID ? 'Branch, ' : ''}${!departmentNameID ? 'Department' : ''}`
      );
    }

    // Look for existing roster for this department
    let roster = await this.prisma.roster.findFirst({
      where: {
        serviceProviderID,
        companyID,
        branchesID,
        departmentID: departmentNameID, // Note: departmentNameID in ManageEmployee maps to departmentID in Roster
        // Remove date filters to find any roster for this department
      },
      orderBy: {
        id: 'desc',
      },
    });

    // If no roster exists, create one
    if (!roster) {
      roster = await this.prisma.roster.create({
        data: {
          serviceProviderID,
          companyID,
          branchesID,
          departmentID: departmentNameID,
          designationID: employee.designationID || undefined,
          fromDate: today,
          toDate: nextWeek,
          rosterPeriod: `${today.toLocaleString('default', { month: 'short' })}-${today.getFullYear()}`,
          status: 'DRAFT',
          createdBy: 1, // TODO: Get from auth context
        },
      });
    }

    // Create roster employee
    rosterEmployee = await this.prisma.rosterEmployee.create({
      data: {
        rosterID: roster.id,
        employeeID: employeeID,
      },
    });

    return rosterEmployee;
  }

  // Alternative simplified version without includes if you still have issues
  private async getOrCreateRosterEmployeeSimple(employeeID: number) {
    // Get employee without relations first (simpler)
    const employee = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeID },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeID} not found`);
    }

    // Check required fields
    const serviceProviderID = employee.serviceProviderID;
    const companyID = employee.companyID;
    const branchesID = employee.branchesID;
    const departmentNameID = employee.departmentNameID;

    if (!serviceProviderID || !companyID || !branchesID || !departmentNameID) {
      throw new BadRequestException(
        `Employee ${employeeID} is missing required organization information. ` +
        `Service Provider: ${serviceProviderID ? 'Set' : 'Missing'}, ` +
        `Company: ${companyID ? 'Set' : 'Missing'}, ` +
        `Branch: ${branchesID ? 'Set' : 'Missing'}, ` +
        `Department: ${departmentNameID ? 'Set' : 'Missing'}`
      );
    }

    // Check if roster employee already exists
    let rosterEmployee = await this.prisma.rosterEmployee.findFirst({
      where: {
        employeeID: employeeID,
      },
      orderBy: {
        id: 'desc',
      },
    });

    if (rosterEmployee) {
      return rosterEmployee;
    }

    // Find or create a roster
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    let roster = await this.prisma.roster.findFirst({
      where: {
        serviceProviderID,
        companyID,
        branchesID,
        departmentID: departmentNameID,
      },
      orderBy: {
        id: 'desc',
      },
    });

    // If no roster exists, create one
    if (!roster) {
      roster = await this.prisma.roster.create({
        data: {
          serviceProviderID,
          companyID,
          branchesID,
          departmentID: departmentNameID,
          designationID: employee.designationID || undefined,
          fromDate: today,
          toDate: nextWeek,
          rosterPeriod: `${today.toLocaleString('default', { month: 'short' })}-${today.getFullYear()}`,
          status: 'DRAFT',
          createdBy: 1,
        },
      });
    }

    // Create roster employee
    rosterEmployee = await this.prisma.rosterEmployee.create({
      data: {
        rosterID: roster.id,
        employeeID: employeeID,
      },
    });

    return rosterEmployee;
  }

  // Add a new method to get roster days by employeeID
  async listByEmployee(employeeID: number) {
    const rosterEmployee = await this.prisma.rosterEmployee.findFirst({
      where: { employeeID },
      orderBy: { id: 'desc' },
    });

    if (!rosterEmployee) {
      return [];
    }

    return this.prisma.rosterDay.findMany({
      where: { rosterEmployeeID: rosterEmployee.id },
      include: { workShift: true },
      orderBy: { workDate: 'asc' },
    });
  }

  listByRosterEmployee(rosterEmployeeID: number) {
    return this.prisma.rosterDay.findMany({
      where: { rosterEmployeeID },
      include: { workShift: true },
      orderBy: { workDate: 'asc' },
    });
  }

  remove(id: number) {
    return this.prisma.rosterDay.delete({ where: { id } });
  }
}