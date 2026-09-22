import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmpNotificationsService } from './emp-notifications.service';
import { EmpNotificationsController } from './emp-notifications.controller';
import { EmployeeMemoModule } from '../employee-memo/employee-memo.module';

@Module({
  imports: [PrismaModule, EmployeeMemoModule],
  controllers: [EmpNotificationsController],
  providers: [EmpNotificationsService],
  exports: [EmpNotificationsService],
})
export class EmpNotificationsModule {}
