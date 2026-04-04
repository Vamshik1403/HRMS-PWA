import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEmpPromotionDto } from "./dto/create-emp-promotion.dto";
import { UpdateEmpPromotionDto } from "./dto/update-emp-promotion.dto";

@Injectable()
export class EmpPromotionService {
  constructor(private prisma: PrismaService) {}

 create(dto: CreateEmpPromotionDto) {
  return this.prisma.$transaction(async (tx) => {

    const created = await tx.empPromotion.create({
      data: {
        manageEmployeeID: dto.manageEmployeeID,
        serviceProviderID: dto.serviceProviderID ?? null,
        companyID: dto.companyID ?? null,
        branchesID: dto.branchesID ?? null,
        departmentNameID: dto.departmentNameID ?? null,
        designationID: dto.designationID ?? null,
        managerID: dto.managerID ?? null,
        employmentType: dto.employmentType ?? null,
        employmentStatus: dto.employmentStatus ?? null,
        probationPeriod: dto.probationPeriod ?? null,
        workShiftID: dto.workShiftID ?? null,
        attendancePolicyID: dto.attendancePolicyID ?? null,
        leavePolicyID: dto.leavePolicyID ?? null,
        salaryPayGradeType: dto.salaryPayGradeType ?? null,
        monthlyPayGradeID: dto.monthlyPayGradeID ?? null,
        hourlyPayGradeID: dto.hourlyPayGradeID ?? null,
        promotedSalaryCtc: dto.promotedSalaryCtc ?? null,
        description: dto.description ?? null,
        promotionDate: dto.promotionDate ? new Date(dto.promotionDate) : null,
        status: dto.status ?? null,
      },
      include: this._includeAll(),
    });

    // Mirror latest promotion values to ManageEmployee
    await tx.manageEmployee.update({
      where: { id: dto.manageEmployeeID },
      data: {
        ...(dto.serviceProviderID !== undefined ? { serviceProviderID: dto.serviceProviderID } : {}),
        ...(dto.companyID !== undefined ? { companyID: dto.companyID } : {}),
        ...(dto.branchesID !== undefined ? { branchesID: dto.branchesID } : {}),
        ...(dto.departmentNameID !== undefined ? { departmentNameID: dto.departmentNameID } : {}),
        ...(dto.designationID !== undefined ? { designationID: dto.designationID } : {}),
        ...(dto.managerID !== undefined ? { managerID: dto.managerID } : {}),
        ...(dto.employmentType !== undefined ? { employmentType: dto.employmentType as any } : {}),
        ...(dto.employmentStatus !== undefined ? { employmentStatus: dto.employmentStatus as any } : {}),
        ...(dto.probationPeriod !== undefined ? { probationPeriod: dto.probationPeriod as any } : {}),
        ...(dto.workShiftID !== undefined ? { workShiftID: dto.workShiftID } : {}),
        ...(dto.attendancePolicyID !== undefined ? { attendancePolicyID: dto.attendancePolicyID } : {}),
        ...(dto.leavePolicyID !== undefined ? { leavePolicyID: dto.leavePolicyID } : {}),
        ...(dto.salaryPayGradeType !== undefined ? { salaryPayGradeType: dto.salaryPayGradeType as any } : {}),
        ...(dto.monthlyPayGradeID !== undefined ? { monthlyPayGradeID: dto.monthlyPayGradeID } : {}),
        ...(dto.hourlyPayGradeID !== undefined ? { hourlyPayGradeID: dto.hourlyPayGradeID } : {}),
      },
    });

    return created;
  });
}


  findAll(manageEmployeeID?: number) {
    return this.prisma.empPromotion.findMany({
      where: manageEmployeeID ? { manageEmployeeID } : {},
      orderBy: { id: "desc" },
      include: this._includeAll(),
    });
  }

  findOne(id: number) {
    return this.prisma.empPromotion.findUnique({
      where: { id },
      include: this._includeAll(),
    });
  }

