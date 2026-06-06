import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_APP_PUNCH_TIMEZONE,
  wallClockInZoneToStorageDate,
} from '../common/device-punch-time';
import { timeToMinutes } from '../dashboard-overview/attendance-status.engine';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { getEffectiveDisplayPunches } from './pwa-punch-metrics.util';

const REMINDER_FILE =
  process.env.MARKOUT_REMINDER_FILE ||
  path.join(process.cwd(), 'data', 'markout-reminder-sent.json');

type SentMap = Record<string, number[]>;

@Injectable()
export class EmpMarkoutReminderService implements OnModuleInit {
  private readonly logger = new Logger(EmpMarkoutReminderService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService,
  ) {}

  onModuleInit() {
    setTimeout(() => void this.runScheduledReminders(), 45_000);
    setInterval(() => void this.runScheduledReminders(), 5 * 60 * 1000);
  }

  private appWeekdayName(date = new Date()): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: DEFAULT_APP_PUNCH_TIMEZONE,
      weekday: 'long',
    }).format(date);
  }

  private todayDateKey(now = wallClockInZoneToStorageDate()): string {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private wallClockNowMinutes(now = wallClockInZoneToStorageDate()): number {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }

  private formatShiftEnd(endTime: string): string {
    const total = timeToMinutes(endTime);
    const h = Math.floor(total / 60) % 24;
    const m = Math.floor(total % 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  private dayWindow(wallClockNow: Date) {
    const y = wallClockNow.getUTCFullYear();
    const m = wallClockNow.getUTCMonth();
    const d = wallClockNow.getUTCDate();
    return {
      startOfDay: new Date(Date.UTC(y, m, d, 0, 0, 0, 0)),
      endOfDay: new Date(Date.UTC(y, m, d, 23, 59, 59, 999)),
    };
  }

  private punchState(lastType: string | null): 'OUT' | 'IN' | 'ON_BREAK' {
    if (!lastType || lastType === 'CHECK_OUT') return 'OUT';
    if (lastType === 'CHECK_IN' || lastType === 'BREAK_OUT') return 'IN';
    if (lastType === 'BREAK_IN') return 'ON_BREAK';
    return 'OUT';
  }

  private readSent(): SentMap {
    try {
      if (!fs.existsSync(REMINDER_FILE)) return {};
      return JSON.parse(fs.readFileSync(REMINDER_FILE, 'utf-8')) as SentMap;
    } catch {
      return {};
    }
  }

  private writeSent(map: SentMap) {
    const dir = path.dirname(REMINDER_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(REMINDER_FILE, JSON.stringify(map, null, 2), 'utf-8');
  }

  private markSent(dateKey: string, employeeId: number) {
    const map = this.readSent();
    const list = map[dateKey] || [];
    if (!list.includes(employeeId)) list.push(employeeId);
    map[dateKey] = list;
    // Drop keys older than 7 days
    const keys = Object.keys(map).sort();
    while (keys.length > 7) {
      delete map[keys.shift()!];
    }
    this.writeSent(map);
  }

  private alreadySent(dateKey: string, employeeId: number): boolean {
    return (this.readSent()[dateKey] || []).includes(employeeId);
  }

  async evaluateMarkoutReminder(employeeId: number): Promise<{
    show: boolean;
    message: string;
    shiftEndLabel?: string;
  }> {
    const now = wallClockInZoneToStorageDate();
    const dateKey = this.todayDateKey(now);
    const nowMin = this.wallClockNowMinutes(now);
    const dow = this.appWeekdayName();

    const emp = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        mobileAttendanceEnabled: true,
        workShift: { include: { workShiftDay: true } },
      },
    });
    if (!emp || emp.mobileAttendanceEnabled === false || !emp.workShift) {
      return { show: false, message: '' };
    }

    const shiftDay = (emp.workShift.workShiftDay || []).find(
      (d) => d.weekDay === dow && d.shiftType === 'WORK',
    );
    if (!shiftDay || shiftDay.weeklyOff || !shiftDay.endTime) {
      return { show: false, message: '' };
    }

    const startMin = timeToMinutes(shiftDay.startTime || '0:00');
    const endMin = timeToMinutes(shiftDay.endTime);
    const spansMidnight = endMin < startMin;
    const effectiveEndMin = spansMidnight ? endMin + 1440 : endMin;
    const effectiveNowMin = spansMidnight && nowMin < startMin ? nowMin + 1440 : nowMin;
    if (effectiveNowMin < effectiveEndMin) {
      return { show: false, message: '' };
    }

    const { startOfDay, endOfDay } = this.dayWindow(now);
    const records = await this.prisma.attendanceLocation.findMany({
      where: {
        employeeId,
        checkinTime: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { checkinTime: 'asc' },
    });
    if (records.length === 0) {
      return { show: false, message: '' };
    }

    const { lastPunch } = getEffectiveDisplayPunches(records);
    const state = this.punchState(lastPunch?.checkType ?? null);
    if (state !== 'IN' && state !== 'ON_BREAK') {
      return { show: false, message: '' };
    }

    const shiftEndLabel = this.formatShiftEnd(shiftDay.endTime);
    return {
      show: true,
      shiftEndLabel,
      message: `Don't forget to mark OUT — your shift ended at ${shiftEndLabel}.`,
    };
  }

  async runScheduledReminders(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let sent = 0;
    try {
      const now = wallClockInZoneToStorageDate();
      const dateKey = this.todayDateKey(now);
      const nowMin = this.wallClockNowMinutes(now);
      const dow = this.appWeekdayName();
      const { startOfDay, endOfDay } = this.dayWindow(now);

      const employees = await this.prisma.manageEmployee.findMany({
        where: {
          mobileAttendanceEnabled: { not: false },
          workShiftID: { not: null },
        },
        select: {
          id: true,
          workShift: { include: { workShiftDay: true } },
        },
      });

      for (const emp of employees) {
        if (!emp.workShift) continue;
        const shiftDay = (emp.workShift.workShiftDay || []).find(
          (d) => d.weekDay === dow && d.shiftType === 'WORK',
        );
        if (!shiftDay || shiftDay.weeklyOff || !shiftDay.endTime) continue;

        const startMin = timeToMinutes(shiftDay.startTime || '0:00');
        const endMin = timeToMinutes(shiftDay.endTime);
        const spansMidnight = endMin < startMin;
        const effectiveEndMin = spansMidnight ? endMin + 1440 : endMin;
        const effectiveNowMin =
          spansMidnight && nowMin < startMin ? nowMin + 1440 : nowMin;
        if (effectiveNowMin < effectiveEndMin) continue;
        if (this.alreadySent(dateKey, emp.id)) continue;

        const records = await this.prisma.attendanceLocation.findMany({
          where: {
            employeeId: emp.id,
            checkinTime: { gte: startOfDay, lte: endOfDay },
          },
          orderBy: { checkinTime: 'asc' },
        });
        if (records.length === 0) continue;

        const { lastPunch } = getEffectiveDisplayPunches(records);
        const state = this.punchState(lastPunch?.checkType ?? null);
        if (state !== 'IN' && state !== 'ON_BREAK') continue;

        const shiftEndLabel = this.formatShiftEnd(shiftDay.endTime);
        await this.push.sendToEmployee(
          emp.id,
          "Don't forget to mark out",
          `Your shift ended at ${shiftEndLabel}. Please mark OUT before leaving.`,
          { kind: 'attendance', url: '/empAttendance' },
        );
        this.markSent(dateKey, emp.id);
        sent += 1;
      }

      if (sent > 0) {
        this.logger.log(`Sent ${sent} mark-out reminder push notification(s)`);
      }
    } catch (err) {
      this.logger.error('Mark-out reminder job failed', err);
    } finally {
      this.running = false;
    }
    return sent;
  }
}
