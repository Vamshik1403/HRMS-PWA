import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddFactualRosterEmployeeDto } from './dto/add-factual-roster-employee.dto';

@Injectable()
export class FactualRosterEmployeeService {
  constructor(private prisma: PrismaService) {}

  async add(dto: AddFactualRosterEmployeeDto) {
    return this.prisma.factualRosterEmployee.upsert({
      where: {
        factualRosterID_employeeID: {
          factualRosterID: dto.factualRosterID,
          employeeID: dto.employeeID,
        },
      },
      create: { factualRosterID: dto.factualRosterID, employeeID: dto.employeeID },
      update: {},
    });
  }

  async listByRoster(factualRosterID: number) {
    return this.prisma.factualRosterEmployee.findMany({
      where: { factualRosterID },
      include: { days: { include: { factualWorkShift: true } } },
    });
  }

  async listEmployeesForSelection(filters: {
    serviceProviderID: number;
    companyID: number;
    branchesID: number;
    departmentID: number;
    designationID?: number;
  }) {
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

  async findByEmployeeId(employeeID: number) {
    return this.prisma.factualRosterEmployee.findFirst({
      where: { employeeID },
      include: { days: { include: { factualWorkShift: true } } },
      orderBy: { id: 'desc' },
    });
  }

  async remove(id: number) {
    const emp = await this.prisma.factualRosterEmployee.findUnique({ where: { id } });
    if (!emp) throw new NotFoundException(`FactualRosterEmployee #${id} not found`);
    await this.prisma.factualRosterEmployee.delete({ where: { id } });
    return { message: `FactualRosterEmployee #${id} removed` };
  }

  async attachAllToRoster(factualRosterID: number, employeeIDs: number[]) {
    const roster = await this.prisma.factualRoster.findUnique({ where: { id: factualRosterID } });
    if (!roster) throw new NotFoundException(`FactualRoster #${factualRosterID} not found`);

    for (const employeeID of employeeIDs) {
      await this.prisma.factualRosterEmployee.upsert({
        where: {
          factualRosterID_employeeID: { factualRosterID, employeeID },
        },
        create: { factualRosterID, employeeID },
        update: {},
      });
    }
    return this.listByRoster(factualRosterID);
  }

  async findOrCreate(factualRosterID: number, employeeID: number) {
    return this.prisma.factualRosterEmployee.upsert({
      where: {
        factualRosterID_employeeID: { factualRosterID, employeeID },
      },
      create: { factualRosterID, employeeID },
      update: {},
    });
  }
}
