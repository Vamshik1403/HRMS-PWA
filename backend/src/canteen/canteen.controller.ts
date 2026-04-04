import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
} from '@nestjs/common';
import { CanteenService } from './canteen.service';
import { UpdateCanteenSetupDto } from './dto/update-canteen-setup.dto';

@Controller('canteen')
export class CanteenController {
  constructor(private readonly canteenService: CanteenService) {}

  private parseCompanyId(val?: string): number | undefined {
    if (!val) return undefined;
    const n = parseInt(val, 10);
    return isNaN(n) ? undefined : n;
  }

  // GET /canteen/setup
  @Get('setup')
  getSetup() {
    return this.canteenService.getSetup();
  }

  // PATCH /canteen/setup
  @Patch('setup')
  updateSetup(@Body() dto: UpdateCanteenSetupDto) {
    return this.canteenService.updateSetup(dto);
  }

  // GET /canteen/dashboard?date=2026-03-27&companyId=1
  @Get('dashboard')
  getDashboard(@Query('date') date?: string, @Query('companyId') companyId?: string) {
    return this.canteenService.getDashboard(date, this.parseCompanyId(companyId));
  }

  // GET /canteen/dashboard/checkin?date=2026-03-27&companyId=1
  @Get('dashboard/checkin')
  getCheckinEmployees(@Query('date') date?: string, @Query('companyId') companyId?: string) {
    return this.canteenService.getCheckinEmployees(date, this.parseCompanyId(companyId));
  }

  // GET /canteen/dashboard/token-assigned?date=2026-03-27&companyId=1
  @Get('dashboard/token-assigned')
  getTokenAssigned(@Query('date') date?: string, @Query('companyId') companyId?: string) {
    return this.canteenService.getTokenAssigned(date, this.parseCompanyId(companyId));
  }

  // GET /canteen/dashboard/token-consumed?date=2026-03-27&companyId=1
  @Get('dashboard/token-consumed')
  getTokenConsumed(@Query('date') date?: string, @Query('companyId') companyId?: string) {
    return this.canteenService.getTokenConsumed(date, this.parseCompanyId(companyId));
  }

  // GET /canteen/dashboard/token-cancel?date=2026-03-27&companyId=1
  @Get('dashboard/token-cancel')
  getTokenCancel(@Query('date') date?: string, @Query('companyId') companyId?: string) {
    return this.canteenService.getTokenCancel(date, this.parseCompanyId(companyId));
  }

  // GET /canteen/dashboard/token-not-consumed?date=2026-03-27&companyId=1
  @Get('dashboard/token-not-consumed')
  getTokenNotConsumed(@Query('date') date?: string, @Query('companyId') companyId?: string) {
    return this.canteenService.getTokenNotConsumed(date, this.parseCompanyId(companyId));
  }

  // GET /canteen/reports?dateFrom=2026-03-20&dateTo=2026-03-28&type=checkin|tokenAssigned|tokenConsumed|tokenNotConsumed&companyId=1&branchId=1&departmentId=1
  @Get('reports')
  getReports(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('type') type?: string,
    @Query('companyId') companyId?: string,
    @Query('branchId') branchId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.canteenService.getReports(
      dateFrom,
      dateTo,
      type,
      this.parseCompanyId(companyId),
      this.parseCompanyId(branchId),
      this.parseCompanyId(departmentId),
    );
  }
}
