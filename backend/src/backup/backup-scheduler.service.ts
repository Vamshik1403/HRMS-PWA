import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BackupService } from './backup.service';

/** Runs automatic daily backup at 23:59 by default (server local time). */
@Injectable()
export class BackupSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupSchedulerService.name);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly backupService: BackupService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const enabled =
      (this.config.get<string>('BACKUP_SCHEDULER_ENABLED') ??
        process.env.BACKUP_SCHEDULER_ENABLED ??
        'true') !== 'false';
    if (!enabled) {
      this.logger.log('Daily backup scheduler disabled');
      return;
    }
    this.scheduleNext();
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  private scheduleNext() {
    const hour = Number(
      this.config.get<string>('BACKUP_HOUR') ?? process.env.BACKUP_HOUR ?? 23,
    );
    const minute = Number(
      this.config.get<string>('BACKUP_MINUTE') ?? process.env.BACKUP_MINUTE ?? 59,
    );
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    const delay = next.getTime() - now.getTime();
    this.logger.log(
      `Next automatic backup at ${next.toLocaleString()} (in ${Math.round(delay / 60000)} min)`,
    );
    this.timer = setTimeout(() => {
      void this.backupService
        .runDailyBackup('scheduled')
        .then(() => {
          const now = new Date();
          if (now.getDay() === 0) {
            return this.backupService.runWeeklyCloudBackup();
          }
          return [];
        })
        .catch((err) => this.logger.error(`Scheduled backup failed: ${String(err)}`))
        .finally(() => this.scheduleNext());
    }, delay);
  }
}
