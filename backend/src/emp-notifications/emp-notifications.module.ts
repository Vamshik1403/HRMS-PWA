import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmpNotificationsService } from './emp-notifications.service';
import { EmpNotificationsController } from './emp-notifications.controller';

@Module({
  imports: [PrismaModule],
  controllers: [EmpNotificationsController],
  providers: [EmpNotificationsService],
  exports: [EmpNotificationsService],
})
export class EmpNotificationsModule {}
