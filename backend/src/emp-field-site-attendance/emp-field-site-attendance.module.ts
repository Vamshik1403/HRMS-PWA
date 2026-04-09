import { Module } from '@nestjs/common';
import { EmpFieldSiteAttendanceService } from './emp-field-site-attendance.service';
import { EmpFieldSiteAttendanceController } from './emp-field-site-attendance.controller';

@Module({
  controllers: [EmpFieldSiteAttendanceController],
  providers: [EmpFieldSiteAttendanceService],
})
export class EmpFieldSiteAttendanceModule {}
