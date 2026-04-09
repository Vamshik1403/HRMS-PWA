import { Module } from '@nestjs/common';
import { SalaryCycleService } from './salary-cycle.service';
import { SalaryCycleController } from './salary-cycle.controller';

@Module({
  controllers: [SalaryCycleController],
  providers: [SalaryCycleService],
})
export class SalaryCycleModule {}
