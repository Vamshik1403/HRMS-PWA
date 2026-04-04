import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Get,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AttlogListenerService } from './attlog-listener.service';

type BatchItem = { SN: string; table: string; body: string };
type BatchPayload = { items: BatchItem[] };
type BatchResult = { SN: string; table: string; inserted: number };

@Controller()
export class AttlogListenerController {
  constructor(private readonly svc: AttlogListenerService) {}

  // --- Existing single-device endpoint (unchanged) ---
  @Post('cdata.aspx')
  @HttpCode(200)
  @Header('Content-Type', 'text/plain')
  async receiveSingle(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: Record<string, any>,
  ) {
    const method = req.method;
    const uri = req.originalUrl || req.url;
    const queryStr = (uri.includes('?') ? uri.split('?')[1] : '') || '';
    const bodyText = (req as any).body as string; // route-scoped text parser in main.ts

    const deviceSN = (query.SN as string) || 'UNKNOWN';
    const table = (query.table as string)?.toLowerCase() || '';

    await this.svc.appendPerDeviceLog({
      deviceSN,
      method,
      uri,
      queryStr,
      body: bodyText || '',
    });

    if (method === 'POST' && uri.toLowerCase().includes('cdata.aspx') && table === 'attlog') {
      await this.svc.handleAttlog(deviceSN, bodyText || '');
    }

    return res.send('OK');
  }

  // --- POST /cdata-batch : ingest many devices in one call (JSON) ---
  @Post('cdata-batch')
  @HttpCode(200)
  @Header('Content-Type', 'application/json')
  async receiveBatch(
    @Body() payload: BatchPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const items = Array.isArray(payload?.items) ? payload.items : [];

    const results: BatchResult[] = [];

    for (const it of items) {
      const sn = it?.SN || 'UNKNOWN';
      const table = (it?.table || '').toLowerCase();
      const bodyText = it?.body || '';

      await this.svc.appendPerDeviceLog({
        deviceSN: sn,
        method: req.method,
        uri: req.originalUrl || req.url,
        queryStr: `SN=${sn}&table=${table}`,
        body: bodyText,
      });

      let inserted = 0;
      if (table === 'attlog') {
        inserted = await this.svc.handleAttlog(sn, bodyText); // returns count
      }
      results.push({ SN: sn, table, inserted });
    }

    return res.json({ ok: true, results });
  }

  // --- GET /cdata-batch : fetch logs for ALL devices (no SN required) ---
   @Get('cdata-batch')
  @HttpCode(200)
  @Header('Content-Type', 'application/json')
  async listAll(
    @Query() q: Record<string, any>,   // ← single query object (no optional params)
    @Res() res: Response,
  ) {
    // Defaults & parsing
    let take = parseInt(String(q.take ?? '200'), 10);
    if (isNaN(take) || take < 1) take = 200;
    if (take > 1000) take = 1000;

    let skip = parseInt(String(q.skip ?? '0'), 10);
    if (isNaN(skip) || skip < 0) skip = 0;

    const activeOnlyFlag = String(q.activeOnly ?? '1').toLowerCase();
    const activeOnly = activeOnlyFlag === '1' || activeOnlyFlag === 'true';

    const from = q.from ? new Date(String(q.from)) : undefined;
    const to   = q.to   ? new Date(String(q.to))   : undefined;

    const out = await this.svc.listAllLogs({
      take,
      skip,
      activeOnly,
      from,
      to,
    });

    return res.json({
      ok: true,
      total: out.total,
      count: out.items.length,
      items: out.items,
    });
  }
}
