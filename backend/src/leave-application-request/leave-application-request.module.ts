import { Module } from '@nestjs/common';
import { LeaveApplicationRequestService } from './leave-application-request.service';
import { LeaveApplicationRequestController } from './leave-application-request.controller';

@Module({
  controllers: [LeaveApplicationRequestController],
  providers: [LeaveApplicationRequestService],
})
export class LeaveApplicationRequestModule {}
