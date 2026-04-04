import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreatePromotionRequestDto } from './dto/create-promotion-request.dto';
import { UpdatePromotionRequestDto } from './dto/update-promotion-request.dto';

@Injectable()
export class PromotionRequestService {
  constructor(private prisma: PrismaService) {}

  
  findAll(params: { skip?: number; take?: number; manageEmployeeID?: number; status?: string } = {}) {
    const { skip, take, manageEmployeeID, status } = params;
    return this.prisma.promotionRequest.findMany({
      skip,
      take,
      where: {
        ...(manageEmployeeID ? { manageEmployeeID } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { id: 'desc' },
      include: this._includeAll(),
    });
  }

  findOne(id: number) {
    return this.prisma.promotionRequest.findUnique({
      where: { id },
      include: this._includeAll(),
    });
  }

  update(id: number, data: UpdatePromotionRequestDto) {
    return this.prisma.promotionRequest.update({
      where: { id },
      data: {
        empID: data.empID,
        description: data.description,
        status: data.status,
        promotionDate: data.promotionDate ? new Date(data.promotionDate) : undefined,

        // connect updates – only if provided
        departments_promotionRequest_currentDepartmentIDTodepartments: data.newDepartmentID
          ? { connect: { id: data.newDepartmentID } }
          : undefined,
        designations_promotionRequest_currentDesignationIDTodesignations: data.newDesignationID
          ? { connect: { id: data.newDesignationID } }
          : undefined,
        monthlyPayGrade_promotionRequest_currentMonthlyPayGradeIDTomonthlyPayGrade: data.newMonthlyPayGradeID
          ? { connect: { id: data.newMonthlyPayGradeID } }
          : undefined,
        hourlyPayGrade_promotionRequest_currentHourlyPayGradeIDTohourlyPayGrade: data.newHourlyPayGradeID
          ? { connect: { id: data.newHourlyPayGradeID } }
          : undefined,

        newSalaryCtc: data.newSalaryCtc,
        newEmploymentType: data.newEmploymentType,
        newEmployementStatus: data.newEmployementStatus,

        departments_promotionRequest_proposedDepartmentIDTodepartments: data.proposedDepartmentID
          ? { connect: { id: data.proposedDepartmentID } }
          : undefined,
        designations_promotionRequest_proposedDesignationIDTodesignations: data.proposedDesignationID
          ? { connect: { id: data.proposedDesignationID } }
          : undefined,
        monthlyPayGrade_promotionRequest_proposedMonthlyPayGradeIDTomonthlyPayGrade: data.proposedMonthlyPayGradeID
          ? { connect: { id: data.proposedMonthlyPayGradeID } }
          : undefined,
        hourlyPayGrade_promotionRequest_proposedHourlyPayGradeIDTohourlyPayGrade: data.proposedHourlyPayGradeID
          ? { connect: { id: data.proposedHourlyPayGradeID } }
          : undefined,

        proposedSalaryCtc: data.proposedSalaryCtc,
        proposedEmploymentType: data.proposedEmploymentType,

        manageEmployee: data.manageEmployeeID ? { connect: { id: data.manageEmployeeID } } : undefined,

        updated_at: new Date(),
      },
      include: this._includeAll(),
    });
  }

  remove(id: number) {
    return this.prisma.promotionRequest.delete({ where: { id } });
  }

  // helper: include all related nodes for convenient responses
  private _includeAll() {
    return {
      manageEmployee: true,
      departments_promotionRequest_currentDepartmentIDTodepartments: true,
      designations_promotionRequest_currentDesignationIDTodesignations: true,
      monthlyPayGrade_promotionRequest_currentMonthlyPayGradeIDTomonthlyPayGrade: true,
      hourlyPayGrade_promotionRequest_currentHourlyPayGradeIDTohourlyPayGrade: true,
      departments_promotionRequest_proposedDepartmentIDTodepartments: true,
      designations_promotionRequest_proposedDesignationIDTodesignations: true,
      monthlyPayGrade_promotionRequest_proposedMonthlyPayGradeIDTomonthlyPayGrade: true,
      hourlyPayGrade_promotionRequest_proposedHourlyPayGradeIDTohourlyPayGrade: true,
    };
  }
}
