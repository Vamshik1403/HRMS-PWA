import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { UpdateContractorDto } from './dto/update-contractor.dto';

@Injectable()
export class ContractorsService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateContractorDto) {
    return this.prisma.contractors.create({ data });
  }

  // contractors.service.ts
findAll() {
  return this.prisma.contractors.findMany({
    orderBy: { id: 'desc' },
    include: { serviceProvider: true, company: true },
  });
}


  findOne(id: number) {
    return this.prisma.contractors.findUnique({ where: { id } });
  }

  update(id: number, data: UpdateContractorDto) {
    return this.prisma.contractors.update({
      where: { id },
      data,
    });
  }

  remove(id: number) {
    return this.prisma.contractors.delete({ where: { id } });
  }

  // --- Contractor Rate Card ---

  findRateCards(contractorID: number) {
    return this.prisma.contractorRateCard.findMany({
      where: { contractorID },
      orderBy: { id: 'asc' },
    });
  }

  saveRateCards(contractorID: number, rateCards: { contractorName?: string; departmentName?: string; designation?: string; workShiftName?: string; perMinuteRate?: number; perHourRate?: number; perDayRate?: number; perMonthRate?: number; otPerMinuteRate?: number; otPerHourRate?: number }[]) {
    return this.prisma.$transaction(async (prisma) => {
      await prisma.contractorRateCard.deleteMany({ where: { contractorID } });
      if (rateCards && rateCards.length > 0) {
        await prisma.contractorRateCard.createMany({
          data: rateCards.map((rc) => ({
            contractorID,
            contractorName: rc.contractorName,
            departmentName: rc.departmentName,
            designation: rc.designation,
            workShiftName: rc.workShiftName,
            perMinuteRate: rc.perMinuteRate ?? 0,
            perHourRate: rc.perHourRate ?? 0,
            perDayRate: rc.perDayRate ?? 0,
            perMonthRate: rc.perMonthRate ?? 0,
            otPerMinuteRate: rc.otPerMinuteRate ?? 0,
            otPerHourRate: rc.otPerHourRate ?? 0,
          })),
        });
      }
      return prisma.contractorRateCard.findMany({
        where: { contractorID },
        orderBy: { id: 'asc' },
      });
    });
  }
}
