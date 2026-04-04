import { Controller, Get, Query, Param } from '@nestjs/common';
import { CalendarService } from './calender.service';

@Controller('calendar')
export class CalendarController {
  constructor(private svc: CalendarService) {}

  @Get('days')
  async days(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const y = year ? Number(year) : 2025;
    return this.svc.listDays(
      y,
      month ? Number(month) : undefined,
      skip ? Number(skip) : 0,
      take ? Number(take) : 100,
    );
  }

  @Get('day/:year/:month/:day')
  async getDay(
    @Param('year') year: string,
    @Param('month') month: string,
    @Param('day') day: string,
  ) {
    return this.svc.getDayByDate(Number(year), Number(month), Number(day));
  }

  @Get('holidays')
  async holidays(
    @Query('region') region?: string,
    @Query('year') year?: string,
  ) {
    return this.svc.listHolidays(region, year ? Number(year) : 2025);
  }
}
