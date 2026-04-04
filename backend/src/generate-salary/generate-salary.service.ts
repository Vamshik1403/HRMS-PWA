// src/generate-salary/generate-salary.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGenerateSalaryDto } from './dto/create-generate-salary.dto';
import { UpdateGenerateSalaryDto } from './dto/update-generate-salary.dto';

@Injectable()
export class GenerateSalaryService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateGenerateSalaryDto) {
    const {
      serviceProviderID,
      companyID,
      branchesID,
      employeeID,
      monthPeriod,
      paymentMode,
      paymentType,
      paymentDate,
      paymentRemark,
      paymentProof,
    } = dto;

    return this.prisma.generateSalary.create({
      data: {
        serviceProviderID: serviceProviderID ?? null,
        companyID: companyID ?? null,
        branchesID: branchesID ?? null,
        employeeID, 
        monthPeriod: monthPeriod,
        paymentMode: paymentMode ? `${paymentMode}` : null, 
        paymentType: paymentType ? `${paymentType}` : null,
        paymentDate: paymentDate ? `${paymentDate}` : null,
        paymentRemark: paymentRemark ? `${paymentRemark}` : null,
        paymentProof: paymentProof ? `${paymentProof}` : null,
        status: "Pending",
      },
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

  findAll() {
    return this.prisma.generateSalary.findMany({
      orderBy: { id: 'desc' },
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.generateSalary.findUnique({
      where: { id },
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

 async update(id: number, dto: UpdateGenerateSalaryDto) {
  const {
    serviceProviderID,
    companyID,
    branchesID,
    employeeID,
    monthPeriod,
    paymentMode,
    paymentType,
    paymentDate,
    paymentRemark,
    paymentProof,
  } = dto;

  // 👇 Automatically mark Paid if paymentMode and paymentDate exist
  const newStatus =
    paymentMode && paymentDate ? "Paid" : undefined;

  // Build updateData dynamically — only include defined values
  const updateData: any = {};

  if (serviceProviderID !== undefined) updateData.serviceProviderID = serviceProviderID;
  if (companyID !== undefined) updateData.companyID = companyID;
  if (branchesID !== undefined) updateData.branchesID = branchesID;
  if (employeeID !== undefined) updateData.employeeID = employeeID;
  if (monthPeriod !== undefined) updateData.monthPeriod = monthPeriod;

  // ✅ Only update payment fields if provided
  if (paymentMode !== undefined) updateData.paymentMode = paymentMode;
  if (paymentType !== undefined) updateData.paymentType = paymentType;
  if (paymentDate !== undefined) updateData.paymentDate = paymentDate;
  if (paymentRemark !== undefined) updateData.paymentRemark = paymentRemark;
  if (paymentProof !== undefined) updateData.paymentProof = paymentProof;

  // ✅ Apply newStatus if calculated
  if (newStatus) updateData.status = newStatus;

  return this.prisma.generateSalary.update({
    where: { id },
    data: updateData,
    include: {
      serviceProvider: true,
      company: true,
      branches: true,
      manageEmployee: true,
    },
  });
}

  remove(id: number) {
    return this.prisma.generateSalary.delete({ where: { id } });
  }
}