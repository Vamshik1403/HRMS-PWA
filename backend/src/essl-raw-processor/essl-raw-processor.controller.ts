import { Controller, Get, Header, HttpCode, Query } from '@nestjs/common';
import { EsslRawProcessorService } from './essl-raw-processor.service';

@Controller()
export class EsslRawProcessorController {
  constructor(private readonly svc: EsslRawProcessorService) {}

  /**
   * Process verified essl_raw_attlog → process_att_logs (dashboard present list).
   * Manual equivalent: `npx ts-node frontend/scripts/process-att-logs.ts`
   *
   * Query: ?limit=500
   */
  @Get('process-essl-raw')
  @HttpCode(200)
  @Header('Content-Type', 'application/json')
  async run(@Query('limit') limit = '500') {
    let take = parseInt(String(limit), 10);
    if (isNaN(take) || take < 1) take = 500;
    if (take > 5000) take = 5000;

    const result = await this.svc.processPending({ take });
    return result;
  }
}
