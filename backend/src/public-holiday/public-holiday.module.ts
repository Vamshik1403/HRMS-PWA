import { Module } from '@nestjs/common';
import { PublicHolidayService } from './public-holiday.service';
import { PublicHolidayController } from './public-holiday.controller';

@Module({
  controllers: [PublicHolidayController],
  providers: [PublicHolidayService],
})
export class PublicHolidayModule {}
