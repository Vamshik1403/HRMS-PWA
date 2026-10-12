import { Module } from '@nestjs/common';
import { SalaryAdvanceService } from './salary-advance.service';
import { SalaryAdvanceController } from './salary-advance.controller';
import { EmployeeMemoModule } from '../employee-memo/employee-memo.module';

@Module({
  imports: [EmployeeMemoModule],
  controllers: [SalaryAdvanceController],
  providers: [SalaryAdvanceService],
})
export class SalaryAdvanceModule {}
