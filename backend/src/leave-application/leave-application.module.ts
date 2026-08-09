import { Module } from '@nestjs/common';
import { LeaveApplicationService } from './leave-application.service';
import { LeaveApplicationController } from './leave-application.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { EmpLeaveBalanceModule } from '../emp-leave-balance/emp-leave-balance.module';
import { EmployeeMemoModule } from '../employee-memo/employee-memo.module';

@Module({
  imports: [PrismaModule, PushNotificationsModule, EmpLeaveBalanceModule, EmployeeMemoModule],
  controllers: [LeaveApplicationController],
  providers: [LeaveApplicationService],
})
export class LeaveApplicationModule {}
