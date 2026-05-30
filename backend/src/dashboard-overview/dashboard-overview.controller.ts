import { Controller, Get, Query } from '@nestjs/common';
import { DashboardOverviewService } from './dashboard-overview.service';

@Controller('dashboard-overview')
export class DashboardOverviewController {
  constructor(private readonly service: DashboardOverviewService) {}

  @Get('today-overview')
  getTodayOverview(
    @Query('companyID') companyID?: string,
    @Query('branchId') branchId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('serviceProviderID') serviceProviderID?: string,
  ) {
    return this.service.getTodayOverview({
      companyID: companyID ? Number(companyID) : undefined,
      branchId: branchId ? Number(branchId) : undefined,
      departmentId: departmentId ? Number(departmentId) : undefined,
      serviceProviderID: serviceProviderID
        ? Number(serviceProviderID)
        : undefined,
    });
  }
}
