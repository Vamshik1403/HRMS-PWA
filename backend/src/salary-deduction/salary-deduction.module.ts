import { Module } from '@nestjs/common';
import { SalaryDeductionService } from './salary-deduction.service';
import { SalaryDeductionController } from './salary-deduction.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [SalaryDeductionController],
  providers: [SalaryDeductionService,PrismaService],
})
export class SalaryDeductionModule {}
