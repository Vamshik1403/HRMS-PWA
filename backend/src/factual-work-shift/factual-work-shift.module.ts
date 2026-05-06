import { Module } from '@nestjs/common';
import { FactualWorkShiftService } from './factual-work-shift.service';
import { FactualWorkShiftController } from './factual-work-shift.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FactualWorkShiftController],
  providers: [FactualWorkShiftService],
})
export class FactualWorkShiftModule {}
