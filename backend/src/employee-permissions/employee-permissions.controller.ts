import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { EmployeePermissionsService } from './employee-permissions.service';

@Controller('employee-permissions')
export class EmployeePermissionsController {
  constructor(private readonly service: EmployeePermissionsService) {}

  @Get('modules')
  async listModules(@Req() req: Request, @Query('companyId') companyId?: string) {
    const resolved = await this.service.resolveModulesCompany(req, companyId);
    return this.service.listModules(resolved);
  }

  @Get('me')
  getMyAccess(@Req() req: Request) {
    const user = (req as any).user;
    if (!user || user.type !== 'employee') {
      return this.service.getAccessFromAuthHeader(req);
    }
    return this.service.getMyAccess(
      Number(user.employeeId || user.sub),
      Number(user.companyID),
    );
  }

  @Get()
  async getForEmployee(
    @Req() req: Request,
    @Query('employeeId') employeeId?: string,
  ) {
    const actor = await this.service.resolveActor(req);
    if (!employeeId) throw new BadRequestException('employeeId is required');
    return this.service.getForEmployee(actor, Number(employeeId));
  }

  @Put()
  async saveForEmployee(
    @Req() req: Request,
    @Body()
    body: {
      employeeId?: number;
      permissions?: Array<{
        moduleKey: string;
        canView?: boolean;
        canCreate?: boolean;
        canEdit?: boolean;
        canDelete?: boolean;
      }>;
    },
  ) {
    const actor = await this.service.resolveActor(req);
    if (!body?.employeeId) throw new BadRequestException('employeeId is required');
    if (!Array.isArray(body.permissions)) {
      throw new BadRequestException('permissions array is required');
    }
    return this.service.saveForEmployee(
      actor,
      Number(body.employeeId),
      body.permissions.map((p) => ({
        moduleKey: p.moduleKey,
        canView: !!p.canView,
        canCreate: !!p.canCreate,
        canEdit: !!p.canEdit,
        canDelete: !!p.canDelete,
      })),
    );
  }

  @Get('employees')
  async listEmployees(@Req() req: Request) {
    const actor = await this.service.resolveActor(req);
    return this.service.listGrantableEmployees(actor);
  }
}
