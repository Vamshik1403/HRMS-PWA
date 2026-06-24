import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { UpdateContractorDto } from './dto/update-contractor.dto';

@Injectable()
export class ContractorsService {
  constructor(private prisma: PrismaService) { }

   async create(data: CreateContractorDto) {
    const { branchIDs, ...contractorData } = data as any;

    return this.prisma.contractors.create({
      data: {
        ...contractorData,
        contractorBranches: Array.isArray(branchIDs) && branchIDs.length > 0
          ? {
              create: branchIDs.map((branchID: number) => ({
                branchID: Number(branchID),
              })),
            }
          : undefined,
      },
      include: {
        serviceProvider: true,
        company: true,
        contractorBranches: {
          include: {
            branch: true,
          },
        },
      },
    });
  }

   findAll() {
    return this.prisma.contractors.findMany({
      orderBy: { id: 'desc' },
      include: {
        serviceProvider: true,
        company: true,
        contractorBranches: {
          include: {
            branch: true,
          },
        },
      },
    });
  }


  findOne(id: number) {
    return this.prisma.contractors.findUnique({
      where: { id },
      include: {
        serviceProvider: true,
        company: true,
        contractorBranches: {
          include: {
            branch: true,
          },
        },
      },
    });
  }

  async update(id: number, data: UpdateContractorDto) {
    const { branchIDs, ...contractorData } = data as any;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.contractors.update({
        where: { id },
        data: contractorData,
      });

      if (Array.isArray(branchIDs)) {
        await tx.contractorBranch.deleteMany({
          where: { contractorID: id },
        });

        if (branchIDs.length > 0) {
          await tx.contractorBranch.createMany({
            data: branchIDs.map((branchID: number) => ({
              contractorID: id,
              branchID: Number(branchID),
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.contractors.findUnique({
        where: { id },
        include: {
          serviceProvider: true,
          company: true,
          contractorBranches: {
            include: {
              branch: true,
            },
          },
        },
      });
    });
  }

   async remove(id: number) {
    await this.prisma.contractorBranch.deleteMany({
      where: { contractorID: id },
    });

    return this.prisma.contractors.delete({
      where: { id },
    });
  }

  // --- Contractor Rate Card ---


  findAllRateCards() {
    return this.prisma.contractorRateCard.findMany({
      orderBy: { id: 'asc' },
    });
  }

  findRateCards(contractorID: number) {
    return this.prisma.contractorRateCard.findMany({
      where: { contractorID },
      orderBy: { id: 'asc' },
    });
  }

  saveRateCards(contractorID: number, rateCards: { contractorName?: string; rateCardName?: string; branchName?: string; departmentName?: string; designation?: string; workShiftName?: string; payoutType?: string; perMinuteRate?: number; perHourRate?: number; perDayRate?: number; perMonthRate?: number; dailyRateMinute?: number; dailyRateHour?: number; monthlyRateMinute?: number; monthlyRateHours?: number; otType?: string; otPerMinuteRate?: number; otPerHourRate?: number; otRateMultiplier?: number; commissionType?: string; commissionBasedOn?: string; commissionValue?: number }[]) {
    return this.prisma.$transaction(async (prisma) => {
      await prisma.contractorRateCard.deleteMany({ where: { contractorID } });
      if (rateCards && rateCards.length > 0) {
        await prisma.contractorRateCard.createMany({
          data: rateCards.map((rc) => ({
            contractorID,
            contractorName: rc.contractorName,
            branchName: rc.branchName,
            departmentName: rc.departmentName,
            designation: rc.designation,
            workShiftName: rc.workShiftName,
            rateCardName: rc.rateCardName,
            payoutType: rc.payoutType,
            perMinuteRate: rc.perMinuteRate ?? 0,
            perHourRate: rc.perHourRate ?? 0,
            perDayRate: rc.perDayRate ?? 0,
            perMonthRate: rc.perMonthRate ?? 0,
            dailyRateMinute: rc.dailyRateMinute ?? 0,
            dailyRateHour: rc.dailyRateHour ?? 0,
            monthlyRateMinute: rc.monthlyRateMinute ?? 0,
            monthlyRateHours: rc.monthlyRateHours ?? 0,
            otType: rc.otType,
            otPerMinuteRate: rc.otPerMinuteRate ?? 0,
            otPerHourRate: rc.otPerHourRate ?? 0,
            otRateMultiplier: rc.otRateMultiplier ?? 0,
            commissionType: rc.commissionType,
            commissionBasedOn: rc.commissionBasedOn,
            commissionValue: rc.commissionValue ?? 0,
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
