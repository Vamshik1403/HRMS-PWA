import { Module } from '@nestjs/common';
import { HourlyPayGradeController } from './hourly-grade.controller';
import { HourlyPayGradeService } from './hourly-grade.service';


@Module({
  controllers: [HourlyPayGradeController],
  providers: [HourlyPayGradeService],
})
export class HourlyGradeModule {}
