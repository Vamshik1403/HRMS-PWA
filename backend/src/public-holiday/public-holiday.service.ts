import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto';
import { UpdatePublicHolidayDto } from './dto/update-public-holiday.dto';
import { EmployeeMemoService } from '../employee-memo/employee-memo.service';

@Injectable()
export class PublicHolidayService {
  constructor(
    private prisma: PrismaService,
    private employeeMemoService: EmployeeMemoService,
  ) {}

  private formatHolidayDate(value?: Date | string | null): string {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  private async postHolidayCompanyBroadcast(record: {
    companyID?: number | null;
    branchesID?: number | null;
    serviceProviderID?: number | null;
    manageHolidayID?: number | null;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    manageHoliday?: { holidayName?: string | null } | null;
  }): Promise<void> {
    if (!record.companyID) return;

    let holidayName = record.manageHoliday?.holidayName?.trim() || '';
    if (!holidayName && record.manageHolidayID) {
      const mh = await this.prisma.manageHoliday.findUnique({
        where: { id: record.manageHolidayID },
        select: { holidayName: true },
      });
      holidayName = mh?.holidayName?.trim() || '';
    }
    if (!holidayName) holidayName = 'Holiday';

    const start = this.formatHolidayDate(record.startDate);
    const end = this.formatHolidayDate(record.endDate);
    const datePart =
      start && end && start !== end
        ? ` (${start} to ${end})`
        : start
          ? ` (${start})`
          : '';

    await this.employeeMemoService.createSystemCompanyBroadcast({
      companyID: record.companyID,
      branchesID: record.branchesID,
      serviceProviderID: record.serviceProviderID,
      description: `Holiday announced: ${holidayName}${datePart}`,
    });
  }

  async create(data: CreatePublicHolidayDto) {
    const payload: Record<string, unknown> = { ...data };
    if (payload.startDate) {
      payload.startDate = new Date(String(payload.startDate));
    }
    if (payload.endDate) {
      payload.endDate = new Date(String(payload.endDate));
    }
    const created = await this.prisma.publicHoliday.create({
      data: payload as any,
      include: { manageHoliday: true },
    });
    void this.postHolidayCompanyBroadcast(created).catch(() => null);
    return created;
  }

  findAll() {
    return this.prisma.publicHoliday.findMany({
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
        manageHoliday: true,
        leavePolicyHoliday: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.publicHoliday.findUnique({
      where: { id },
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
        manageHoliday: true,
        leavePolicyHoliday: true,
      },
    });
  }

  async update(id: number, data: UpdatePublicHolidayDto) {
    try {
      // Filter out undefined values to avoid Prisma errors
      const updateData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined),
      );

      return await this.prisma.publicHoliday.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      console.error('Error updating public holiday:', error);
      throw new Error('Failed to update public holiday');
    }
  }

  remove(id: number) {
    return this.prisma.$transaction(async (prisma) => {
      // First delete all related leavePolicyHoliday records
      await prisma.leavePolicyHoliday.deleteMany({
        where: { publicHolidayID: id },
      });

      // Then delete the PublicHoliday record
      return prisma.publicHoliday.delete({ where: { id } });
    });
  }
}