  update(id: number, dto: UpdateEmpPromotionDto) {
  return this.prisma.$transaction(async (tx) => {

    // 🚫 Do NOT allow updating manageEmployeeID
    delete (dto as any).manageEmployeeID;

    const updated = await tx.empPromotion.update({
      where: { id },
      data: {
        ...(dto.serviceProviderID !== undefined ? { serviceProviderID: dto.serviceProviderID } : {}),
        ...(dto.companyID !== undefined ? { companyID: dto.companyID } : {}),
        ...(dto.branchesID !== undefined ? { branchesID: dto.branchesID } : {}),
        ...(dto.departmentNameID !== undefined ? { departmentNameID: dto.departmentNameID } : {}),
        ...(dto.designationID !== undefined ? { designationID: dto.designationID } : {}),
        ...(dto.managerID !== undefined ? { managerID: dto.managerID } : {}),
        ...(dto.employmentType !== undefined ? { employmentType: dto.employmentType } : {}),
        ...(dto.employmentStatus !== undefined ? { employmentStatus: dto.employmentStatus } : {}),
        ...(dto.probationPeriod !== undefined ? { probationPeriod: dto.probationPeriod } : {}),
        ...(dto.workShiftID !== undefined ? { workShiftID: dto.workShiftID } : {}),
        ...(dto.attendancePolicyID !== undefined ? { attendancePolicyID: dto.attendancePolicyID } : {}),
        ...(dto.leavePolicyID !== undefined ? { leavePolicyID: dto.leavePolicyID } : {}),
        ...(dto.salaryPayGradeType !== undefined ? { salaryPayGradeType: dto.salaryPayGradeType } : {}),
        ...(dto.monthlyPayGradeID !== undefined ? { monthlyPayGradeID: dto.monthlyPayGradeID } : {}),
        ...(dto.hourlyPayGradeID !== undefined ? { hourlyPayGradeID: dto.hourlyPayGradeID } : {}),
        ...(dto.promotedSalaryCtc !== undefined ? { promotedSalaryCtc: dto.promotedSalaryCtc } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.promotionDate !== undefined ? {
          promotionDate: dto.promotionDate ? new Date(dto.promotionDate) : null
        } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: this._includeAll(),
    });

    // ALWAYS sync using "updated" data, not DTO.
    await tx.manageEmployee.update({
      where: { id: updated.manageEmployeeID },
      data: {
        serviceProviderID: updated.serviceProviderID,
        companyID: updated.companyID,
        branchesID: updated.branchesID,
        departmentNameID: updated.departmentNameID,
        designationID: updated.designationID,
        employmentType: updated.employmentType as any,
        employmentStatus: updated.employmentStatus as any,
        probationPeriod: updated.probationPeriod as any,
        workShiftID: updated.workShiftID,
        attendancePolicyID: updated.attendancePolicyID,
        leavePolicyID: updated.leavePolicyID,
        salaryPayGradeType: updated.salaryPayGradeType as any,
        monthlyPayGradeID: updated.monthlyPayGradeID,
        hourlyPayGradeID: updated.hourlyPayGradeID,
      }
    });

    return updated;
  });
}


  remove(id: number) {
    // Single click should remove the entry entirely from the table even if history exists.
    // Delete ALL promotion rows for the same employee as the selected row.
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.empPromotion.findUnique({ where: { id } });
      if (!target) return null as any;
      await tx.empPromotion.deleteMany({ where: { manageEmployeeID: target.manageEmployeeID } });
      return target; // return the originally requested row (response not used by UI)
    });
  }

  private _includeAll() {
    return {
      serviceProvider: true,
      company: true,
      branches: true,
      departments: true,
      designations: true,
      workShift: true,
      attendancePolicy: true,
      leavePolicy: true,
      hourlyPayGrade: true,
      monthlyPayGrade: true,
      manageEmployee: true,
    };
  }
}
