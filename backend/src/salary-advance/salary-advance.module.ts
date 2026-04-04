import { Module } from '@nestjs/common';
import { SalaryAdvanceService } from './salary-advance.service';
import { SalaryAdvanceController } from './salary-advance.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [SalaryAdvanceController],
  providers: [SalaryAdvanceService,PrismaService],
})
export class SalaryAdvanceModule {}
