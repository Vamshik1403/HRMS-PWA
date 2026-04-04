import { Module } from '@nestjs/common';
import { ManageHolidayService } from './manage-holiday.service';
import { ManageHolidayController } from './manage-holiday.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ManageHolidayController],
  providers: [ManageHolidayService,PrismaService],
})
export class ManageHolidayModule {}
