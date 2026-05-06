import { Module } from '@nestjs/common';
import { FactualRosterService } from './factual-roster.service';
import { FactualRosterController } from './factual-roster.controller';
import { FactualRosterEmployeeService } from './factual-roster-employee.service';
import { FactualRosterEmployeeController } from './factual-roster-employee.controller';
import { FactualRosterDayService } from './factual-roster-day.service';
import { FactualRosterDayController } from './factual-roster-day.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    FactualRosterController,
    FactualRosterEmployeeController,
    FactualRosterDayController,
  ],
  providers: [
    FactualRosterService,
    FactualRosterEmployeeService,
    FactualRosterDayService,
  ],
})
export class FactualRosterModule {}
