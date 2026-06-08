import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  actorFromJwtUser,
  parseUserAgent,
  resolveClientIp,
  safeJson,
  type AuditActor,
} from './audit-request.util';

export type AuditLogInput = {
  action: string;
  module: string;
  entityId?: string | number | null;
  entityName?: string | null;
  oldData?: unknown;
  newData?: unknown;
  success?: boolean;
  failureReason?: string | null;
  actor?: AuditActor;
  ipAddress?: string | null;
  browser?: string | null;
  os?: string | null;
  deviceType?: string | null;
  userAgent?: string | null;
  location?: string | null;
};

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.actor?.userId ?? null,
          username: input.actor?.username ?? null,
          employeeName: input.actor?.employeeName ?? null,
          userRole: input.actor?.userRole ?? null,
          action: input.action,
          module: input.module,
          entityId: input.entityId != null ? String(input.entityId) : null,
          entityName: input.entityName ?? null,
          oldData: safeJson(input.oldData),
          newData: safeJson(input.newData),
          success: input.success !== false,
          failureReason: input.failureReason ?? null,
          ipAddress: input.ipAddress ?? null,
          browser: input.browser ?? null,
          os: input.os ?? null,
          deviceType: input.deviceType ?? null,
          location: input.location ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${String(err)}`);
    }
  }

  async logFromRequest(
    req: Request | undefined,
    input: Omit<AuditLogInput, 'ipAddress' | 'browser' | 'os' | 'deviceType' | 'userAgent'> & {
      actor?: AuditActor;
    },
  ): Promise<void> {
    const ua = parseUserAgent(req);
    const jwtUser = (req as { user?: Record<string, unknown> })?.user;
    const actor = input.actor ?? actorFromJwtUser(jwtUser);
    await this.log({
      ...input,
      actor,
      ipAddress: resolveClientIp(req),
      browser: ua.browser,
      os: ua.os,
      deviceType: ua.deviceType,
      userAgent: ua.userAgent,
    });
  }

  async list(filters: {
    module?: string;
    action?: string;
    username?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(filters.page ?? 1, 1);
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const where: Record<string, unknown> = {};
    if (filters.module) where.module = filters.module;
    if (filters.action) where.action = filters.action;
    if (filters.username) {
      where.username = { contains: filters.username, mode: 'insensitive' };
    }
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as Record<string, Date>).gte = new Date(filters.from);
      if (filters.to) (where.createdAt as Record<string, Date>).lte = new Date(filters.to);
    }
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async exportCsv(filters: {
    module?: string;
    action?: string;
    username?: string;
    from?: string;
    to?: string;
  }): Promise<string> {
    const { items } = await this.list({ ...filters, page: 1, limit: 5000 });
    const header = [
      'Date',
      'User',
      'Role',
      'Action',
      'Module',
      'Entity',
      'Success',
      'IP',
      'Browser',
      'OS',
      'Device',
      'Details',
    ];
    const rows = items.map((r) => [
      r.createdAt.toISOString(),
      r.username || '',
      r.userRole || '',
      r.action,
      r.module,
      r.entityName || r.entityId || '',
      r.success ? 'Yes' : 'No',
      r.ipAddress || '',
      r.browser || '',
      r.os || '',
      r.deviceType || '',
      (r.newData || r.oldData || r.failureReason || '').replace(/\s+/g, ' ').slice(0, 200),
    ]);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    return [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
  }
}
