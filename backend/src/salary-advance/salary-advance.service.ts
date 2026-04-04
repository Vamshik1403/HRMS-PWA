import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSalaryAdvanceDto } from './dto/create-salary-advance.dto';
import { UpdateSalaryAdvanceDto } from './dto/update-salary-advance.dto';

@Injectable()
export class SalaryAdvanceService {
  constructor(private readonly prisma: PrismaService) {}

  private includeRels() {
    return {
      company: true,
      branches: true,
      serviceProvider: true,
      manageEmployee: true,
    };
  }

  async create(dto: CreateSalaryAdvanceDto) {
    return this.prisma.salaryAdvance.create({
      data: dto,
      include: this.includeRels(),
    });
  }

  async findAll() {
    return this.prisma.salaryAdvance.findMany({
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const rec = await this.prisma.salaryAdvance.findUnique({
      where: { id },
      include: this.includeRels(),
    });
    if (!rec) throw new NotFoundException(`SalaryAdvance id ${id} not found`);
    return rec;
  }

  async update(id: number, dto: UpdateSalaryAdvanceDto) {
    await this.ensureExists(id);
    return this.prisma.salaryAdvance.update({
      where: { id },
      data: dto,
      include: this.includeRels(),
    });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    return this.prisma.salaryAdvance.delete({
      where: { id },
      include: this.includeRels(),
    });
  }

  private async ensureExists(id: number) {
    const ok = await this.prisma.salaryAdvance.findUnique({ where: { id } });
    if (!ok) throw new NotFoundException(`SalaryAdvance id ${id} not found`);
  }
}
