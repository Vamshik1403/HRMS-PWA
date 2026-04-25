import { Module } from '@nestjs/common';
import { EmpAttendanceLogsService } from './emp-attendance-logs.service';
import { EmpAttendanceLogsController } from './emp-attendance-logs.controller';
import { OvertimeModule } from '../overtime/overtime.module';

@Module({
  imports: [OvertimeModule],
  controllers: [EmpAttendanceLogsController],
  providers: [EmpAttendanceLogsService],
})
export class EmpAttendanceLogsModule {}
