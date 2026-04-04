import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  // Get list of days, with optional filters
  async listDays(year = 2025, month?: number, skip = 0, take = 100) {
    const where: Prisma.CalendarDayWhereInput = { year };
    if (month) where.month = month;

    return this.prisma.calendarDay.findMany({
      where,
      skip,
      take,
      include: { holidayOnDays: { include: { holiday: true } } },
      orderBy: [{ month: 'asc' }, { day: 'asc' }],
    });
  }

  // Get a single day
  async getDayByDate(year: number, month: number, day: number) {
    return this.prisma.calendarDay.findFirst({
      where: { year, month, day },
      include: { holidayOnDays: { include: { holiday: true } } },
    });
  }

  // Get list of holidays (all or by region)
  async listHolidays(region?: string, year = 2025) {
    const days = await this.prisma.calendarDay.findMany({
      where: { year },
      include: { holidayOnDays: { include: { holiday: true } } },
    });

    const map = new Map<number, any>();
    for (const d of days) {
      for (const hd of d.holidayOnDays) {
        if (region && hd.holiday.region && !hd.holiday.region.includes(region))
          continue;
        map.set(hd.holiday.id, hd.holiday);
      }
    }
    return Array.from(map.values());
  }
}
