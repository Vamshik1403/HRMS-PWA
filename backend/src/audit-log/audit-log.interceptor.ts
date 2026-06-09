import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import {
  isEmployeeJwtUser,
  isPwaApiPath,
  isPwaDevice,
} from './audit-log.filters';
import { parseUserAgent } from './audit-request.util';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLog: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const method = (req.method || 'GET').toUpperCase();

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const path = (req.route?.path as string) || req.path || req.url?.split('?')[0] || '';

    if (this.shouldSkip(path, method)) {
      return next.handle();
    }

    const action = this.actionFromMethod(method);
    const module = this.moduleFromPath(path);

    return next.handle().pipe(
      tap({
        next: () => {
          if (this.shouldNotPersist(req)) return;
          void this.auditLog.logFromRequest(req, {
            action,
            module,
            entityId: (req.params as { id?: string })?.id ?? null,
            newData: this.sanitizeBody(req.body),
          });
        },
      }),
    );
  }

  private shouldSkip(path: string, method: string): boolean {
    const p = path.toLowerCase();
    if (p.includes('/auth/login') || p.includes('/auth/register')) return true;
    if (p.includes('/audit-logs')) return true;
    if (p.includes('/manage-emp/login')) return true;
    if (isPwaApiPath(p)) return true;
    // Detailed audit already written in ManageEmployeeService
    if (p.includes('/manage-emp') && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      return true;
    }
    if (p.includes('/backup')) return true;
    return false;
  }

  /** Skip PWA / mobile / employee-app requests — desktop admin audit only. */
  private shouldNotPersist(req: Request): boolean {
    const path = (req.route?.path as string) || req.path || req.url?.split('?')[0] || '';
    if (isPwaApiPath(path)) return true;
    const ua = parseUserAgent(req);
    if (isPwaDevice(ua.deviceType)) return true;
    const jwtUser = (req as { user?: Record<string, unknown> }).user;
    if (isEmployeeJwtUser(jwtUser)) return true;
    return false;
  }

  private actionFromMethod(method: string): string {
    switch (method) {
      case 'POST':
        return 'CREATE';
      case 'PUT':
      case 'PATCH':
        return 'UPDATE';
      case 'DELETE':
        return 'DELETE';
      default:
        return method;
    }
  }

  private moduleFromPath(path: string): string {
    const segment = path
      .replace(/^\/+/, '')
      .split('/')[0]
      ?.replace(/-/g, '_')
      .toUpperCase();
    return segment || 'API';
  }

  private sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return body;
    }
    const copy: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    for (const key of Object.keys(copy)) {
      if (/password/i.test(key)) {
        copy[key] = '[redacted]';
      }
    }
    return copy;
  }
}
