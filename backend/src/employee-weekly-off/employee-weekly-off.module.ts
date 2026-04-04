import { Module } from '@nestjs/common';
import { EmployeeWeeklyOffService } from './employee-weekly-off.service';
import { EmployeeWeeklyOffController } from './employee-weekly-off.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeeWeeklyOffController],
  providers: [EmployeeWeeklyOffService],
})
export class EmployeeWeeklyOffModule {}
