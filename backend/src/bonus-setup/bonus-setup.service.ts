import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBonusSetupDto } from './dto/create-bonus-setup.dto';
import { UpdateBonusSetupDto } from './dto/update-bonus-setup.dto';

@Injectable()
export class BonusSetupService {
  constructor(private readonly prisma: PrismaService) {}

  private includeRels() {
    return {
      serviceProvider: true,
      company: true,
      branches: true,
      // If you need children, include them:
      genarateBonus: false,
    };
  }

  async create(dto: CreateBonusSetupDto) {
    const rec = await this.prisma.bonusSetup.create({
      data: {
        serviceProviderID: dto.serviceProviderID ?? null,
        companyID: dto.companyID ?? null,
        branchesID: dto.branchesID ?? null,
        bonusName: dto.bonusName ?? null,
        bonusType:dto.bonusType ?? null,
        bonusDescription: dto.bonusDescription ?? null,
        bonusBasedOn: dto.bonusBasedOn ?? null,
        bonusPercentage: dto.bonusPercentage ?? null,
        bonusFixed: dto.bonusFixed ?? null,
      },
      include: this.includeRels(),
    });
    return rec;
  }

  async findAll() {
    return this.prisma.bonusSetup.findMany({
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const rec = await this.prisma.bonusSetup.findUnique({
      where: { id },
      include: this.includeRels(),
    });
    if (!rec) throw new NotFoundException(`BonusSetup id ${id} not found`);
    return rec;
  }

  async update(id: number, dto: UpdateBonusSetupDto) {
    await this.ensureExists(id);
    return this.prisma.bonusSetup.update({
      where: { id },
      data: {
        serviceProviderID: dto.serviceProviderID ?? undefined,
        companyID: dto.companyID ?? undefined,
        branchesID: dto.branchesID ?? undefined,
        bonusName: dto.bonusName ?? undefined,
        bonusType:dto.bonusType ?? undefined,
        bonusDescription: dto.bonusDescription ?? undefined,
        bonusBasedOn: dto.bonusBasedOn ?? undefined,
        bonusPercentage: dto.bonusPercentage ?? undefined,
        bonusFixed: dto.bonusFixed ?? undefined,
      },
      include: this.includeRels(),
    });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    // If there are dependent rows in genarateBonus and FK is RESTRICT/NoAction,
    // delete those first or add ON DELETE CASCADE in schema.
    return this.prisma.bonusSetup.delete({
      where: { id },
      include: this.includeRels(),
    });
  }

  private async ensureExists(id: number) {
    const ok = await this.prisma.bonusSetup.findUnique({ where: { id } });
    if (!ok) throw new NotFoundException(`BonusSetup id ${id} not found`);
  }
}
