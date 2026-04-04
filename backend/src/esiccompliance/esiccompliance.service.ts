import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateESICComplianceDto } from './dto/create-esiccompliance.dto';
import { UpdateESICComplianceDto } from './dto/update-esiccompliance.dto';

@Injectable()
export class ESICComplianceService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateESICComplianceDto) {
    return this.prisma.eSICCompliance.create({
      data: {
        companyID: dto.companyID,
        esicThresholdCount: dto.esicThresholdCount ?? undefined,
        esicApplicable: dto.esicApplicable ?? undefined,
        wageCeiling: dto.wageCeiling ?? undefined,
        disabledWageCeiling: dto.disabledWageCeiling ?? undefined,
        employeeRate: dto.employeeRate ?? undefined,
        employerRate: dto.employerRate ?? undefined,
        dueDate: dto.dueDate ?? undefined,
      },
    });
  }

  async findAll() {
    return this.prisma.eSICCompliance.findMany({
      include: {
        company: true,
      },
      orderBy: { id: 'desc' },
    });
  }

  async findByCompany(companyID: number) {
    const data = await this.prisma.eSICCompliance.findUnique({
      where: { companyID },
      include: { company: true },
    });

    if (!data) throw new NotFoundException('ESIC Compliance not found');
    return data;
  }

  async update(companyID: number, dto: UpdateESICComplianceDto) {
    await this.findByCompany(companyID);

    return this.prisma.eSICCompliance.update({
      where: { companyID },
      data: {
        esicThresholdCount: dto.esicThresholdCount ?? undefined,
        esicApplicable: dto.esicApplicable ?? undefined,
        wageCeiling: dto.wageCeiling ?? undefined,
        disabledWageCeiling: dto.disabledWageCeiling ?? undefined,
        employeeRate: dto.employeeRate ?? undefined,
        employerRate: dto.employerRate ?? undefined,
        dueDate: dto.dueDate ?? undefined,
      },
    });
  }

  async remove(companyID: number) {
    await this.findByCompany(companyID);
    return this.prisma.eSICCompliance.delete({
      where: { companyID },
    });
  }
}