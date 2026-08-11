import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { CompanyHierarchyService } from './company-hierarchy.service';

@Controller('company-hierarchy')
export class CompanyHierarchyController {
  constructor(private readonly service: CompanyHierarchyService) {}

  @Get()
  async getHierarchy(@Query('companyID') companyID?: string) {
    const id = companyID != null && companyID !== '' ? Number(companyID) : NaN;
    if (!Number.isFinite(id) || id <= 0) {
      throw new BadRequestException('companyID query parameter is required');
    }
    return await this.service.getHierarchy(id);
  }
}
