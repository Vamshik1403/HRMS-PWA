import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RawListenerModule } from './raw-listener/raw-listener.module';
import * as bodyParser from 'body-parser';
import * as fs from 'fs';
import * as path from 'path';

function sanitize(name: string) {
  return (name || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

async function bootstrap() {
  // --- API server (8000) ---
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  app.enableCors({
    origin: ['http://localhost:3000', 'https://openhrm.openwan.in'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  app.use(bodyParser.json({
    limit: '5mb',
    verify: (req: any, _res, buf) => { req._raw = buf?.toString('utf8') ?? ''; },
  }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));
  await app.listen(8000, '0.0.0.0');
  console.log('API listening on localhost:8000');

  // --- Raw/device listener (8080) ---
  // const app8080 = await NestFactory.create(RawListenerModule, {
  //   logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  // });

  // app8080.use(bodyParser.text({
  //   type: '*/*',
  //   limit: '10mb',
  //   verify: (req: any, _res, buf) => { req._raw = buf?.toString('utf8') ?? ''; },
  // }));

  // const LOG_DIR = path.resolve(process.cwd(), 'logs');
  // const ACCESS_FILE = path.join(LOG_DIR, '_access.txt');

  // app8080.use(async (req: any, _res, next) => {
  //   try {
  //     await fs.promises.mkdir(LOG_DIR, { recursive: true });
  //     const stamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
  //     const url = req.originalUrl || req.url;
  //     const query = url.split('?')[1] ?? '';
  //     const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
  //     const rawBody = req._raw ?? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  //     const entry =
  //       `[${stamp}] IP=${ip}\nMETHOD: ${req.method}\nURL: ${url}\nQUERY: ${query}\n` +
  //       `HEADERS: ${JSON.stringify(req.headers)}\nBODY:\n${rawBody}\n\n`;
  //     await fs.promises.appendFile(ACCESS_FILE, entry, 'utf8');

  //     const sn = sanitize((req.query?.SN as string) || '');
  //     const perFile = sn
  //       ? path.join(LOG_DIR, `${sn}.txt`)
  //       : path.join(LOG_DIR, `${sanitize(ip || 'UNKNOWN')}.txt`);
  //     await fs.promises.appendFile(perFile, entry, 'utf8');
  //   } catch {}
  //   next();
  // });

  // await app8080.listen(8080, '0.0.0.0');
  // console.log('Raw listener on http://localhost:8080');
}
bootstrap();
