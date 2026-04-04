import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSalaryCycleDto } from './dto/create-salary-cycle.dto';
import { UpdateSalaryCycleDto } from './dto/update-salary-cycle.dto';
import { FindSalaryCycleQueryDto } from './dto/find-salary-cycle.query.dto';

@Injectable()
export class SalaryCycleService {
  constructor(private readonly prisma: PrismaService) {}

  private includeRels() {
    return {
      branches: true,
      company: true,
      serviceProvider: true,
    };
  }

  async create(dto: CreateSalaryCycleDto) {
    return this.prisma.salaryCycle.create({
      data: {
        serviceProviderID: dto.serviceProviderID ?? null,
        companyID: dto.companyID ?? null,
        branchesID: dto.branchesID ?? null,
        salaryCycleName: dto.salaryCycleName ?? null,
        monthStartDay: dto.monthStartDay ?? null,
      },
      include: this.includeRels(),
    });
  }

  async findAll() {
    return this.prisma.salaryCycle.findMany({
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

   async findByCompany(companyID: number) {
    return this.prisma.salaryCycle.findMany({
      where: { companyID },
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }


  async findOne(id: number) {
    const rec = await this.prisma.salaryCycle.findUnique({
      where: { id },
      include: this.includeRels(),
    });
    if (!rec) throw new NotFoundException(`SalaryCycle id ${id} not found`);
    return rec;
  }

  async update(id: number, dto: UpdateSalaryCycleDto) {
    await this.ensureExists(id);
    return this.prisma.salaryCycle.update({
      where: { id },
      data: {
        serviceProviderID: dto.serviceProviderID ?? undefined,
        companyID: dto.companyID ?? undefined,
        branchesID: dto.branchesID ?? undefined,
        salaryCycleName: dto.salaryCycleName ?? undefined,
        monthStartDay: dto.monthStartDay ?? undefined,
      },
      include: this.includeRels(),
    });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    return this.prisma.salaryCycle.delete({
      where: { id },
      include: this.includeRels(),
    });
  }

  private async ensureExists(id: number) {
    const ok = await this.prisma.salaryCycle.findUnique({ where: { id } });
    if (!ok) throw new NotFoundException(`SalaryCycle id ${id} not found`);
  }
}
