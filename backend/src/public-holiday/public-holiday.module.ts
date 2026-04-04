import { Module } from '@nestjs/common';
import { PublicHolidayService } from './public-holiday.service';
import { PublicHolidayController } from './public-holiday.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [PublicHolidayController],
  providers: [PublicHolidayService,PrismaService],
})
export class PublicHolidayModule {}
