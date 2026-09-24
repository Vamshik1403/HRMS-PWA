import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { hasModuleAction } from '../common/company-module-permissions';
import { loadEmployeePermissions } from '../common/employee-permission.util';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleFeature, GoogleMapsService } from './google-maps.service';

const FEATURES = new Set<GoogleFeature>(['branch', 'wfh', 'site']);
const FEATURE_MODULE: Record<GoogleFeature, 'BRANCHES' | 'EMPLOYEES' | 'TASKS'> = {
  branch: 'BRANCHES',
  wfh: 'EMPLOYEES',
  site: 'TASKS',
};

@Controller('google-maps')
@UseGuards(AuthGuard('jwt'))
export class GoogleMapsController {
  constructor(
    private readonly google: GoogleMapsService,
    private readonly prisma: PrismaService,
  ) {}

  private feature(raw?: string): GoogleFeature {
    const value = String(raw || '').trim() as GoogleFeature;
    if (!FEATURES.has(value)) {
      throw new BadRequestException('feature must be branch, wfh, or site');
    }
    return value;
  }

  private async assertCanLookup(req: any, feature?: GoogleFeature) {
    const role = String(req.user?.role || '').toUpperCase();
    if (role !== 'EMPLOYEE') return;

    const manageEmployeeId = Number(req.user?.employeeId || req.user?.sub);
    const companyId = Number(req.user?.companyID);
    const denied = new ForbiddenException('Location lookup is not available for employee logins.');
    if (!manageEmployeeId) throw denied;

    const emp = await this.prisma.manageEmployee.findUnique({
      where: { id: manageEmployeeId },
      select: { id: true, companyID: true, isCompanyOwner: true, isDeleted: true },
    });
    if (!emp || emp.isDeleted) throw denied;
    if (emp.isCompanyOwner) return;

    const permissions = await loadEmployeePermissions(
      this.prisma,
      emp.id,
      emp.companyID || companyId || null,
      false,
    );
    const keys = feature ? [FEATURE_MODULE[feature]] : (['BRANCHES', 'EMPLOYEES', 'TASKS'] as const);
    const allowed = keys.some((key) => hasModuleAction(permissions, false, key, 'edit'));
    if (!allowed) throw denied;
  }

  private sessionToken(raw?: string): string {
    const value = String(raw || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new BadRequestException('sessionToken must be a UUID.');
    }
    return value;
  }

  @Get('autocomplete')
  async autocomplete(
    @Req() req: any,
    @Query('q') q = '',
    @Query('feature') feature?: string,
    @Query('sessionToken') sessionToken?: string,
  ) {
    const resolved = this.feature(feature);
    await this.assertCanLookup(req, resolved);
    return this.google.autocomplete(q, resolved, this.sessionToken(sessionToken));
  }

  @Get('place')
  async place(
    @Req() req: any,
    @Query('placeId') placeId = '',
    @Query('feature') feature?: string,
    @Query('sessionToken') sessionToken?: string,
  ) {
    const resolved = this.feature(feature);
    await this.assertCanLookup(req, resolved);
    return this.google.placeDetails(placeId, resolved, this.sessionToken(sessionToken));
  }

  @Get('status')
  async status(@Req() req: any, @Query('feature') feature?: string) {
    const resolved = feature ? this.feature(feature) : undefined;
    await this.assertCanLookup(req, resolved);
    return { configured: !!String(process.env.GOOGLE_MAPS_SERVER_KEY || '').trim() };
  }

  @Get('reverse')
  async reverse(
    @Req() req: any,
    @Query('lat') lat = '',
    @Query('lng') lng = '',
    @Query('feature') feature?: string,
  ) {
    const resolved = this.feature(feature);
    await this.assertCanLookup(req, resolved);
    return this.google.reverseGeocode(lat, lng, resolved);
  }

  @Get('geocode')
  async geocode(@Req() req: any, @Query('q') q = '', @Query('feature') feature?: string) {
    const resolved = this.feature(feature);
    await this.assertCanLookup(req, resolved);
    const point = await this.google.geocode(q, resolved);
    if (!point) {
      throw new BadRequestException(
        'Could not find coordinates for this address. Please check the address.',
      );
    }
    return point;
  }

  @Get('usage')
  usage(@Req() req: any) {
    if (String(req.user?.role || '').toUpperCase() !== 'SUPERADMIN') {
      throw new ForbiddenException('Google usage is available to SuperAdmin only.');
    }
    return this.google.usageSummary();
  }
}
