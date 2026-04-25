import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePFComplianceDto } from './dto/create-pfcompliance.dto';
import { UpdatePFComplianceDto } from './dto/update-pfcompliance.dto';

@Injectable()
export class PFComplianceService {
  constructor(private prisma: PrismaService) {}

  // ✅ Create
  async create(dto: CreatePFComplianceDto) {
    return this.prisma.pFCompliance.create({
      data: {
        companyID: dto.companyID,
        epfThresholdCount: dto.epfThresholdCount ?? undefined,
        epfApplicable: dto.epfApplicable ?? undefined,
        voluntaryEnabled: dto.voluntaryEnabled ?? undefined,
        wageCeiling: dto.wageCeiling ?? undefined,
        basicValidationPercent: dto.basicValidationPercent ?? undefined,
        compulsoryForAll: dto.compulsoryForAll ?? undefined,

        employeeRate: dto.employeeRate ?? undefined,
        employerRate: dto.employerRate ?? undefined,
        epsRate: dto.epsRate ?? undefined,
        edliRate: dto.edliRate ?? undefined,
        adminChargeRate: dto.adminChargeRate ?? undefined,

        edliMax: dto.edliMax ?? undefined,
        adminChargeMax: dto.adminChargeMax ?? undefined,
        dueDate: dto.dueDate ?? undefined,
      },
    });
  }












  
  // ✅ Find All
  async findAll() {
    return this.prisma.pFCompliance.findMany({
      include: {
        company: true,
      },
      orderBy: { id: 'desc' },
    });
  }

  // ✅ Find One by Company
  async findByCompany(companyID: number) {
    const data = await this.prisma.pFCompliance.findUnique({
      where: { companyID },
      include: { company: true },
    });

    if (!data) throw new NotFoundException('PF Compliance not found');

    return data;
  }

  // ✅ Update
  async update(companyID: number, dto: UpdatePFComplianceDto) {
    await this.findByCompany(companyID);

    return this.prisma.pFCompliance.update({
      where: { companyID },
      data: {
        epfThresholdCount: dto.epfThresholdCount ?? undefined,
        epfApplicable: dto.epfApplicable ?? undefined,
        voluntaryEnabled: dto.voluntaryEnabled ?? undefined,
        wageCeiling: dto.wageCeiling ?? undefined,
        basicValidationPercent: dto.basicValidationPercent ?? undefined,
        compulsoryForAll: dto.compulsoryForAll ?? undefined,

        employeeRate: dto.employeeRate ?? undefined,
        employerRate: dto.employerRate ?? undefined,
        epsRate: dto.epsRate ?? undefined,
        edliRate: dto.edliRate ?? undefined,
        adminChargeRate: dto.adminChargeRate ?? undefined,

        edliMax: dto.edliMax ?? undefined,
        adminChargeMax: dto.adminChargeMax ?? undefined,
        dueDate: dto.dueDate ?? undefined,
      },
    });
  }

  // ✅ Delete
  async remove(companyID: number) {
    await this.findByCompany(companyID);

    return this.prisma.pFCompliance.delete({
      where: { companyID },
    });
  }
}
