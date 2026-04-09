import { Module } from '@nestjs/common';
import { EmpAttendanceSyncService } from './emp-attendance-sync.service';
import { EmpAttendanceSyncController } from './emp-attendance-sync.controller';

@Module({
  controllers: [EmpAttendanceSyncController],
  providers: [EmpAttendanceSyncService],
})
export class EmpAttendanceSyncModule {}
