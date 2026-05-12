import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { EmpLocationAttendanceService } from './emp-location-attendance.service';
import { CreateAttendanceLocationDto } from './dto/create-attendance-location.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('emp-location-attendance')
@UseGuards(AuthGuard('jwt'))
export class EmpLocationAttendanceController {
  constructor(private readonly svc: EmpLocationAttendanceService) {}

  private getEmployeeId(req: any): number {
    const payload = req.user;
    // For employees, sub == ManageEmployee.id == employeeId
    const id = payload?.employeeId ?? payload?.sub;
    if (!id) throw new UnauthorizedException('Employee ID not found in token');
    return Number(id);
  }

  private getIp(req: any): string {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      return String(forwarded).split(',')[0].trim();
    }
    return req.ip ?? req.connection?.remoteAddress ?? 'unknown';
  }

  @Post('punch')
  punch(@Body() dto: CreateAttendanceLocationDto, @Req() req: any) {
    const employeeId = this.getEmployeeId(req);
    const ip = this.getIp(req);
    return this.svc.checkIn(employeeId, dto, ip);
  }

  @Get('my')
  getMyRecords(@Req() req: any) {
    return this.svc.getMyRecords(this.getEmployeeId(req));
  }

  @Get('today')
  getTodayStatus(@Req() req: any) {
    return this.svc.getTodayStatus(this.getEmployeeId(req));
  }
}
