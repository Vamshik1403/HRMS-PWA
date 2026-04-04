import { Module } from '@nestjs/common';
import { SalaryCycleService } from './salary-cycle.service';
import { SalaryCycleController } from './salary-cycle.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [SalaryCycleController],
  providers: [SalaryCycleService,PrismaService],
})
export class SalaryCycleModule {}
