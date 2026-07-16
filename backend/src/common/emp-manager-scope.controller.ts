import { Controller, Get, Query, Req, UnauthorizedException, UseGuards, Param, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';
import { EmpLocationAttendanceService } from '../emp-location-attendance/emp-location-attendance.service';
import { EmpManagerScopeService } from './emp-manager-scope.service';

@Controller('emp-manager-scope')
@UseGuards(AuthGuard('jwt'))
export class EmpManagerScopeController {
  constructor(
    private readonly scope: EmpManagerScopeService,
    private readonly prisma: PrismaService,
    private readonly attendance: EmpLocationAttendanceService,
  ) {}

  private getEmployeeId(req: { user?: { employeeId?: number; sub?: number } }): number {
    const id = req.user?.employeeId ?? req.user?.sub;
    if (!id) throw new UnauthorizedException('Employee ID not found in token');
    return Number(id);
  }

  @Get('reportees')
  async reportees(@Req() req: { user?: { employeeId?: number; sub?: number } }) {
    const employeeId = this.getEmployeeId(req);
    const directReporteeIds = await this.scope.getDirectReporteeIds(employeeId);
    const reporteeIds = await this.scope.getReporteeIds(employeeId);
    const hasReportees = directReporteeIds.length > 0;
    const reportees = hasReportees
      ? await this.prisma.manageEmployee.findMany({
          where: { id: { in: directReporteeIds } },
          select: {
            id: true,
            employeeID: true,
            employeeFirstName: true,
            employeeLastName: true,
          },
        })
      : [];
    return { employeeId, reporteeIds, directReporteeIds, hasReportees, reportees };
  }

  @Get('reportees-today-status')
  async reporteesTodayStatus(@Req() req: { user?: { employeeId?: number; sub?: number } }) {
    const employeeId = this.getEmployeeId(req);
    const directReporteeIds = await this.scope.getDirectReporteeIds(employeeId);
    if (directReporteeIds.length === 0) {
      return { reportees: [] };
    }

    const employees = await this.prisma.manageEmployee.findMany({
      where: { id: { in: directReporteeIds } },
      select: this.employeeSelect,
    });

    const reportees = await this.statusForEmployees(employees);

    return { reportees };
  }

  private employeeSelect = {
    id: true,
    employeeID: true,
    employeeFirstName: true,
    employeeLastName: true,
    employeePhotoUrl: true,
    businessEmail: true,
    joiningDate: true,
    designations: { select: { designation: true } },
  } as const;

  private async statusForEmployees(
    employees: {
      id: number;
      employeeID: string | null;
      employeeFirstName: string | null;
      employeeLastName: string | null;
      employeePhotoUrl?: string | null;
      businessEmail?: string | null;
      joiningDate?: Date | string | null;
      designations?: { designation: string | null } | null;
    }[],
  ) {
    return Promise.all(
      employees.map(async (emp) => {
        const status = await this.attendance.getTodayStatus(emp.id);
        const checkInIso = status.checkIn?.checkinTime
          ? new Date(status.checkIn.checkinTime).toISOString()
          : null;
        let statusLabel = 'Yet to check-in';
        if (status.isAbsentToday) statusLabel = 'Absent';
        else if (status.isCheckedIn) statusLabel = 'Checked in';
        else if (status.isCheckedOut || status.checkOut) statusLabel = 'Checked out';

        return {
          id: emp.id,
          employeeID: emp.employeeID,
          employeeFirstName: emp.employeeFirstName,
          employeeLastName: emp.employeeLastName,
          employeePhotoUrl: emp.employeePhotoUrl ?? null,
          email: emp.businessEmail ?? null,
          designation: emp.designations?.designation ?? null,
          joiningDate: emp.joiningDate
            ? new Date(emp.joiningDate).toISOString().slice(0, 10)
            : null,
          isCheckedIn: status.isCheckedIn,
          isAbsentToday: status.isAbsentToday,
          checkInTime: checkInIso,
          statusLabel,
        };
      }),
    );
  }

  @Get('team-today-status')
  async teamTodayStatus(
    @Req() req: { user?: { employeeId?: number; sub?: number } },
    @Query('scope') scope?: string,
  ) {
    const employeeId = this.getEmployeeId(req);
    const mode = scope === 'reportees' ? 'reportees' : 'team';

    if (mode === 'reportees') {
      const directReporteeIds = await this.scope.getDirectReporteeIds(employeeId);
      if (directReporteeIds.length === 0) {
        return { members: [], scope: mode };
      }
      const employees = await this.prisma.manageEmployee.findMany({
        where: { id: { in: directReporteeIds } },
        select: this.employeeSelect,
      });
      const members = await this.statusForEmployees(employees);
      return { members, scope: mode };
    }

    const me = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: { departmentNameID: true, companyID: true },
    });

    if (!me?.departmentNameID) {
      return { members: [], scope: mode };
    }

    const employees = await this.prisma.manageEmployee.findMany({
      where: {
        departmentNameID: me.departmentNameID,
        companyID: me.companyID ?? undefined,
        isDeleted: false,
        id: { not: employeeId },
      },
      select: this.employeeSelect,
      orderBy: [{ employeeFirstName: 'asc' }, { employeeLastName: 'asc' }],
    });

    const members = await this.statusForEmployees(employees);
    return { members, scope: mode };
  }

  @Get('member/:id/attendance-history')
  async memberAttendanceHistory(
    @Req() req: { user?: { employeeId?: number; sub?: number } },
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const managerId = this.getEmployeeId(req);
    const targetId = Number(id);
    if (!targetId) return { days: [] };

    const allowed = await this.scope.canViewEmployee(managerId, targetId);
    if (!allowed) throw new ForbiddenException('Not allowed to view this employee');

    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 30 * 86400000);

    const records = await this.attendance.getMyRecords(targetId, {
      from: fromDate,
      to: toDate,
      limit: 500,
    });

    const byDay = new Map<string, { date: string; status: string; inTime?: string; outTime?: string }>();
    for (const log of records) {
      const d = new Date(log.checkinTime);
      const key = d.toISOString().slice(0, 10);
      const row = byDay.get(key) ?? { date: key, status: 'Present' };
      const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      if (log.checkType === 'CHECK_IN' && !row.inTime) row.inTime = time;
      if (log.checkType === 'CHECK_OUT') row.outTime = time;
      byDay.set(key, row);
    }

    return { days: Array.from(byDay.values()).sort((a, b) => b.date.localeCompare(a.date)) };
  }
}
