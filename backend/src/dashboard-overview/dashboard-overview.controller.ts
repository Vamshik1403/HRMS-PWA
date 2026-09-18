import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  DashboardOverviewService,
  type TodayOverviewQuery,
} from './dashboard-overview.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveActiveCompanyForUser } from '../common/active-company.util';

const PLATFORM_ROLES = new Set(['SUPERADMIN', 'SERVICE_PROVIDER']);

type JwtUser = { sub?: number; id?: number; role?: string; companyID?: number };

@Controller('dashboard-overview')
export class DashboardOverviewController {
  constructor(
    private readonly service: DashboardOverviewService,
    private readonly prisma: PrismaService,
  ) {}

  private async scopedOverviewQuery(
    req: { user?: JwtUser; headers?: Record<string, unknown> },
    raw: {
      companyID?: string;
      branchId?: string;
      departmentId?: string;
      serviceProviderID?: string;
    },
  ): Promise<{ empty: boolean; query: TodayOverviewQuery }> {
    const role = String(req.user?.role || '').toUpperCase();
    const branchId = raw.branchId ? Number(raw.branchId) : undefined;
    const departmentId = raw.departmentId ? Number(raw.departmentId) : undefined;
    const requestedCompanyID = raw.companyID ? Number(raw.companyID) : undefined;

    if (PLATFORM_ROLES.has(role)) {
      return {
        empty: false,
        query: {
          companyID: requestedCompanyID,
          branchId,
          departmentId,
          serviceProviderID: raw.serviceProviderID
            ? Number(raw.serviceProviderID)
            : undefined,
        },
      };
    }

    const companyID = await resolveActiveCompanyForUser(
      this.prisma,
      req,
      requestedCompanyID,
    );
    if (!companyID) {
      return { empty: true, query: { branchId, departmentId } };
    }
    return {
      empty: false,
      query: { companyID, branchId, departmentId },
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
  async getNewJoiners(
    @Req() req: { user?: JwtUser },
    @Query('companyID') companyID?: string,
    @Query('branchId') branchId?: string,
    @Query('serviceProviderID') serviceProviderID?: string,
  ) {
    const scoped = await this.scopedOverviewQuery(req, {
      companyID,
      branchId,
      serviceProviderID,
    });
    if (scoped.empty) return this.service.emptyNewJoiners();
    return this.service.getNewJoiners(scoped.query);
  }

  @Get('today-overview')
  @UseGuards(AuthGuard('jwt'))
  async getTodayOverview(
    @Req() req: { user?: JwtUser },
    @Query('companyID') companyID?: string,
    @Query('branchId') branchId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('serviceProviderID') serviceProviderID?: string,
  ) {
    const scoped = await this.scopedOverviewQuery(req, {
      companyID,
      branchId,
      departmentId,
      serviceProviderID,
    });
    if (scoped.empty) return this.service.emptyTodayOverview(scoped.query);
    return this.service.getTodayOverview(scoped.query);
  }
}
