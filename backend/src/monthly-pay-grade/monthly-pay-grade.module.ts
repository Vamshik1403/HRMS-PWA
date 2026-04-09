import { Module } from '@nestjs/common';
import { MonthlyPayGradeService } from './monthly-pay-grade.service';
import { MonthlyPayGradeController } from './monthly-pay-grade.controller';

@Module({
  controllers: [MonthlyPayGradeController],
  providers: [MonthlyPayGradeService],
})
export class MonthlyPayGradeModule {}
