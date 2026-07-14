import { Module } from '@nestjs/common';
import { SystemDashboardService } from './system-dashboard.service';
import { SystemDashboardController } from './system-dashboard.controller';

@Module({
  providers: [SystemDashboardService],
  controllers: [SystemDashboardController]
})
export class SystemDashboardModule {}
