import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { GenerateSalaryService } from './generate-salary.service';
import { GenerateSalaryController } from './generate-salary.controller';

@Module({
  imports: [PrismaModule, PushNotificationsModule],
  controllers: [GenerateSalaryController],
  providers: [GenerateSalaryService],
})
export class GenerateSalaryModule {}
