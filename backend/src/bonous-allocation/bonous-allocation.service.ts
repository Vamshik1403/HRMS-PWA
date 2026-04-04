import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBonusAllocationDto } from './dto/create-bonous-allocation.dto';
import { UpdateBonusAllocationDto } from './dto/update-bonous-allocation.dto';


@Injectable()
export class BonusAllocationService {
  constructor(private readonly prisma: PrismaService) {}

  private includeRels() {
    return {
      bonusSetup: true,        // include BonusSetup details
      manageEmployee: true,    // include ManageEmployee details
    };
  }

  async create(dto: CreateBonusAllocationDto) {
    const created = await this.prisma.bonusAllocation.create({
      data: {
        bonusSetupID: dto.bonusSetupID,
        employeeID: dto.employeeID,
        financialYear: dto.financialYear ?? null,
        salaryPeriod: dto.salaryPeriod ?? null,
      },
      include: this.includeRels(),
    });
    return created;
  }

  async findAll() {
    return this.prisma.bonusAllocation.findMany({
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const rec = await this.prisma.bonusAllocation.findUnique({
      where: { id },
      include: this.includeRels(),
    });
    if (!rec) throw new NotFoundException(`BonusAllocation id ${id} not found`);
    return rec;
  }

  async update(id: number, dto: UpdateBonusAllocationDto) {
    await this.ensureExists(id);
    return this.prisma.bonusAllocation.update({
      where: { id },
      data: {
        bonusSetupID: dto.bonusSetupID ?? undefined,
        employeeID: dto.employeeID ?? undefined,
        financialYear: dto.financialYear ?? undefined,
        salaryPeriod: dto.salaryPeriod ?? undefined,
      },
      include: this.includeRels(),
    });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    return this.prisma.bonusAllocation.delete({
      where: { id },
      include: this.includeRels(),
    });
  }

  private async ensureExists(id: number) {
    const ok = await this.prisma.bonusAllocation.findUnique({ where: { id } });
    if (!ok) throw new NotFoundException(`BonusAllocation id ${id} not found`);
  }
}
