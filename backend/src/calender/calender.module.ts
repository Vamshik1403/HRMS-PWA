import { Module } from '@nestjs/common';
import { CalendarService } from './calender.service';
import { CalendarController } from './calender.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [CalendarController],
  providers: [CalendarService,PrismaService],
})
export class CalenderModule {}
