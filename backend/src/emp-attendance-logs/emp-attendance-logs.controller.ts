// src/emp-attendance-logs/emp-attendance-logs.controller.ts
import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { EmpAttendanceLogsService } from './emp-attendance-logs.service';

@Controller('emp-attendance-logs')
export class EmpAttendanceLogsController {
  constructor(private readonly svc: EmpAttendanceLogsService) {}

  @Get()
  getAll(
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
  ) {
    return this.svc.findAll({ skip, take }); // returns array -> Nest serializes to JSON
  }
}
