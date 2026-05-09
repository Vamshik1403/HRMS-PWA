import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplianceRuleDto } from './dto/create-compliance-rule.dto';
import { UpdateComplianceRuleDto } from './dto/update-compliance-rule.dto';

@Injectable()
export class ComplianceRulesService {
  constructor(private readonly prisma: PrismaService) {}

  private includeRels() {
    return {
      serviceProvider: true,
      company: true,
    };
  }

  async create(dto: CreateComplianceRuleDto) {
    return this.prisma.complianceRule.create({
      data: {
        serviceProviderID: dto.serviceProviderID ?? null,
        companyID: dto.companyID ?? null,
        ruleText: dto.ruleText,
        isActive: dto.isActive ?? false,
      },
      include: this.includeRels(),
    });
  }

  async findAll(companyID?: number) {
    return this.prisma.complianceRule.findMany({
      where: companyID ? { companyID } : undefined,
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const rule = await this.prisma.complianceRule.findUnique({
      where: { id },
      include: this.includeRels(),
    });
    if (!rule) throw new NotFoundException(`ComplianceRule id ${id} not found`);
    return rule;
  }

  async update(id: number, dto: UpdateComplianceRuleDto) {
    await this.ensureExists(id);
    return this.prisma.complianceRule.update({
      where: { id },
      data: {
        serviceProviderID: dto.serviceProviderID ?? undefined,
        companyID: dto.companyID ?? undefined,
        ruleText: dto.ruleText ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
      include: this.includeRels(),
    });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    return this.prisma.complianceRule.delete({
      where: { id },
      include: this.includeRels(),
    });
  }

  private async ensureExists(id: number) {
    const rule = await this.prisma.complianceRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException(`ComplianceRule id ${id} not found`);
  }
}
