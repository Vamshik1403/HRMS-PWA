/**
 * Run daily database backup (for system cron at 23:59).
 * Usage: npm run backup:daily
 *
 * Example crontab:
 * 59 23 * * * cd /var/www/openhrm/backend && npm run backup:daily >> /var/log/openhrm-backup.log 2>&1
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { BackupService } from '../src/backup/backup.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const svc = app.get(BackupService);
    const manifest = await svc.runDailyBackup('scheduled');
    console.log(
      `Backup OK: ${manifest.date} (${manifest.files.length} files, email=${manifest.emailSent})`,
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
