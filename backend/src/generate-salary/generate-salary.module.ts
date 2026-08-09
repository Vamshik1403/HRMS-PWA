import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { GenerateSalaryService } from './generate-salary.service';
import { GenerateSalaryController } from './generate-salary.controller';
import { EmployeeMemoModule } from '../employee-memo/employee-memo.module';

@Module({
  imports: [PrismaModule, PushNotificationsModule, MailModule, EmployeeMemoModule],
  controllers: [GenerateSalaryController],
  providers: [GenerateSalaryService],
})
export class GenerateSalaryModule {}
