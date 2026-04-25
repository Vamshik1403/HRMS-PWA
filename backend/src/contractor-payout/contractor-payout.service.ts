import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractorPayoutDto } from './dto/create-contractor-payout.dto';
import { UpdateContractorPayoutDto } from './dto/update-contractor-payout.dto';

@Injectable()
export class ContractorPayoutService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateContractorPayoutDto) {
    return this.prisma.contractorPayout.create({ data });
  }

  findAll() {
    return this.prisma.contractorPayout.findMany({
      orderBy: { id: 'desc' },
      include: { contractor: true },
    });
  }

  findByContractor(contractorID: number) {
    return this.prisma.contractorPayout.findMany({
      where: { contractorID },
      orderBy: { id: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.contractorPayout.findUnique({ where: { id } });
  }

  update(id: number, data: UpdateContractorPayoutDto) {
    return this.prisma.contractorPayout.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.contractorPayout.delete({ where: { id } });
  }

  /**
   * Fetch the matching rate card for the given contractor/branch/department/designation/workshift combination.
   * Matches on string names by joining the lookup tables.
   */
  async fetchRateCard(
    contractorID: number,
    branchID?: number,
    departmentIDs?: number[],
    designationIDs?: number[],
    workshiftIDs?: number[],
  ) {
    // Resolve names for matching
    const [branch, departments, designations, workshifts] = await Promise.all([
      branchID ? this.prisma.branches.findUnique({ where: { id: branchID } }) : null,
      departmentIDs?.length
        ? this.prisma.departments.findMany({ where: { id: { in: departmentIDs } } })
        : [],
      designationIDs?.length
        ? this.prisma.designations.findMany({ where: { id: { in: designationIDs } } })
        : [],
      workshiftIDs?.length
        ? this.prisma.workShift.findMany({ where: { id: { in: workshiftIDs } } })
        : [],
    ]);

    const branchName = branch?.branchName ?? null;
    const deptNames = (departments as any[]).map((d) => d.departmentName).filter(Boolean);
    const desigNames = (designations as any[]).map((d) => d.designation).filter(Boolean);
    const shiftNames = (workshifts as any[]).map((w) => w.workShiftName).filter(Boolean);

    // Build where clause — match on any overlapping name (most specific first)
    const whereClause: any = { contractorID };
    if (branchName) whereClause.branchName = branchName;
    if (deptNames.length) whereClause.departmentName = { in: deptNames };
    if (desigNames.length) whereClause.designation = { in: desigNames };
    if (shiftNames.length) whereClause.workShiftName = { in: shiftNames };

    const rateCards = await this.prisma.contractorRateCard.findMany({ where: whereClause });
    return rateCards;
  }

  // Fetch branches for a contractor (via employees linked to contractor)
  async getBranchesForContractor(contractorID: number) {
    const employees = await this.prisma.manageEmployee.findMany({
      where: { contractorID, isDeleted: false },
      select: { branchesID: true },
      distinct: ['branchesID'],
    });
    const branchIDs = employees.map((e) => e.branchesID).filter(Boolean) as number[];
    if (!branchIDs.length) return [];
    return this.prisma.branches.findMany({ where: { id: { in: branchIDs } } });
  }

  // Fetch departments filtered by contractor + branch
  async getDepartmentsForContractorBranch(contractorID: number, branchID: number) {
    const employees = await this.prisma.manageEmployee.findMany({
      where: { contractorID, branchesID: branchID, isDeleted: false },
      select: { departmentNameID: true },
      distinct: ['departmentNameID'],
    });
    const deptIDs = employees.map((e) => e.departmentNameID).filter(Boolean) as number[];
    if (!deptIDs.length) return [];
    return this.prisma.departments.findMany({ where: { id: { in: deptIDs } } });
  }

  // Fetch designations filtered by contractor + branch + departments
  async getDesignationsForContractorBranchDepts(
    contractorID: number,
    branchID: number,
    departmentIDs: number[],
  ) {
    const where: any = { contractorID, branchesID: branchID, isDeleted: false };
    if (departmentIDs.length) where.departmentNameID = { in: departmentIDs };
    const employees = await this.prisma.manageEmployee.findMany({
      where,
      select: { designationID: true },
      distinct: ['designationID'],
    });
    const desigIDs = employees.map((e) => e.designationID).filter(Boolean) as number[];
    if (!desigIDs.length) return [];
    return this.prisma.designations.findMany({ where: { id: { in: desigIDs } } });
  }

  // Fetch employees filtered by contractor + branch + departments + designations
  async getEmployeesForFilters(
    contractorID: number,
    branchID: number,
    departmentIDs: number[],
    designationIDs: number[],
  ) {
    const where: any = { contractorID, branchesID: branchID, isDeleted: false };
    if (departmentIDs.length) where.departmentNameID = { in: departmentIDs };
    if (designationIDs.length) where.designationID = { in: designationIDs };
    return this.prisma.manageEmployee.findMany({
      where,
      select: {
        id: true,
        employeeFirstName: true,
        employeeLastName: true,
        employeeID: true,
        workShiftID: true,
      },
    });
  }

  // Fetch workshifts filtered by contractor + branch + departments + designations + employees
  async getWorkshiftsForFilters(
    contractorID: number,
    branchID: number,
    departmentIDs: number[],
    designationIDs: number[],
    employeeIDs: number[],
  ) {
    const where: any = { contractorID, branchesID: branchID, isDeleted: false };
    if (departmentIDs.length) where.departmentNameID = { in: departmentIDs };
    if (designationIDs.length) where.designationID = { in: designationIDs };
    if (employeeIDs.length) where.id = { in: employeeIDs };
    const employees = await this.prisma.manageEmployee.findMany({
      where,
      select: { workShiftID: true },
      distinct: ['workShiftID'],
    });
    const shiftIDs = employees.map((e) => e.workShiftID).filter(Boolean) as number[];
    if (!shiftIDs.length) return [];
    return this.prisma.workShift.findMany({ where: { id: { in: shiftIDs } } });
  }
}
