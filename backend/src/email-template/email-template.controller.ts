import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { EmailTemplateService } from './email-template.service';

@Controller('email-template')
export class EmailTemplateController {
  constructor(private readonly service: EmailTemplateService) {}

  @Get()
  findAll(@Query('companyID') companyID?: string) {
    return this.service.findAll(
      companyID ? Number(companyID) : undefined,
    );
  }

  @Post('seed')
  seed(@Query('companyID') companyID?: string) {
    const cid = companyID ? Number(companyID) : null;
    return this.service.seedDefaults(cid);
  }

  @Post()
  upsert(
    @Body()
    body: {
      id?: number;
      companyID?: number | null;
      eventType: string;
      subject: string;
      bodyHtml: string;
      enabled?: boolean;
    },
  ) {
    return this.service.upsert(body);
  }
}
