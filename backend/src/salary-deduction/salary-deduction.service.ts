import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSalaryDeductionDto } from './dto/create-salary-deduction.dto';
import { UpdateSalaryDeductionDto } from './dto/update-salary-deduction.dto';

@Injectable()
export class SalaryDeductionService {
  constructor(private readonly prisma: PrismaService) {}

  private includeRels() {
    return {
      branches: true,
      company: true,
      serviceProvider: true,
      monthlyPayGradeDeductionList: true,
    };
  }

  async create(dto: CreateSalaryDeductionDto) {
    return this.prisma.salaryDeduction.create({
      data: {
        serviceProviderID: dto.serviceProviderID ?? null,
        companyID: dto.companyID ?? null,
        branchesID: dto.branchesID ?? null,
        salaryDeductionName: dto.salaryDeductionName ?? null,
        basedOn: dto.basedOn ?? null,
        salaryDeductionType: dto.salaryDeductionType ?? null,
        salaryDeductionValue: dto.salaryDeductionValue ?? null,
        salaryDeductionMonthLimit: dto.salaryDeductionMonthLimit ?? null,
      },
      include: this.includeRels(),
    });
  }

  async findAll() {
    return this.prisma.salaryDeduction.findMany({
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const rec = await this.prisma.salaryDeduction.findUnique({
      where: { id },
      include: this.includeRels(),
    });
    if (!rec) throw new NotFoundException(`SalaryDeduction id ${id} not found`);
    return rec;
  }

  async update(id: number, dto: UpdateSalaryDeductionDto) {
    await this.ensureExists(id);
    return this.prisma.salaryDeduction.update({
      where: { id },
      data: {
        serviceProviderID: dto.serviceProviderID ?? undefined,
        companyID: dto.companyID ?? undefined,
        branchesID: dto.branchesID ?? undefined,
        salaryDeductionName: dto.salaryDeductionName ?? undefined,
        basedOn: dto.basedOn ?? null,
        salaryDeductionType: dto.salaryDeductionType ?? undefined,
        salaryDeductionValue: dto.salaryDeductionValue ?? undefined,
        salaryDeductionMonthLimit: dto.salaryDeductionMonthLimit ?? undefined,
      },
      include: this.includeRels(),
    });
  }

 async remove(id: number) {
  await this.ensureExists(id);

  // Delete dependent MonthlyPayGradeDeductionList entries first
  await this.prisma.monthlyPayGradeDeductionList.deleteMany({
    where: { salaryDeductionID: id },
  });

  return this.prisma.salaryDeduction.delete({
    where: { id },
  });
}


  private async ensureExists(id: number) {
    const ok = await this.prisma.salaryDeduction.findUnique({ where: { id } });
    if (!ok) throw new NotFoundException(`SalaryDeduction id ${id} not found`);
  }
}
