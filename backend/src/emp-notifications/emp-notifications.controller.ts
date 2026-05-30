import { Controller, Get, Query, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EmpNotificationsService } from './emp-notifications.service';

@Controller('emp-notifications')
@UseGuards(AuthGuard('jwt'))
export class EmpNotificationsController {
  constructor(private readonly service: EmpNotificationsService) {}

  private getEmployeeId(req: { user?: { employeeId?: number; sub?: number } }): number {
    const id = req.user?.employeeId ?? req.user?.sub;
    if (!id) throw new UnauthorizedException('Employee ID not found in token');
    return Number(id);
  }

  @Get('feed')
  getFeed(
    @Req() req: { user?: { employeeId?: number; sub?: number } },
    @Query('recentDays') recentDays?: string,
    @Query('olderDays') olderDays?: string,
  ) {
    const employeeId = this.getEmployeeId(req);
    const recent = Math.min(Math.max(Number(recentDays) || 7, 1), 30);
    const older = Math.min(Math.max(Number(olderDays) || 90, 7), 365);
    return this.service.getFeed(employeeId, recent, older);
  }
}
