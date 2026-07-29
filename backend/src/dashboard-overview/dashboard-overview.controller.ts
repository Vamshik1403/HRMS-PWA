import { Controller, Get, Query } from '@nestjs/common';
import { DashboardOverviewService } from './dashboard-overview.service';

@Controller('dashboard-overview')
export class DashboardOverviewController {
  constructor(private readonly service: DashboardOverviewService) {}

  @Get('probation-alerts')
  getProbationAlerts(
    @Query('companyID') companyID?: string,
    @Query('branchId') branchId?: string,
    @Query('daysAhead') daysAhead?: string,
  ) {
    return this.service.getProbationAlerts({
      companyID: companyID ? Number(companyID) : undefined,
      branchId: branchId ? Number(branchId) : undefined,
      daysAhead: daysAhead ? Number(daysAhead) : 60,
    });
  }

  @Get('hr-widgets')
  getHrWidgets(
    @Query('companyID') companyID?: string,
    @Query('branchId') branchId?: string,
    @Query('serviceProviderID') serviceProviderID?: string,
  ) {
    return this.service.getHrWidgets({
      companyID: companyID ? Number(companyID) : undefined,
      branchId: branchId ? Number(branchId) : undefined,
      serviceProviderID: serviceProviderID
        ? Number(serviceProviderID)
        : undefined,
    });
  }

  @Get('new-joiners')
  getNewJoiners(
    @Query('companyID') companyID?: string,
    @Query('branchId') branchId?: string,
    @Query('serviceProviderID') serviceProviderID?: string,
  ) {
    return this.service.getNewJoiners({
      companyID: companyID ? Number(companyID) : undefined,
      branchId: branchId ? Number(branchId) : undefined,
      serviceProviderID: serviceProviderID
        ? Number(serviceProviderID)
        : undefined,
    });
  }

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
