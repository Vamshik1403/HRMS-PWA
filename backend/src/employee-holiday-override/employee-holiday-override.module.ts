import { Module } from '@nestjs/common';
import { EmployeeHolidayOverrideService } from './employee-holiday-override.service';
import { EmployeeHolidayOverrideController } from './employee-holiday-override.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeeHolidayOverrideController],
  providers: [EmployeeHolidayOverrideService],
})
export class EmployeeHolidayOverrideModule {}
