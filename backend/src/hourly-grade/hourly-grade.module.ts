import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { HourlyPayGradeController } from './hourly-grade.controller';
import { HourlyPayGradeService } from './hourly-grade.service';


@Module({
  controllers: [HourlyPayGradeController],
  providers: [HourlyPayGradeService,PrismaService],
})
export class HourlyGradeModule {}
