/**
 * Run mark-out push reminders (e.g. from system cron every 5–15 minutes).
 * Usage: npm run markout-reminders
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EmpMarkoutReminderService } from '../src/emp-location-attendance/emp-markout-reminder.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const svc = app.get(EmpMarkoutReminderService);
    const sent = await svc.runScheduledReminders();
    console.log(`Mark-out reminders sent: ${sent}`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
