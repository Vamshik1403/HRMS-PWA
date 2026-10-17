import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { assertSuperadmin } from '../common/role-access';
import { AuditLogService } from './audit-log.service';

@Controller('audit-logs')
@UseGuards(AuthGuard('jwt'))
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  @Get()
  list(
    @Req() req: { user?: { role?: string } },
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('username') username?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    assertSuperadmin(req.user);
    return this.service.list({
      module: module || undefined,
      action: action || undefined,
      username: username || undefined,
      from: from || undefined,
      to: to || undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('export')
  async export(
    @Req() req: { user?: { role?: string } },
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('username') username?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    assertSuperadmin(req.user);
    const csv = await this.service.exportCsv({
      module: module || undefined,
      action: action || undefined,
      username: username || undefined,
      from: from || undefined,
      to: to || undefined,
    });
    const ext = format === 'csv' || !format ? 'csv' : 'csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs.${ext}"`);
    res.send(csv);
  }
}
