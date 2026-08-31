import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardOverviewController } from './dashboard-overview.controller';
import { DashboardOverviewService } from './dashboard-overview.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DashboardOverviewController],
  providers: [DashboardOverviewService],
})
export class DashboardOverviewModule {}
