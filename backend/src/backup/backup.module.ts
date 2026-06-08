import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { BackupController } from './backup.controller';
import { BackupSchedulerService } from './backup-scheduler.service';
import { BackupService } from './backup.service';
import { CloudBackupService } from './cloud-backup.service';

@Module({
  imports: [MailModule, AuthModule],
  controllers: [BackupController],
  providers: [BackupService, BackupSchedulerService, CloudBackupService],
  exports: [BackupService],
})
export class BackupModule {}
