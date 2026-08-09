import { Module } from '@nestjs/common';
import { EmployeeMemoService } from './employee-memo.service';
import { EmployeeMemoController } from './employee-memo.controller';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, PushNotificationsModule],
  controllers: [EmployeeMemoController],
  providers: [EmployeeMemoService],
  exports: [EmployeeMemoService],
})
export class EmployeeMemoModule {}
