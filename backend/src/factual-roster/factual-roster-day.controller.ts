import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { FactualRosterDayService } from './factual-roster-day.service';
import { UpsertFactualRosterDayDto } from './dto/upsert-factual-roster-day.dto';
import { BulkUpsertFactualRosterDaysDto } from './dto/bulk-upsert-factual-roster-days.dto';

@Controller('factual-roster-days')
export class FactualRosterDayController {
  constructor(private readonly service: FactualRosterDayService) {}

  @Post()
  upsert(@Body() dto: UpsertFactualRosterDayDto) {
    return this.service.upsert(dto);
  }

  @Post('bulk')
  bulkUpsert(@Body() dto: BulkUpsertFactualRosterDaysDto) {
    return this.service.bulkUpsert(dto);
  }

  @Get('by-roster-employee/:id')
  findByRosterEmployee(@Param('id', ParseIntPipe) id: number) {
    return this.service.findByRosterEmployee(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
