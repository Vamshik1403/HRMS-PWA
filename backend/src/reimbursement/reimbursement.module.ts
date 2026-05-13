import { Module } from '@nestjs/common';
import { ReimbursementService } from './reimbursement.service';
import { ReimbursementController } from './reimbursement.controller';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, PushNotificationsModule],
  controllers: [ReimbursementController],
  providers: [ReimbursementService],
})
export class ReimbursementModule {}
