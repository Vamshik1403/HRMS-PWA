import { Module } from '@nestjs/common';
import { SalaryDeductionService } from './salary-deduction.service';
import { SalaryDeductionController } from './salary-deduction.controller';

@Module({
  controllers: [SalaryDeductionController],
  providers: [SalaryDeductionService],
})
export class SalaryDeductionModule {}
