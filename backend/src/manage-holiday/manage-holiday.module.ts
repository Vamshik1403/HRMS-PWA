import { Module } from '@nestjs/common';
import { ManageHolidayService } from './manage-holiday.service';
import { ManageHolidayController } from './manage-holiday.controller';

@Module({
  controllers: [ManageHolidayController],
  providers: [ManageHolidayService],
})
export class ManageHolidayModule {}
