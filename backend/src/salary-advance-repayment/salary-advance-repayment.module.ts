import { Module } from '@nestjs/common';
import { SalaryAdvanceRepaymentService } from './salary-advance-repayment.service';
import { SalaryAdvanceRepaymentController } from './salary-advance-repayment.controller';

@Module({
  controllers: [SalaryAdvanceRepaymentController],
  providers: [SalaryAdvanceRepaymentService],
})
export class SalaryAdvanceRepaymentModule {}
