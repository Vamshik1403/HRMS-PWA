import { Module } from '@nestjs/common';
import { EmpFieldSiteAttendanceService } from './emp-field-site-attendance.service';
import { EmpFieldSiteAttendanceController } from './emp-field-site-attendance.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [EmpFieldSiteAttendanceController],
  providers: [EmpFieldSiteAttendanceService, PrismaService],
})
export class EmpFieldSiteAttendanceModule {}
