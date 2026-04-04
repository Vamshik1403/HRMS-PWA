import { Module } from '@nestjs/common';
import { EmpAttendanceRegulariseService } from './emp-attendance-regularise.service';
import { EmpAttendanceRegulariseController } from './emp-attendance-regularise.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [EmpAttendanceRegulariseController],
  providers: [EmpAttendanceRegulariseService, PrismaService],
})
export class EmpAttendanceRegulariseModule {}
