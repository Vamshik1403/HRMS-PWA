import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EmpLocationAttendanceService } from './emp-location-attendance.service';
import { EmpMarkoutReminderService } from './emp-markout-reminder.service';
import { CreateAttendanceLocationDto } from './dto/create-attendance-location.dto';
import { MarkAbsentDto } from './dto/mark-absent.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('emp-location-attendance')
@UseGuards(AuthGuard('jwt'))
export class EmpLocationAttendanceController {
  constructor(
    private readonly svc: EmpLocationAttendanceService,
    private readonly markoutReminder: EmpMarkoutReminderService,
  ) {}

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
  async getMyRecords(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const parse = (v?: string) => {
      if (!v?.trim()) return undefined;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };
    // Punch times are stored as wall-clock encoded in UTC, so the day bounds
    // must be built in UTC too. Building them with local getters (as before)
    // shifted the window by the server's timezone offset and could drop the
    // current day's later check-ins from the history list.
    let fromDate = parse(from);
    if (fromDate) {
      fromDate = new Date(
        Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate(), 0, 0, 0, 0),
      );
    }
    let toDate = parse(to);
    if (toDate) {
      toDate = new Date(
        Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate(), 23, 59, 59, 999),
      );
    }
    const employeeId = this.getEmployeeId(req);
    const records = await this.svc.getMyRecords(employeeId, {
      from: fromDate,
      to: toDate,
    });
    const merged = await this.svc.mergeDevicePunchesIntoRecords(
      employeeId,
      fromDate,
      toDate,
      records,
    );
    return this.svc.enrichAddressesFromProcessLogs(employeeId, fromDate, toDate, merged);
  }

  @Get('today')
  getTodayStatus(@Req() req: any) {
    return this.svc.getTodayStatus(this.getEmployeeId(req));
  }

  @Get('markout-reminder')
  getMarkoutReminder(@Req() req: any) {
    return this.markoutReminder.evaluateMarkoutReminder(this.getEmployeeId(req));
  }

  @Get('photos')
  getPhotos(
    @Req() req: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('companyID') companyID?: string,
    @Query('branchesID') branchesID?: string,
  ) {
    const parseDay = (v: string | undefined, end: boolean) => {
      if (!v?.trim()) return undefined;
      const dayMatch = v.trim().match(/^(\d{4}-\d{2}-\d{2})/);
      const day = dayMatch?.[1];
      if (day) {
        return new Date(end ? `${day}T23:59:59.999Z` : `${day}T00:00:00.000Z`);
      }
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return undefined;
      const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      return new Date(end ? `${iso}T23:59:59.999Z` : `${iso}T00:00:00.000Z`);
    };
    const from = parseDay(dateFrom, false);
    const to = parseDay(dateTo, true);
    if (!from || !to) {
      throw new BadRequestException('dateFrom and dateTo are required');
    }
    const payload = req.user || {};
    if (String(payload.role || '').toUpperCase() === 'EMPLOYEE') {
      throw new ForbiddenException('Photo report is not available for employee logins.');
    }
    const parsedCompany = companyID ? Number(companyID) : Number(payload.companyID || payload.activeCompanyID || 0);
    void branchesID;
    return this.svc.getPhotoReport({
      dateFrom: from,
      dateTo: to,
      companyID: Number.isFinite(parsedCompany) && parsedCompany > 0 ? parsedCompany : undefined,
    });
  }

  @Post('mark-absent')
  markAbsent(@Body() dto: MarkAbsentDto, @Req() req: any) {
    return this.svc.markAbsent(this.getEmployeeId(req), dto);
  }
}
