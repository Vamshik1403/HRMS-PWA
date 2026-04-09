import { Module } from '@nestjs/common';
import { CalendarService } from './calender.service';
import { CalendarController } from './calender.controller';

@Module({
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalenderModule {}
