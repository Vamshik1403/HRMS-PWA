import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma, DeviceStatus } from '@prisma/client';

@Injectable()
export class AttlogListenerService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeFileName(sn: string) {
    const cleaned = sn.replace(/[^a-zA-Z0-9._-]/g, '_');
    return cleaned.length ? cleaned : 'UNKNOWN';
  }

  async appendPerDeviceLog(input: {
    deviceSN: string; method: string; uri: string; queryStr: string; body: string;
  }) {
    try {
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true, mode: 0o755 });

      const safeSN = this.sanitizeFileName(input.deviceSN);
      const logFile = path.join(logDir, `${safeSN}.txt`);

      const now = new Date();
      const stamp =
        `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ` +
        `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

      const logEntry =
        `[${stamp}]\nMETHOD: ${input.method}\nURL: ${input.uri}\nQUERY: ${input.queryStr}\nBODY:\n${input.body}\n\n`;

      fs.appendFileSync(logFile, logEntry);
    } catch { /* ignore log errors */ }
  }

  // Ingest one device's body (called by single and batch POST)
  async handleAttlog(deviceSN: string, body: string): Promise<number> {
    try {
      const device = await this.prisma.devices.findFirst({
        where: { deviceSN, status: DeviceStatus.Active },
        select: { id: true, deviceSN: true },
      });
      if (!device) return 0;

      const lines = (body || '')
        .split(/\r?\n/)
        .map(x => x.trim())
        .filter(Boolean);
      if (!lines.length) return 0;

      const rows: Prisma.AttendanceLogsCreateManyInput[] = [];
      for (const line of lines) {
        const f = line.split(/\s+/);
        if (f.length >= 3) {
          const userId   = f[0];
          const logTime  = f[1] + (f[2] ? ` ${f[2]}` : '');
          const status   = f[3] ?? '0';
          const workCode = f[4] ?? '0';
          rows.push({
            deviceId: device.id,
            deviceSN: device.deviceSN,
            userId,
            logTime,
            status: String(status),
            workCode: String(workCode),
            rawData: line,
            processed: '0',
          });
        }
      }
      if (!rows.length) return 0;

      const result = await this.prisma.attendanceLogs.createMany({
        data: rows,
        // If you want to always append, keep false.
        // If you want to dedupe within a post, set true + add a batch key as discussed earlier.
        skipDuplicates: false,
      });
      return result.count ?? 0;
    } catch {
      return 0;
    }
  }

  // List ALL logs (optionally only active devices), with pagination and date filters
  async listAllLogs(input: {
    take: number;
    skip: number;
    activeOnly: boolean;
    from?: Date;
    to?: Date;
  }) {
    const { take, skip, activeOnly, from, to } = input;

    const where: Prisma.AttendanceLogsWhereInput = {};
    if (activeOnly) {
      // filter by related Devices.status
      where.device = { status: DeviceStatus.Active };
    }
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as any).gte = from;
      if (to)   (where.createdAt as any).lte = to;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendanceLogs.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take,
        select: {
          id: true,
          deviceId: true,
          deviceSN: true,
          userId: true,
          logTime: true,
          status: true,
          workCode: true,
          rawData: true,
          processed: true,
          createdAt: true,
          device: { // include device details for convenience in the UI
            select: {
              id: true,
              deviceSN: true,
              deviceName: true,
              deviceMake: true,
              deviceModel: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.attendanceLogs.count({ where }),
    ]);

    return { items, total };
  }
}
