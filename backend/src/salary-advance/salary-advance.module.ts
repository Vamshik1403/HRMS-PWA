import { Module } from '@nestjs/common';
import { SalaryAdvanceService } from './salary-advance.service';
import { SalaryAdvanceController } from './salary-advance.controller';

@Module({
  controllers: [SalaryAdvanceController],
  providers: [SalaryAdvanceService],
})
export class SalaryAdvanceModule {}
