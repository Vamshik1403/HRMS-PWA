import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSalaryAdvanceRepaymentDto } from './dto/create-salary-advance-repayment.dto';
import { UpdateSalaryAdvanceRepaymentDto } from './dto/update-salary-advance-repayment.dto';

@Injectable()
export class SalaryAdvanceRepaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSalaryAdvanceRepaymentDto) {
    return this.prisma.salaryAdvanceRepayment.create({ data: dto });
  }

  async findAll() {
    return this.prisma.salaryAdvanceRepayment.findMany({ include: { salaryAdvance: true } });
  }

  async findByAdvance(salaryAdvanceID: number) {
    return this.prisma.salaryAdvanceRepayment.findMany({
      where: { salaryAdvanceID },
      orderBy: { id: 'asc' },
    });
  }

  async update(id: number, dto: UpdateSalaryAdvanceRepaymentDto) {
    return this.prisma.salaryAdvanceRepayment.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    return this.prisma.salaryAdvanceRepayment.delete({ where: { id } });
  }
}
