import { Module } from '@nestjs/common';
import { SalaryAllowanceService } from './salary-allowance.service';
import { SalaryAllowanceController } from './salary-allowance.controller';

@Module({
  controllers: [SalaryAllowanceController],
  providers: [SalaryAllowanceService],
})
export class SalaryAllowanceModule {}
