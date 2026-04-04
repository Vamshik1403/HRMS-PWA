import { Module } from '@nestjs/common';
import { AttendancePolicyService } from './attendance-policy.service';
import { AttendancePolicyController } from './attendance-policy.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [AttendancePolicyController],
  providers: [AttendancePolicyService,PrismaService],
})
export class AttendancePolicyModule {}
