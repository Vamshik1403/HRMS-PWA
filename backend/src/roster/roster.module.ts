import { Module } from '@nestjs/common';

import { RosterController } from './roster.controller';
import { RosterService } from './roster.service';

import { RosterEmployeeController } from './roster-employee.controller';
import { RosterEmployeeService } from './roster-employee.service';

import { RosterDayController } from './roster-day.controller';
import { RosterDayService } from './roster-day.service';

@Module({
  controllers: [RosterController, RosterEmployeeController, RosterDayController],
  providers: [RosterService, RosterEmployeeService, RosterDayService],
  exports: [RosterService],
})
export class RosterModule {}
