import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { EmpLocationAttendanceService } from './emp-location-attendance.service';
import { CreateAttendanceLocationDto } from './dto/create-attendance-location.dto';
import { MarkAbsentDto } from './dto/mark-absent.dto';
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
  getMyRecords(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const parse = (v?: string) => {
      if (!v?.trim()) return undefined;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };
    let toDate = parse(to);
    if (toDate) {
      toDate = new Date(
        toDate.getFullYear(),
        toDate.getMonth(),
        toDate.getDate(),
        23,
        59,
        59,
        999,
      );
    }
    return this.svc.getMyRecords(this.getEmployeeId(req), {
      from: parse(from),
      to: toDate,
    });
  }

  @Get('today')
  getTodayStatus(@Req() req: any) {
    return this.svc.getTodayStatus(this.getEmployeeId(req));
  }

  @Post('mark-absent')
  markAbsent(@Body() dto: MarkAbsentDto, @Req() req: any) {
    return this.svc.markAbsent(this.getEmployeeId(req), dto);
  }
}
