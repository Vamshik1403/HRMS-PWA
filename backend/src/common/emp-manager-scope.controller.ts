import { Controller, Get, Post, Body, Query, Req, UnauthorizedException, UseGuards, Param, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Prisma } from '@prisma/client';
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
      where: {
        id: { in: directReporteeIds },
        isDeleted: false,
        lifecycleStatus: 'ACTIVE',
      },
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
    departmentNameID: true,
    designations: { select: { designation: true } },
    empDepartment: {
      select: { id: true, departmentNameID: true, effectFrom: true },
      orderBy: { id: 'desc' as const },
    },
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
        where: {
          id: { in: directReporteeIds },
          isDeleted: false,
          lifecycleStatus: 'ACTIVE',
        },
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
        lifecycleStatus: 'ACTIVE',
        id: { not: employeeId },
      },
      select: this.employeeSelect,
      orderBy: [{ employeeFirstName: 'asc' }, { employeeLastName: 'asc' }],
    });

    const members = await this.statusForEmployees(employees);
    return { members, scope: mode };
  }

  @Get('company-departments')
  async companyDepartments(@Req() req: { user?: { employeeId?: number; sub?: number } }) {
    const employeeId = this.getEmployeeId(req);
    const me = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: {
        companyID: true,
        branchesID: true,
        serviceProviderID: true,
        departmentNameID: true,
        branches: { select: { companyID: true } },
      },
    });

    if (!me) {
      return { departments: [] };
    }

    let companyID = me.companyID ?? me.branches?.companyID ?? null;
    let branchesID = me.branchesID ?? null;
    const serviceProviderID = me.serviceProviderID ?? null;

    if (!companyID && me.departmentNameID) {
      const selfDept = await this.prisma.departments.findUnique({
        where: { id: me.departmentNameID },
        select: { companyID: true, branchesID: true },
      });
      if (selfDept) {
        companyID = selfDept.companyID ?? companyID;
        branchesID = selfDept.branchesID ?? branchesID;
      }
    }

    const branchIds: number[] = [];
    if (companyID) {
      const branches = await this.prisma.branches.findMany({
        where: { companyID },
        select: { id: true },
      });
      branchIds.push(...branches.map((b) => b.id));
    } else if (branchesID) {
      branchIds.push(branchesID);
    }

    const employeeWhere: Prisma.ManageEmployeeWhereInput = {
      isDeleted: false,
      lifecycleStatus: 'ACTIVE',
    };

    if (companyID) {
      const or: Prisma.ManageEmployeeWhereInput[] = [{ companyID }];
      if (branchIds.length > 0) or.push({ branchesID: { in: branchIds } });
      employeeWhere.OR = or;
    } else if (branchesID) {
      employeeWhere.branchesID = branchesID;
    } else if (serviceProviderID) {
      employeeWhere.serviceProviderID = serviceProviderID;
    } else {
      return { departments: [] };
    }

    const employees = await this.prisma.manageEmployee.findMany({
      where: employeeWhere,
      select: this.employeeSelect,
      orderBy: [{ employeeFirstName: 'asc' }, { employeeLastName: 'asc' }],
    });

    const employeesWithStatus = await this.statusForEmployees(employees);
    const statusById = new Map(employeesWithStatus.map((e) => [e.id, e]));

    const grouped = new Map<number, typeof employeesWithStatus>();
    const unassigned: typeof employeesWithStatus = [];

    const resolveDepartmentId = (emp: (typeof employees)[number]): number | null => {
      if (emp.departmentNameID) return emp.departmentNameID;
      const latestHistory = Array.isArray(emp.empDepartment)
        ? emp.empDepartment[0]
        : null;
      return latestHistory?.departmentNameID ?? null;
    };

    for (const emp of employees) {
      const row = statusById.get(emp.id);
      if (!row) continue;
      const deptId = resolveDepartmentId(emp);
      if (!deptId) {
        unassigned.push(row);
        continue;
      }
      const list = grouped.get(deptId) ?? [];
      list.push(row);
      grouped.set(deptId, list);
    }

    const deptIds = [...grouped.keys()];

    const departmentBelongsToOrg = (dept: {
      companyID?: number | null;
      branchesID?: number | null;
      serviceProviderID?: number | null;
    }) => {
      if (companyID != null && dept.companyID === companyID) return true;
      if (dept.branchesID != null && branchIds.includes(dept.branchesID)) return true;
      if (
        companyID == null &&
        branchesID != null &&
        dept.branchesID === branchesID
      ) {
        return true;
      }
      if (
        companyID == null &&
        branchesID == null &&
        serviceProviderID != null &&
        dept.serviceProviderID === serviceProviderID
      ) {
        return true;
      }
      return false;
    };

    const deptOr: Prisma.DepartmentsWhereInput[] = [];
    if (companyID) {
      deptOr.push({ companyID });
      deptOr.push({ branches: { companyID } });
    }
    if (branchIds.length > 0) deptOr.push({ branchesID: { in: branchIds } });
    else if (branchesID) deptOr.push({ branchesID });
    if (serviceProviderID) deptOr.push({ serviceProviderID });

    const allOrgDepartments =
      deptOr.length > 0
        ? await this.prisma.departments.findMany({
            where: { OR: deptOr },
            select: {
              id: true,
              departmentName: true,
              companyID: true,
              branchesID: true,
              serviceProviderID: true,
            },
            orderBy: { departmentName: 'asc' },
          })
        : [];

    const orgDeptById = new Map(allOrgDepartments.map((d) => [d.id, d]));

    for (const id of deptIds) {
      if (!orgDeptById.has(id)) {
        const meta = await this.prisma.departments.findUnique({
          where: { id },
          select: {
            id: true,
            departmentName: true,
            companyID: true,
            branchesID: true,
            serviceProviderID: true,
          },
        });
        if (meta && departmentBelongsToOrg(meta)) {
          orgDeptById.set(id, meta);
        }
      }
    }

    const result = [...orgDeptById.values()]
      .map((dept) => ({
        id: dept.id,
        departmentName: dept.departmentName ?? 'Unnamed department',
        employeeCount: grouped.get(dept.id)?.length ?? 0,
        employees: grouped.get(dept.id) ?? [],
      }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName));

    if (unassigned.length > 0) {
      result.push({
        id: 0,
        departmentName: 'Unassigned',
        employeeCount: unassigned.length,
        employees: unassigned,
      });
    }

    return { departments: result };
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
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      const row = byDay.get(key) ?? { date: key, status: 'Present' };
      const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      if (log.checkType === 'CHECK_IN' && !row.inTime) row.inTime = time;
      if (log.checkType === 'CHECK_OUT') row.outTime = time;
      byDay.set(key, row);
    }

    return {
      days: Array.from(byDay.values()).sort((a, b) => b.date.localeCompare(a.date)),
      records,
    };
  }

  private delegationSelect = {
    id: true,
    delegatorId: true,
    delegateeId: true,
    delegationType: true,
    startDate: true,
    endDate: true,
    notification: true,
    description: true,
    status: true,
    createdAt: true,
    delegator: {
      select: {
        id: true,
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        employeePhotoUrl: true,
      },
    },
    delegatee: {
      select: {
        id: true,
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        employeePhotoUrl: true,
      },
    },
  } as const;

  private formatDelegation(row: {
    id: number;
    delegatorId: number;
    delegateeId: number;
    delegationType: string;
    startDate: Date | null;
    endDate: Date | null;
    notification: string;
    description: string | null;
    status: string;
    createdAt: Date;
    delegator: {
      id: number;
      employeeID: string | null;
      employeeFirstName: string | null;
      employeeLastName: string | null;
      employeePhotoUrl: string | null;
    };
    delegatee: {
      id: number;
      employeeID: string | null;
      employeeFirstName: string | null;
      employeeLastName: string | null;
      employeePhotoUrl: string | null;
    };
  }) {
    const name = (e: { employeeFirstName: string | null; employeeLastName: string | null; employeeID: string | null }) =>
      [e.employeeFirstName, e.employeeLastName].filter(Boolean).join(' ').trim() || e.employeeID || '';
    return {
      id: row.id,
      delegatorId: row.delegatorId,
      delegateeId: row.delegateeId,
      delegationType: row.delegationType,
      startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : null,
      endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : null,
      notification: row.notification,
      description: row.description,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      delegatorName: name(row.delegator),
      delegateeName: name(row.delegatee),
      delegatorPhotoUrl: row.delegator.employeePhotoUrl,
      delegateePhotoUrl: row.delegatee.employeePhotoUrl,
    };
  }

  @Get('delegation-colleagues')
  async delegationColleagues(@Req() req: { user?: { employeeId?: number; sub?: number } }) {
    const employeeId = this.getEmployeeId(req);
    const self = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: { companyID: true, branchesID: true, serviceProviderID: true },
    });
    if (!self?.companyID) return { colleagues: [] };

    const colleagues = await this.prisma.manageEmployee.findMany({
      where: {
        id: { not: employeeId },
        companyID: self.companyID,
        isDeleted: false,
        lifecycleStatus: 'ACTIVE',
      },
      select: {
        id: true,
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        employeePhotoUrl: true,
      },
      orderBy: [{ employeeFirstName: 'asc' }, { employeeLastName: 'asc' }],
    });

    return {
      colleagues: colleagues.map((c) => ({
        id: c.id,
        employeeID: c.employeeID,
        name: [c.employeeFirstName, c.employeeLastName].filter(Boolean).join(' ').trim() || c.employeeID || `Employee #${c.id}`,
        employeePhotoUrl: c.employeePhotoUrl,
      })),
    };
  }

  @Get('delegations')
  async delegations(@Req() req: { user?: { employeeId?: number; sub?: number } }) {
    const employeeId = this.getEmployeeId(req);
    const baseWhere = { isDeleted: false, status: 'ACTIVE' };

    const [asDelegator, asDelegatee] = await Promise.all([
      this.prisma.employeeDelegation.findMany({
        where: { ...baseWhere, delegatorId: employeeId },
        select: this.delegationSelect,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employeeDelegation.findMany({
        where: { ...baseWhere, delegateeId: employeeId },
        select: this.delegationSelect,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      asDelegator: asDelegator.map((r) => this.formatDelegation(r)),
      asDelegatee: asDelegatee.map((r) => this.formatDelegation(r)),
    };
  }

  @Post('delegations')
  async createDelegation(
    @Req() req: { user?: { employeeId?: number; sub?: number } },
    @Body()
    body: {
      delegateeId?: number;
      delegationType?: string;
      startDate?: string;
      endDate?: string;
      notification?: string;
      description?: string;
    },
  ) {
    const employeeId = this.getEmployeeId(req);
    const delegateeId = Number(body.delegateeId);
    if (!delegateeId || delegateeId === employeeId) {
      throw new BadRequestException('A valid delegatee is required');
    }

    const delegationType = (body.delegationType || 'TEMPORARY').toUpperCase();
    if (!['TEMPORARY', 'PERMANENT'].includes(delegationType)) {
      throw new BadRequestException('Invalid delegation type');
    }

    const notification = (body.notification || 'BOTH').toUpperCase();
    if (!['BOTH', 'DELEGATEE_ONLY'].includes(notification)) {
      throw new BadRequestException('Invalid notification option');
    }

    if (delegationType === 'TEMPORARY' && (!body.startDate || !body.endDate)) {
      throw new BadRequestException('Start and end dates are required for temporary delegation');
    }

    const allowed = await this.scope.canViewEmployee(employeeId, delegateeId);
    if (!allowed) throw new ForbiddenException('Cannot delegate to this employee');

    const self = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: { companyID: true, branchesID: true, serviceProviderID: true },
    });
    if (!self) throw new UnauthorizedException('Employee not found');

    const created = await this.prisma.employeeDelegation.create({
      data: {
        delegatorId: employeeId,
        delegateeId,
        delegationType,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        notification,
        description: body.description?.trim() || null,
        companyID: self.companyID,
        branchesID: self.branchesID,
        serviceProviderID: self.serviceProviderID,
      },
      select: this.delegationSelect,
    });

    return this.formatDelegation(created);
  }
}
