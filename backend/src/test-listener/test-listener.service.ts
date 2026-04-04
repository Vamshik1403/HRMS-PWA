import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

type PushPayload = {
  deviceSN: string;
  table?: string;
  url: string;
  method: string;
  queryString: string;
  ip: string;
  rawBody: string;
};

@Injectable()
export class TestListenerService {
  private readonly logger = new Logger(TestListenerService.name);
  private readonly logDir = path.join(process.cwd(), 'logs');

  constructor(private prisma: PrismaService) {}

  async handlePush(payload: PushPayload) {
    const sn = (payload.deviceSN || 'UNKNOWN').trim();
    const raw = (payload.rawBody ?? '').toString();

    // 1) Always log request
    await this.appendLogs(sn, payload, raw);

    // 2) Only process ATTLOG posts with data
    if (payload.method !== 'POST' || !this.isAttlog(payload.table) || !raw)
      return;

    try {
      // check device
      const device = await this.prisma.devices.findFirst({
        where: { deviceSN: sn, status: 'Active' },
        select: { id: true },
      });

      if (!device) {
        this.logger.warn(`Device not registered or inactive: SN=${sn}`);
        return;
      }

      // parse body lines
      for (const line of this.parseLines(raw)) {
        const rec = this.parseLine(line);
        if (!rec) continue;

        // prevent duplicates
        const exists = await this.prisma.attendanceLogs.findFirst({
          where: { deviceSN: sn, userId: rec.userId, logTime: rec.logTime },
          select: { id: true },
        });
        if (exists) continue;

        await this.prisma.attendanceLogs.create({
          data: {
            deviceId: device.id,
            deviceSN: sn,
            userId: rec.userId,
            logTime: rec.logTime,
            status: rec.status ?? '0',
            workCode: rec.workCode ?? '0',
            rawData: rec.raw,
            processed: '0',
          },
        });

      }
    } catch (err) {
      this.logger.error(
        `DB insert error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ===== Helpers =====

  private async appendLogs(sn: string, payload: PushPayload, raw: string) {
    await fs.promises.mkdir(this.logDir, { recursive: true });
    const stamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const entry =
      `[${stamp}] IP=${payload.ip}\n` +
      `METHOD: ${payload.method}\nURL: ${payload.url}\nQUERY: ${payload.queryString}\n` +
      `BODY:\n${raw}\n\n`;

    // global log
    await fs.promises.appendFile(
      path.join(this.logDir, `_access.txt`),
      entry,
      'utf8',
    );
    // per-device log
    await fs.promises.appendFile(
      path.join(this.logDir, `${sn || 'UNKNOWN'}.txt`),
      entry,
      'utf8',
    );
  }

  private isAttlog(table?: string) {
    return !!table && table.toLowerCase() === 'attlog';
  }

  private parseLines(raw: string): string[] {
    return raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  }

  private parseLine(line: string) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const userId = parts[0];
    const logTime = parts[1] + (parts[2] ? ` ${parts[2]}` : '');
    const status = parts[3] ?? '0';
    const workCode = parts[4] ?? '0';
    return { userId, logTime, status, workCode, raw: line };
  }
}
