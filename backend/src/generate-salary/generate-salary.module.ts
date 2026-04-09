import { Module } from '@nestjs/common';
import { GenerateSalaryService } from './generate-salary.service';
import { GenerateSalaryController } from './generate-salary.controller';

@Module({
  controllers: [GenerateSalaryController],
  providers: [GenerateSalaryService],
})
export class GenerateSalaryModule {}
