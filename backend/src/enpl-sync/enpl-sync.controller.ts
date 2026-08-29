import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Post, UseGuards } from '@nestjs/common';
import { EnplSyncGuard } from './enpl-sync.guard';
import { EnplSyncService } from './enpl-sync.service';

@Controller(['api/integrations/enpl', 'integrations/enpl'])
@UseGuards(EnplSyncGuard)
export class EnplSyncController {
  constructor(private readonly service: EnplSyncService) {}

  @Get('health')
  health() {
    return this.service.health();
  }

  @Post('customers')
  @HttpCode(200)
  customers(@Body() body: any, @Headers('x-sync-source') source?: string) {
    if (!body || typeof body !== 'object') throw new BadRequestException('JSON body required');
    return this.service.runInbound(source, () => this.service.upsertCustomerFromEnpl(body));
  }

  @Post('sites')
  @HttpCode(200)
  sites(@Body() body: any, @Headers('x-sync-source') source?: string) {
    if (!body || typeof body !== 'object') throw new BadRequestException('JSON body required');
    return this.service.runInbound(source, () => this.service.upsertSiteFromEnpl(body));
  }

  @Post('tasks')
  @HttpCode(200)
  tasks(@Body() body: any, @Headers('x-sync-source') source?: string) {
    if (!body || typeof body !== 'object') throw new BadRequestException('JSON body required');
    return this.service.runInbound(source, () => this.service.upsertTaskFromEnpl(body));
  }

  @Post('bulk-import')
  @HttpCode(200)
  bulkImport() {
    return this.service.runInbound('enpl', () => this.service.bulkImportFromEnpl());
  }
}
