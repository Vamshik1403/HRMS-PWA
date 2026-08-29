import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { tokensMatch } from './enpl-sync.util';

@Injectable()
export class EnplSyncGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const syncToken = process.env.HRMS_SYNC_TOKEN || '';
    const exportToken = process.env.HRMS_EXPORT_TOKEN || syncToken;
    if (!syncToken && !exportToken) {
      throw new UnauthorizedException('ENPL sync token is not configured');
    }
    const headerToken =
      req.headers['x-hrms-sync-token'] ||
      req.headers['x-hrms-export-token'] ||
      (typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : '');
    const provided = Array.isArray(headerToken) ? headerToken[0] : headerToken;
    if (tokensMatch(syncToken, provided) || tokensMatch(exportToken, provided)) {
      return true;
    }
    throw new UnauthorizedException('Invalid ENPL sync token');
  }
}
