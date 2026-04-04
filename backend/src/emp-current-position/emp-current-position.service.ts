import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateEmpCurrentPositionDto } from './dto/create-emp-current-position.dto';
import { UpdateEmpCurrentPositionDto } from './dto/update-emp-current-position.dto';

@Injectable()
export class EmpCurrentPositionService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateEmpCurrentPositionDto) {
    const payload: Prisma.EmpCurrentPositionCreateInput = {
      serviceProvider: data.serviceProviderID ? { connect: { id: data.serviceProviderID } } : undefined,
      company:          data.companyID          ? { connect: { id: data.companyID } } : undefined,
      branches:         data.branchesID         ? { connect: { id: data.branchesID } } : undefined,
      manageEmployee:   data.manageEmployeeID   ? { connect: { id: data.manageEmployeeID } } : undefined,

      departments:      data.existingDepartmentID     ? { connect: { id: data.existingDepartmentID } } : undefined,
      designations:     data.existingDesignationID    ? { connect: { id: data.existingDesignationID } } : undefined,
      monthlyPayGrade:  data.existingMonthlyPayGradeID? { connect: { id: data.existingMonthlyPayGradeID } } : undefined,
      hourlyPayGrade:   data.existingHourlyPayGradeID ? { connect: { id: data.existingHourlyPayGradeID } } : undefined,

      existingSalaryCtc:      data.existingSalaryCtc,
      existingEmploymentType: data.existingEmploymentType,
      effectiveFrom:          data.effectiveFrom ? new Date(data.effectiveFrom) : null,
      effectiveTo:            data.effectiveTo ? new Date(data.effectiveTo) : null,
      createdAt:              new Date(),
    };
    return this.prisma.empCurrentPosition.create({ data: payload });
  }

  findAll(params: { skip?: number; take?: number; manageEmployeeID?: number } = {}) {
    const { skip, take, manageEmployeeID } = params;
    return this.prisma.empCurrentPosition.findMany({
      skip,
      take,
      where: manageEmployeeID ? { manageEmployeeID } : undefined,
      orderBy: { id: 'desc' },
      include: {
        branches: true,
        company: true,
        departments: true,
        designations: true,
        hourlyPayGrade: true,
        monthlyPayGrade: true,
        manageEmployee: true,
        serviceProvider: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.empCurrentPosition.findUnique({
      where: { id },
      include: {
        branches: true,
        company: true,
        departments: true,
        designations: true,
        hourlyPayGrade: true,
        monthlyPayGrade: true,
        manageEmployee: true,
        serviceProvider: true,
      },
    });
  }

  update(id: number, data: UpdateEmpCurrentPositionDto) {
    const connectOrUndefined = (key?: number, model?: string) =>
      key ? { connect: { id: key } } : undefined;

    return this.prisma.empCurrentPosition.update({
      where: { id },
      data: {
        serviceProvider: connectOrUndefined(data.serviceProviderID, 'ServiceProvider'),
        company:         connectOrUndefined(data.companyID, 'Company'),
        branches:        connectOrUndefined(data.branchesID, 'Branches'),
        manageEmployee:  connectOrUndefined(data.manageEmployeeID, 'ManageEmployee'),

        departments:     connectOrUndefined(data.existingDepartmentID, 'Departments'),
        designations:    connectOrUndefined(data.existingDesignationID, 'Designations'),
        monthlyPayGrade: connectOrUndefined(data.existingMonthlyPayGradeID, 'MonthlyPayGrade'),
        hourlyPayGrade:  connectOrUndefined(data.existingHourlyPayGradeID, 'HourlyPayGrade'),

        existingSalaryCtc:      data.existingSalaryCtc,
        existingEmploymentType: data.existingEmploymentType,
        effectiveFrom:          data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
        effectiveTo:            data.effectiveTo ? new Date(data.effectiveTo) : undefined,
      },
    });
  }

  remove(id: number) {
    return this.prisma.empCurrentPosition.delete({ where: { id } });
  }
}
