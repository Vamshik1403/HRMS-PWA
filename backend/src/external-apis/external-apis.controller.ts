import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExternalApisService } from './external-apis.service';

@Controller('external-apis')
@UseGuards(AuthGuard('jwt'))
export class ExternalApisController {
  constructor(private readonly apis: ExternalApisService) {}

  private assertSuperAdmin(req: any) {
    if (String(req.user?.role || '').toUpperCase() !== 'SUPERADMIN') {
      throw new ForbiddenException('External API details are available to SuperAdmin only.');
    }
  }

  @Get()
  list(@Req() req: any) {
    this.assertSuperAdmin(req);
    return this.apis.catalog();
  }

  @Get('google-maps')
  googleMaps(@Req() req: any) {
    this.assertSuperAdmin(req);
    return this.apis.googleMapsUsage();
  }
}
