import { Module } from '@nestjs/common';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { EnplSyncController } from './enpl-sync.controller';
import { EnplSyncGuard } from './enpl-sync.guard';
import { EnplSyncService } from './enpl-sync.service';

@Module({
  imports: [PushNotificationsModule],
  controllers: [EnplSyncController],
  providers: [EnplSyncService, EnplSyncGuard],
  exports: [EnplSyncService],
})
export class EnplSyncModule {}
