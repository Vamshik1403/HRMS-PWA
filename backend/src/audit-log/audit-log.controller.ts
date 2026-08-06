import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuditLogService } from './audit-log.service';

@Controller('audit-logs')
@UseGuards(AuthGuard('jwt'))
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  /**
   * SUPERADMIN sees every log. Any other authenticated user (e.g. a company
   * owner viewing "System Logs" under Administration) is scoped to their
   * own company's activity only.
   */
  private resolveCompanyScope(req: {
    user?: { role?: string; companyID?: number | string };
  }): number | undefined {
    const role = String(req.user?.role || '').toUpperCase();
    if (role === 'SUPERADMIN') return undefined;
    const companyID = Number(req.user?.companyID);
    if (!Number.isFinite(companyID) || companyID <= 0) {
      throw new ForbiddenException('No company scope found for this account');
    }
    return companyID;
  }

  @Get()
  list(
    @Req() req: { user?: { role?: string; companyID?: number | string } },
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('username') username?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const companyID = this.resolveCompanyScope(req);
    return this.service.list({
      module: module || undefined,
      action: action || undefined,
      username: username || undefined,
      from: from || undefined,
      to: to || undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      companyID,
    });
  }

  @Get('export')
  async export(
    @Req() req: { user?: { role?: string; companyID?: number | string } },
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('username') username?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const companyID = this.resolveCompanyScope(req);
    const csv = await this.service.exportCsv({
      module: module || undefined,
      action: action || undefined,
      username: username || undefined,
      from: from || undefined,
      to: to || undefined,
      companyID,
    });
    const ext = format === 'csv' || !format ? 'csv' : 'csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs.${ext}"`);
    res.send(csv);
  }
}
