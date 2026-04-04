import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { RosterDayService } from './roster-day.service';
import { UpsertRosterDayDto } from './dto/upsert-roster-day.dto';
import { BulkUpsertRosterDaysDto } from './dto/bulk-upsert-roster-days.dto';

@Controller('roster-days')
export class RosterDayController {
  constructor(private readonly service: RosterDayService) {}

  @Post()
  upsert(@Body() dto: UpsertRosterDayDto) {
    return this.service.upsert(dto);
  }

  @Post('bulk')
  bulk(@Body() dto: BulkUpsertRosterDaysDto) {
    return this.service.bulkUpsert(dto);
  }

  @Get('by-employee/:employeeID')
  listByEmployee(@Param('employeeID') id: string) {
    return this.service.listByEmployee(+id);
  }

  @Get('by-roster-employee/:rosterEmployeeID')
  listByRosterEmployee(@Param('rosterEmployeeID') id: string) {
    return this.service.listByRosterEmployee(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}