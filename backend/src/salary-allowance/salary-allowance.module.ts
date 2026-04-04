import { Module } from '@nestjs/common';
import { SalaryAllowanceService } from './salary-allowance.service';
import { SalaryAllowanceController } from './salary-allowance.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [SalaryAllowanceController],
  providers: [SalaryAllowanceService,PrismaService],
})
export class SalaryAllowanceModule {}
