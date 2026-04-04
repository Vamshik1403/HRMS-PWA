import { Module } from '@nestjs/common';
import { MonthlyPayGradeService } from './monthly-pay-grade.service';
import { MonthlyPayGradeController } from './monthly-pay-grade.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [MonthlyPayGradeController],
  providers: [MonthlyPayGradeService,PrismaService],
})
export class MonthlyPayGradeModule {}
