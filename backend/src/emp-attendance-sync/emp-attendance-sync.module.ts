import { Module } from '@nestjs/common';
import { EmpAttendanceSyncService } from './emp-attendance-sync.service';
import { EmpAttendanceSyncController } from './emp-attendance-sync.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [EmpAttendanceSyncController],
  providers: [EmpAttendanceSyncService,PrismaService],
})
export class EmpAttendanceSyncModule {}
