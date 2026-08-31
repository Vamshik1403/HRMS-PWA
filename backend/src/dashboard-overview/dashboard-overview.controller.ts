import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  DashboardOverviewService,
  type TodayOverviewQuery,
} from './dashboard-overview.service';

const PLATFORM_ROLES = new Set(['SUPERADMIN', 'SERVICE_PROVIDER']);

type JwtUser = { role?: string; companyID?: number };

@Controller('dashboard-overview')
export class DashboardOverviewController {
  constructor(private readonly service: DashboardOverviewService) {}

  private scopedOverviewQuery(
    req: { user?: JwtUser },
    raw: {
      companyID?: string;
      branchId?: string;
      departmentId?: string;
      serviceProviderID?: string;
    },
  ): { empty: boolean; query: TodayOverviewQuery } {
    const role = String(req.user?.role || '').toUpperCase();
    const tokenCompanyID = Number(req.user?.companyID);
    const hasTokenCompany =
      Number.isFinite(tokenCompanyID) && tokenCompanyID > 0;
    const branchId = raw.branchId ? Number(raw.branchId) : undefined;
    const departmentId = raw.departmentId ? Number(raw.departmentId) : undefined;

    if (!PLATFORM_ROLES.has(role)) {
      if (!hasTokenCompany) {
        return { empty: true, query: { branchId, departmentId } };
      }
      return {
        empty: false,
        query: { companyID: tokenCompanyID, branchId, departmentId },
      };
    }

    return {
      empty: false,
      query: {
        companyID: raw.companyID ? Number(raw.companyID) : undefined,
        branchId,
        departmentId,
        serviceProviderID: raw.serviceProviderID
          ? Number(raw.serviceProviderID)
          : undefined,
      },
    };
  }

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
  @UseGuards(AuthGuard('jwt'))
  getNewJoiners(
    @Req() req: { user?: JwtUser },
    @Query('companyID') companyID?: string,
    @Query('branchId') branchId?: string,
    @Query('serviceProviderID') serviceProviderID?: string,
  ) {
    const scoped = this.scopedOverviewQuery(req, {
      companyID,
      branchId,
      serviceProviderID,
    });
    if (scoped.empty) return this.service.emptyNewJoiners();
    return this.service.getNewJoiners(scoped.query);
  }

  @Get('today-overview')
  @UseGuards(AuthGuard('jwt'))
  getTodayOverview(
    @Req() req: { user?: JwtUser },
    @Query('companyID') companyID?: string,
    @Query('branchId') branchId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('serviceProviderID') serviceProviderID?: string,
  ) {
    const scoped = this.scopedOverviewQuery(req, {
      companyID,
      branchId,
      departmentId,
      serviceProviderID,
    });
    if (scoped.empty) return this.service.emptyTodayOverview(scoped.query);
    return this.service.getTodayOverview(scoped.query);
  }
}
