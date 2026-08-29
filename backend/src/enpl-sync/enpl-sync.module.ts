import { Module } from '@nestjs/common';
import { EnplSyncController } from './enpl-sync.controller';
import { EnplSyncGuard } from './enpl-sync.guard';
import { EnplSyncService } from './enpl-sync.service';

@Module({
  controllers: [EnplSyncController],
  providers: [EnplSyncService, EnplSyncGuard],
  exports: [EnplSyncService],
})
export class EnplSyncModule {}
