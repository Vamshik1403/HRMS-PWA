import { Module } from '@nestjs/common';
import { EmpAttendanceLogsService } from './emp-attendance-logs.service';
import { EmpAttendanceLogsController } from './emp-attendance-logs.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { OvertimeModule } from 'src/overtime/overtime.module';

@Module({
  imports: [OvertimeModule],
  controllers: [EmpAttendanceLogsController],
  providers: [EmpAttendanceLogsService,PrismaService],
})
export class EmpAttendanceLogsModule {}
