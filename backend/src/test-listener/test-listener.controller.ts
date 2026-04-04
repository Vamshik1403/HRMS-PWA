import { Controller, All, Get, Query, Res, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { TestListenerService } from './test-listener.service';
import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const ACCESS_FILE = path.join(LOG_DIR, '_access.txt');

function sanitize(name: string) {
  return (name || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

@Controller()
export class TestListenerController {
  constructor(private readonly listener: TestListenerService) {}

  // Catch ALL paths/methods -> reply OK and push to service
  @All('*')
  async any(@Req() req: Request, @Res() res: Response) {
    const rawBody =
      (req as any)._raw ??
      (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    await this.listener.handlePush({
      deviceSN: (req.query['SN'] as string) || '',
      table: (req.query['table'] as string) || '',
      url: req.originalUrl,
      method: req.method,
      queryString: req.url.split('?')[1] || '',
      ip:
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        '',
      rawBody: rawBody || '',
    });

    res.type('text/plain').send('OK');
  }

  // Debug: tail per-SN log
  @Get('cdata.aspx')
  async tailBySn(
    @Query('SN') SN: string,
    @Query('lines') lines = '100',
    @Res() res: Response,
    @Req() req: Request,
  ) {
    if (!SN) {
      return res.status(400).type('text/plain').send(
        'Pass SN=<serial>, e.g. /cdata.aspx?SN=CQZ7232160084&lines=100',
      );
    }
    const n = Math.max(1, Math.min(parseInt(lines, 10) || 100, 5000));
    const file = path.join(LOG_DIR, `${sanitize(SN)}.txt`);
    if (!fs.existsSync(file)) {
      const ip =
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        '';
      const alt = path.join(LOG_DIR, `${sanitize(ip || 'UNKNOWN')}.txt`);
      const hint = fs.existsSync(ACCESS_FILE)
        ? '_access.txt'
        : '(no _access.txt yet)';
      return res.status(404).json({
        message: `No log for SN=${SN}`,
        tryFiles: [
          `logs/${sanitize(SN)}.txt`,
          `logs/${sanitize(ip || 'UNKNOWN')}.txt`,
          `logs/${path.basename(ACCESS_FILE)} (${hint})`,
        ],
        error: 'Not Found',
        statusCode: 404,
      });
    }
    const txt = await fs.promises.readFile(file, 'utf8');
    res.type('text/plain').send(txt.split('\n').slice(-n).join('\n'));
  }

  // Debug: tail the global access log
  @Get('_debug/access')
  async tailAccess(@Query('lines') lines = '200', @Res() res: Response) {
    const n = Math.max(1, Math.min(parseInt(lines, 10) || 200, 10000));
    if (!fs.existsSync(ACCESS_FILE)) {
      return res.type('text/plain').send('No _access.txt yet');
    }
    const txt = await fs.promises.readFile(ACCESS_FILE, 'utf8');
    res.type('text/plain').send(txt.split('\n').slice(-n).join('\n'));
  }

  // Debug: list available *.txt logs
  @Get('_debug/list')
  async list(@Res() res: Response) {
    await fs.promises.mkdir(LOG_DIR, { recursive: true });
    const files = (await fs.promises.readdir(LOG_DIR)).filter((f) =>
      f.endsWith('.txt'),
    );
    res.json(files);
  }
}
