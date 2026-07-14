import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SystemDashboardService } from './system-dashboard.service';

@Controller('system-dashboard')
@UseGuards(AuthGuard('jwt'))
export class SystemDashboardController {
  constructor(private readonly service: SystemDashboardService) {}

  @Get('live')
  getLiveMetrics() {
    return this.service.getLiveMetrics();
  }
}