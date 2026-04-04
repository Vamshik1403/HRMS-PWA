import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMonthlyPayGradeDto } from './dto/create-monthly-pay-grade.dto';
import { UpdateMonthlyPayGradeDto } from './dto/update-monthly-pay-grade.dto';

@Injectable()
export class MonthlyPayGradeService {
  constructor(private readonly prisma: PrismaService) {}

  private includeRels() {
    return {
      branches: true,
      company: true,
      serviceProvider: true,
      monthlyPayGradeAllowanceList: {
        include: { salaryAllowance: true },
      },
      monthlyPayGradeDeductionList: {
        include: { salaryDeduction: true },
      },
    };
  }

  async create(dto: CreateMonthlyPayGradeDto) {
    const { allowanceIDs = [], deductionIDs = [], ...rest } = dto;

    const created = await this.prisma.monthlyPayGrade.create({
data: {
  serviceProviderID: rest.serviceProviderID ?? null,
  companyID: rest.companyID ?? null,
  branchesID: rest.branchesID ?? null,
  monthlyPayGradeName: rest.monthlyPayGradeName ?? null,
  payGradeType: rest.payGradeType ?? null,
  otRate: rest.otRate ?? null,
otStatus: rest.otStatus ?? false,
  miniOTTime: rest.miniOTTime ?? null,
  grossSalary: rest.grossSalary ?? null,               // String?
        percentageOfBasic: rest.percentageOfBasic ?? null,   // String?
        basicSalary: rest.basicSalary ?? null,               // Int?

        monthlyPayGradeAllowanceList: {
          create: allowanceIDs.map((aid) => ({
            salaryallowanceID: aid,
          })),
        },
        monthlyPayGradeDeductionList: {
          create: deductionIDs.map((did) => ({
            salaryDeductionID: did,
          })),
        },
      },
      include: this.includeRels(),
    });

    return created;
  }

  async findAll() {
    return this.prisma.monthlyPayGrade.findMany({
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const rec = await this.prisma.monthlyPayGrade.findUnique({
      where: { id },
      include: this.includeRels(),
    });
    if (!rec) throw new NotFoundException(`MonthlyPayGrade id ${id} not found`);
    return rec;
  }

  async update(id: number, dto: UpdateMonthlyPayGradeDto) {
    await this.ensureExists(id);

    const { allowanceIDs, deductionIDs, ...rest } = dto;

    // Update base record
    const updated = await this.prisma.monthlyPayGrade.update({
      where: { id },
data: {
  serviceProviderID: rest.serviceProviderID ?? undefined,
  companyID: rest.companyID ?? undefined,
  branchesID: rest.branchesID ?? undefined,
  monthlyPayGradeName: rest.monthlyPayGradeName ?? undefined,
  payGradeType: rest.payGradeType ?? undefined,
  otRate: rest.otRate ?? undefined,
otStatus: rest.otStatus ?? false,
  miniOTTime: rest.miniOTTime ?? undefined,
  grossSalary: rest.grossSalary ?? undefined,
        percentageOfBasic: rest.percentageOfBasic ?? undefined,
        basicSalary: rest.basicSalary ?? undefined,
      },
      include: this.includeRels(),
    });

    // Reset & re-create junctions if arrays provided
    const tx: any[] = [];
    if (Array.isArray(allowanceIDs)) {
      tx.push(
        this.prisma.monthlyPayGradeAllowanceList.deleteMany({ where: { monthlyPayGradeID: id } }),
        this.prisma.monthlyPayGradeAllowanceList.createMany({
          data: allowanceIDs.map((aid) => ({ monthlyPayGradeID: id, salaryallowanceID: aid })),
        }),
      );
    }
    if (Array.isArray(deductionIDs)) {
      tx.push(
        this.prisma.monthlyPayGradeDeductionList.deleteMany({ where: { monthlyPayGradeID: id } }),
        this.prisma.monthlyPayGradeDeductionList.createMany({
          data: deductionIDs.map((did) => ({ monthlyPayGradeID: id, salaryDeductionID: did })),
        }),
      );
    }
    if (tx.length) await this.prisma.$transaction(tx);

    // return fresh record
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.ensureExists(id);
    // Remove junction rows first (optional if FK CASCADE is set; your schema is NoAction)
    await this.prisma.$transaction([
      this.prisma.monthlyPayGradeAllowanceList.deleteMany({ where: { monthlyPayGradeID: id } }),
      this.prisma.monthlyPayGradeDeductionList.deleteMany({ where: { monthlyPayGradeID: id } }),
    ]);

    return this.prisma.monthlyPayGrade.delete({
      where: { id },
      include: this.includeRels(),
    });
  }

  private async ensureExists(id: number) {
    const ok = await this.prisma.monthlyPayGrade.findUnique({ where: { id } });
    if (!ok) throw new NotFoundException(`MonthlyPayGrade id ${id} not found`);
  }
}
