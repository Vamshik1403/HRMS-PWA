import type { Request } from 'express';
import { UAParser } from 'ua-parser-js';

export type AuditActor = {
  userId?: number | null;
  username?: string | null;
  employeeName?: string | null;
  userRole?: string | null;
};

export function resolveClientIp(req?: Request | null): string | null {
  if (!req) return null;
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

export function parseUserAgent(req?: Request | null): {
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  userAgent: string | null;
} {
  const raw = req?.headers?.['user-agent'];
  const userAgent = typeof raw === 'string' ? raw : null;
  if (!userAgent) {
    return { browser: null, os: null, deviceType: null, userAgent: null };
  }
  const parsed = new UAParser(userAgent).getResult();
  const browser = [parsed.browser.name, parsed.browser.version]
    .filter(Boolean)
    .join(' ')
    .trim() || null;
  const os = [parsed.os.name, parsed.os.version].filter(Boolean).join(' ').trim() || null;
  const deviceType = parsed.device.type || 'desktop';
  return { browser, os, deviceType, userAgent };
}

export function actorFromJwtUser(user?: Record<string, unknown> | null): AuditActor {
  if (!user) return {};
  const username = typeof user.username === 'string' ? user.username : null;
  const userRole = typeof user.role === 'string' ? user.role : null;
  const sub = user.sub != null ? Number(user.sub) : null;
  const userId = Number.isFinite(sub) ? sub : null;
  return { userId, username, userRole };
}

export function safeJson(data: unknown): string | null {
  if (data === undefined || data === null) return null;
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}
