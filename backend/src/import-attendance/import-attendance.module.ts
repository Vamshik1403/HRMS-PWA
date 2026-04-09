import { Module } from '@nestjs/common';
import { ImportAttendanceController } from './import-attendance.controller';
import { ImportAttendanceService } from './import-attendance.service';

@Module({
  controllers: [ImportAttendanceController],
  providers: [ImportAttendanceService],
})
export class ImportAttendanceModule {}
