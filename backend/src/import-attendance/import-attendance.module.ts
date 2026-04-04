import { Module } from '@nestjs/common';
import { ImportAttendanceController } from './import-attendance.controller';
import { ImportAttendanceService } from './import-attendance.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ImportAttendanceController],
  providers: [ImportAttendanceService, PrismaService],
})
export class ImportAttendanceModule {}
