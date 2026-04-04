import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateHourlyPayGradeDto } from './dto/create-hourly-grade.dto';
import { UpdateHourlyPayGradeDto } from './dto/update-hourly-grade.dto';


@Injectable()
export class HourlyPayGradeService {
  constructor(private readonly prisma: PrismaService) {}

  private includeRels() {
    return {
      serviceProvider: true,
      company: true,
      branches: true,
    };
  }

  async create(dto: CreateHourlyPayGradeDto) {
    const created = await this.prisma.hourlyPayGrade.create({
      data: {
        serviceProviderID: dto.serviceProviderID ?? null,
        companyID: dto.companyID ?? null,
        branchesID: dto.branchesID ?? null,
        hourlyPayGradeName: dto.hourlyPayGradeName ?? null,
        hourlyRate: dto.hourlyRate ?? null, // String?
      },
      include: this.includeRels(),
    });
    return created;
  }

  async findAll() {
    return this.prisma.hourlyPayGrade.findMany({
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const rec = await this.prisma.hourlyPayGrade.findUnique({
      where: { id },
      include: this.includeRels(),
    });
    if (!rec) throw new NotFoundException(`HourlyPayGrade id ${id} not found`);
    return rec;
  }

  async update(id: number, dto: UpdateHourlyPayGradeDto) {
    await this.ensureExists(id);
    return this.prisma.hourlyPayGrade.update({
      where: { id },
      data: {
        serviceProviderID: dto.serviceProviderID ?? undefined,
        companyID: dto.companyID ?? undefined,
        branchesID: dto.branchesID ?? undefined,
        hourlyPayGradeName: dto.hourlyPayGradeName ?? undefined,
        hourlyRate: dto.hourlyRate ?? undefined,
      },
      include: this.includeRels(),
    });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    return this.prisma.hourlyPayGrade.delete({
      where: { id },
      include: this.includeRels(),
    });
  }

  private async ensureExists(id: number) {
    const ok = await this.prisma.hourlyPayGrade.findUnique({ where: { id } });
    if (!ok) throw new NotFoundException(`HourlyPayGrade id ${id} not found`);
  }
}
