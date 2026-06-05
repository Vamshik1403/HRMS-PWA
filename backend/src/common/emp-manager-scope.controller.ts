import { Controller, Get, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';
import { EmpManagerScopeService } from './emp-manager-scope.service';

@Controller('emp-manager-scope')
@UseGuards(AuthGuard('jwt'))
export class EmpManagerScopeController {
  constructor(
    private readonly scope: EmpManagerScopeService,
    private readonly prisma: PrismaService,
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
}
