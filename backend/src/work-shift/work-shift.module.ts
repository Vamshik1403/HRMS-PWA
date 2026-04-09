import { Module } from '@nestjs/common';
import { WorkShiftService } from './work-shift.service';
import { WorkShiftController } from './work-shift.controller';

@Module({
  controllers: [WorkShiftController],
  providers: [WorkShiftService],
})
export class WorkShiftModule {}
