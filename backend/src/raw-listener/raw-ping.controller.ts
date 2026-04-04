import { Controller, Get } from '@nestjs/common';

@Controller()
export class RawPingController {
  @Get('raw-ping')
  rawPing() {
    return { ok: true, from: '8080 RawListenerModule' };
  }
}
