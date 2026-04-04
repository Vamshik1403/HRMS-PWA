import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddRosterEmployeeDto } from './dto/add-roster-employee.dto';

@Injectable()
export class RosterEmployeeService {
  constructor(private prisma: PrismaService) {}

  async add(dto: AddRosterEmployeeDto) {
    // avoid duplicates by relying on @@unique
    try {
      return await this.prisma.rosterEmployee.create({ data: dto });
    } catch {
      throw new BadRequestException('Employee already exists in this roster');
    }
  }

  listByRoster(rosterID: number) {
    return this.prisma.rosterEmployee.findMany({
      where: { rosterID },
      include: {
        manageEmployee: true,
        days: { include: { workShift: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  async remove(id: number) {
    // delete days first
    return this.prisma.$transaction(async (tx) => {
      await tx.rosterDay.deleteMany({ where: { rosterEmployeeID: id } });
      return tx.rosterEmployee.delete({ where: { id } });
    });
  }

  /**
   * IMPORTANT:
   * This endpoint returns employees for your "left-side table list"
   * based on selected filters (serviceProvider/company/branch/department/designation)
   */
  async listEmployeesForSelection(filters: {
    serviceProviderID: number;
    companyID: number;
    branchesID: number;
    departmentID: number;
    designationID?: number;
  }) {
    // Validate required filters
    if (!filters.serviceProviderID || !filters.companyID || !filters.branchesID || !filters.departmentID) {
      throw new BadRequestException('Missing required filter parameters');
    }

    return this.prisma.manageEmployee.findMany({
      where: {
        serviceProviderID: filters.serviceProviderID,
        companyID: filters.companyID,
        branchesID: filters.branchesID,
        departmentNameID: filters.departmentID,
        ...(filters.designationID ? { designationID: filters.designationID } : {}),
      },
      orderBy: { id: 'asc' },
    });
  }

  async findOrCreateByEmployeeId(employeeID: number) {
    // First check if exists
    let rosterEmployee = await this.prisma.rosterEmployee.findFirst({
      where: { employeeID },
      orderBy: { id: 'desc' },
    });

    if (rosterEmployee) {
      return rosterEmployee;
    }

    // Get employee details
    const employee = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeID },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeID} not found`);
    }

    // Get employee details with required organization info
    // Check for null values and throw error if missing
    if (!employee.serviceProviderID || !employee.companyID || !employee.branchesID || !employee.departmentNameID) {
      throw new BadRequestException(
        `Employee ${employeeID} is missing required organization information. ` +
        `Please ensure the employee has Service Provider, Company, Branch, and Department assigned.`
      );
    }

    // Find an existing roster for this employee's department
    const roster = await this.prisma.roster.findFirst({
      where: {
        serviceProviderID: employee.serviceProviderID,
        companyID: employee.companyID,
        branchesID: employee.branchesID,
        departmentID: employee.departmentNameID,
      },
    });

    if (!roster) {
      // Create a default roster if none exists
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      // Since we've already checked for nulls above, we can safely cast to number
      const createdBy = employee.id;

      const newRoster = await this.prisma.roster.create({
        data: {
          serviceProviderID: employee.serviceProviderID as number, // Cast to number
          companyID: employee.companyID as number, // Cast to number
          branchesID: employee.branchesID as number, // Cast to number
          departmentID: employee.departmentNameID as number, // Cast to number
          designationID: employee.designationID || undefined,
          fromDate: today,
          toDate: nextWeek,
          rosterPeriod: `${today.toLocaleString('default', { month: 'short' })}-${today.getFullYear()}`,
          status: 'DRAFT',
          createdBy: createdBy,
        },
      });

      // Create roster employee with the new roster
      return this.prisma.rosterEmployee.create({
        data: {
          rosterID: newRoster.id,
          employeeID: employeeID,
        },
      });
    }

    // Create roster employee with existing roster
    return this.prisma.rosterEmployee.create({
      data: {
        rosterID: roster.id,
        employeeID: employeeID,
      },
    });
  }

  /**
   * Create roster + auto add ALL employees for selected scope in one call.
   * This matches your UI: select filters => employees show => create roster with those employees.
   */
  async attachAllEmployeesToRoster(rosterID: number, filters: {
    serviceProviderID: number;
    companyID: number;
    branchesID: number;
    departmentID: number;
    designationID?: number;
  }) {
    // Validate required filters
    if (!filters.serviceProviderID || !filters.companyID || !filters.branchesID || !filters.departmentID) {
      throw new BadRequestException('Missing required filter parameters');
    }

    const employees = await this.listEmployeesForSelection(filters);

    if (!employees.length) {
      throw new BadRequestException('No employees found for selected filters');
    }

    // Filter out employees already in this roster
    const existingRosterEmployees = await this.prisma.rosterEmployee.findMany({
      where: {
        rosterID,
        employeeID: { in: employees.map(e => e.id) },
      },
      select: { employeeID: true },
    });

    const existingEmployeeIDs = new Set(existingRosterEmployees.map(re => re.employeeID));
    const newEmployees = employees.filter(e => !existingEmployeeIDs.has(e.id));

    if (!newEmployees.length) {
      return { rosterID, added: 0, message: 'All employees already added to roster' };
    }

    // Use createMany for bulk insert
    const result = await this.prisma.rosterEmployee.createMany({
      data: newEmployees.map((e) => ({
        rosterID,
        employeeID: e.id,
      })),
      skipDuplicates: true,
    });

    return { 
      rosterID, 
      added: result.count, 
      totalEmployees: employees.length,
      alreadyExisting: existingEmployeeIDs.size
    };
  }

  // Additional helper method: Get roster employee by employee ID
  async findByEmployeeId(employeeID: number, rosterID?: number) {
    const where: any = { employeeID };
    if (rosterID) {
      where.rosterID = rosterID;
    }
    
    return this.prisma.rosterEmployee.findFirst({
      where,
      include: {
        roster: true,
        manageEmployee: true,
        days: { include: { workShift: true } },
      },
      orderBy: { id: 'desc' },
    });
  }

  async getRosterDaysForEmployee(employeeID: number, fromDate?: string, toDate?: string) {
  // First find the roster employee
  const rosterEmployee = await this.prisma.rosterEmployee.findFirst({
    where: { employeeID },
    orderBy: { id: 'desc' },
    include: {
      days: {
        where: {
          ...(fromDate && toDate ? {
            workDate: {
              gte: new Date(fromDate),
              lte: new Date(toDate)
            }
          } : {})
        },
        include: { workShift: true },
        orderBy: { workDate: 'asc' }
      }
    }
  });
  
  if (!rosterEmployee) {
    return { employeeID, days: [] };
  }
  
  return rosterEmployee;
}

async getRosterDaysForEmployees(employeeIDs: number[], fromDate?: string, toDate?: string) {
  const rosterEmployees = await this.prisma.rosterEmployee.findMany({
    where: {
      employeeID: { in: employeeIDs }
    },
    include: {
      days: {
        where: {
          ...(fromDate && toDate ? {
            workDate: {
              gte: new Date(fromDate),
              lte: new Date(toDate)
            }
          } : {})
        },
        include: { workShift: true },
        orderBy: { workDate: 'asc' }
      },
      manageEmployee: true
    },
    orderBy: { id: 'asc' }
  });
  
  return rosterEmployees;
}

  // Method to get employees with their roster days for a specific date range
  async getEmployeesWithRosterDays(filters: {
    serviceProviderID: number;
    companyID: number;
    branchesID: number;
    departmentID: number;
    designationID?: number;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const employees = await this.listEmployeesForSelection(filters);
    
    const employeeIds = employees.map(e => e.id);
    
    // Get roster employees for these employee IDs
    const rosterEmployees = await this.prisma.rosterEmployee.findMany({
      where: {
        employeeID: { in: employeeIds },
      },
      include: {
        roster: true,
        days: {
          where: {
            ...(filters.fromDate && filters.toDate ? {
              workDate: {
                gte: filters.fromDate,
                lte: filters.toDate,
              }
            } : {}),
          },
          include: { workShift: true },
          orderBy: { workDate: 'asc' },
        },
        manageEmployee: true,
      },
    });

    return rosterEmployees;
  }

  // Helper method to validate employee has required organization info
  async validateEmployeeOrganization(employeeID: number): Promise<{
    isValid: boolean;
    employee: any;
    missingFields: string[];
  }> {
    const employee = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeID },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeID} not found`);
    }

    const missingFields: string[] = [];
    
    if (!employee.serviceProviderID) missingFields.push('serviceProviderID');
    if (!employee.companyID) missingFields.push('companyID');
    if (!employee.branchesID) missingFields.push('branchesID');
    if (!employee.departmentNameID) missingFields.push('departmentNameID');

    return {
      isValid: missingFields.length === 0,
      employee,
      missingFields,
    };
  }

  // Method to create a roster with proper type handling for nullable fields
  async createRosterForEmployee(employee: any, createdBy?: number) {
    // Extract and validate required fields
    const serviceProviderID = employee.serviceProviderID;
    const companyID = employee.companyID;
    const branchesID = employee.branchesID;
    const departmentID = employee.departmentNameID;

    // Type guard to ensure these are numbers, not null
    if (typeof serviceProviderID !== 'number' || 
        typeof companyID !== 'number' || 
        typeof branchesID !== 'number' || 
        typeof departmentID !== 'number') {
      throw new BadRequestException('Employee is missing required organization information');
    }

    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    return this.prisma.roster.create({
      data: {
        serviceProviderID,
        companyID,
        branchesID,
        departmentID,
        designationID: employee.designationID || undefined,
        fromDate: today,
        toDate: nextWeek,
        rosterPeriod: `${today.toLocaleString('default', { month: 'short' })}-${today.getFullYear()}`,
        status: 'DRAFT',
        createdBy: createdBy || employee.id,
      },
    });
  }
}