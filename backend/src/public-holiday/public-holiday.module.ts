import { Module } from '@nestjs/common';
import { PublicHolidayService } from './public-holiday.service';
import { PublicHolidayController } from './public-holiday.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmployeeMemoModule } from '../employee-memo/employee-memo.module';

@Module({
  imports: [PrismaModule, EmployeeMemoModule],
  controllers: [PublicHolidayController],
  providers: [PublicHolidayService],
})
export class PublicHolidayModule {}
