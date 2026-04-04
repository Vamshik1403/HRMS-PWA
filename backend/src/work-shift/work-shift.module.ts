import { Module } from '@nestjs/common';
import { WorkShiftService } from './work-shift.service';
import { WorkShiftController } from './work-shift.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [WorkShiftController],
  providers: [WorkShiftService,PrismaService],
})
export class WorkShiftModule {}
