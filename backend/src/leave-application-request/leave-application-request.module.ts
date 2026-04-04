import { Module } from '@nestjs/common';
import { LeaveApplicationRequestService } from './leave-application-request.service';
import { LeaveApplicationRequestController } from './leave-application-request.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [LeaveApplicationRequestController],
  providers: [LeaveApplicationRequestService, PrismaService],
})
export class LeaveApplicationRequestModule {}
