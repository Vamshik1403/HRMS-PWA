import { Module } from '@nestjs/common';
import { SalaryAdvanceRepaymentService } from './salary-advance-repayment.service';
import { SalaryAdvanceRepaymentController } from './salary-advance-repayment.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [SalaryAdvanceRepaymentController],
  providers: [SalaryAdvanceRepaymentService,PrismaService],
})
export class SalaryAdvanceRepaymentModule {}
