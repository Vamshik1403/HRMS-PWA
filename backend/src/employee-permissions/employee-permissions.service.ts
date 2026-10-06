import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  COMPANY_MODULE_KEYS,
  hasModuleAction,
  type ModulePermissionDto,
} from '../common/company-module-permissions';
import { entitledRightsKeys, loadEmployeePermissions } from '../common/employee-permission.util';

type Actor = {
  manageEmployeeId: number;
  companyId: number;
  isCompanyOwner: boolean;
};

@Injectable()
export class EmployeePermissionsService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async resolveModulesCompany(req: Request, companyIdQuery?: string): Promise<number | null> {
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Not authenticated');
    let payload: any;
    try {
      payload = this.jwt.verify(token, {
        secret: process.env.JWT_SECRET || 'secret123',
      });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
    if (payload?.type === 'employee') {
      const actor = await this.resolveActor(req);
      return actor.companyId;
    }
    const id = Number(companyIdQuery);
    if (Number.isFinite(id) && id > 0) return id;
    if (payload?.role) return null;
    throw new ForbiddenException('Only employee accounts can manage rights');
  }

  async listModules(companyId: number | null) {
    const entitled = companyId ? await entitledRightsKeys(this.prisma, companyId) : null;
    const keys = entitled
      ? COMPANY_MODULE_KEYS.filter((moduleKey) => entitled.has(moduleKey))
      : COMPANY_MODULE_KEYS;
    return keys.map((moduleKey) => ({
      moduleKey,
      label: moduleKey
        .split('_')
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' '),
    }));
  }

  private extractToken(req: Request): string | null {
    const auth = req.headers.authorization || req.headers.Authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      return auth.slice(7);
    }
    const cookie = req.headers.cookie || '';
    const match = String(cookie).match(/(?:^|;\s*)accessToken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  async resolveActor(req: Request): Promise<Actor> {
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Not authenticated');

    let payload: any;
    try {
      payload = this.jwt.verify(token, {
        secret: process.env.JWT_SECRET || 'secret123',
      });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    if (payload?.type !== 'employee') {
      throw new ForbiddenException('Only employee accounts can manage rights');
    }

    const manageEmployeeId = Number(payload.employeeId || payload.sub);
    const companyId = Number(payload.companyID);
    if (!manageEmployeeId || !companyId) {
      throw new ForbiddenException('Employee company context missing');
    }

    const emp = await this.prisma.manageEmployee.findUnique({
      where: { id: manageEmployeeId },
      select: { id: true, companyID: true, isCompanyOwner: true, isDeleted: true },
    });
    if (!emp || emp.isDeleted) throw new UnauthorizedException('Employee not found');

    return {
      manageEmployeeId: emp.id,
      companyId: Number(emp.companyID || companyId),
      isCompanyOwner: !!emp.isCompanyOwner,
    };
  }

  async getAccessFromAuthHeader(req: Request) {
    const actor = await this.resolveActor(req);
    return this.getMyAccess(actor.manageEmployeeId, actor.companyId);
  }

  async getMyAccess(manageEmployeeId: number, companyId: number) {
    const emp = await this.prisma.manageEmployee.findUnique({
      where: { id: manageEmployeeId },
      select: {
        id: true,
        isCompanyOwner: true,
        ownerTitle: true,
        companyID: true,
        employeeFirstName: true,
        employeeLastName: true,
      },
    });
    if (!emp) throw new UnauthorizedException('Employee not found');

    const permissions = await loadEmployeePermissions(
      this.prisma,
      emp.id,
      emp.companyID || companyId,
      !!emp.isCompanyOwner,
    );

    return {
      manageEmployeeId: emp.id,
      companyId: emp.companyID,
      isCompanyOwner: !!emp.isCompanyOwner,
      ownerTitle: emp.ownerTitle,
      name: `${emp.employeeFirstName ?? ''} ${emp.employeeLastName ?? ''}`.trim(),
      permissions,
      hasAnyCompanyAccess:
        !!emp.isCompanyOwner || permissions.some((p) => p.canView || p.canCreate || p.canEdit || p.canDelete),
    };
  }

  private async assertCanManageRights(actor: Actor) {
    if (actor.isCompanyOwner) return;
    const permissions = await loadEmployeePermissions(
      this.prisma,
      actor.manageEmployeeId,
      actor.companyId,
      false,
    );
    if (!hasModuleAction(permissions, false, 'RIGHTS', 'edit')) {
      throw new ForbiddenException('Only the company owner (or Rights editors) can manage permissions');
    }
  }

  async getForEmployee(actor: Actor, employeeId: number) {
    await this.assertCanManageRights(actor);

    const target = await this.prisma.manageEmployee.findFirst({
      where: {
        id: employeeId,
        companyID: actor.companyId,
        isDeleted: false,
      },
      select: {
        id: true,
        isCompanyOwner: true,
        ownerTitle: true,
        employeeFirstName: true,
        employeeLastName: true,
        employeeID: true,
      },
    });
    if (!target) throw new BadRequestException('Employee not found in this company');

    const permissions = target.isCompanyOwner
      ? await loadEmployeePermissions(this.prisma, target.id, actor.companyId, true)
      : await loadEmployeePermissions(this.prisma, target.id, actor.companyId, false);

    return {
      employee: {
        id: target.id,
        employeeCode: target.employeeID,
        name: `${target.employeeFirstName ?? ''} ${target.employeeLastName ?? ''}`.trim(),
        isCompanyOwner: !!target.isCompanyOwner,
        ownerTitle: target.ownerTitle,
      },
      permissions,
      readOnly: false,
    };
  }

  async saveForEmployee(
    actor: Actor,
    employeeId: number,
    permissions: ModulePermissionDto[],
  ) {
    await this.assertCanManageRights(actor);

    if (employeeId === actor.manageEmployeeId && actor.isCompanyOwner) {
      throw new BadRequestException('Owner permissions cannot be changed');
    }

    const target = await this.prisma.manageEmployee.findFirst({
      where: {
        id: employeeId,
        companyID: actor.companyId,
        isDeleted: false,
      },
      select: { id: true, isCompanyOwner: true },
    });
    if (!target) throw new BadRequestException('Employee not found in this company');

    const entitled = await entitledRightsKeys(this.prisma, actor.companyId);
    const allowed = entitled ?? new Set<string>(COMPANY_MODULE_KEYS);
    await this.prisma.$transaction(async (tx) => {
      for (const row of permissions) {
        if (!allowed.has(row.moduleKey)) continue;
        await tx.employeeModulePermission.upsert({
          where: {
            companyID_manageEmployeeID_moduleKey: {
              companyID: actor.companyId,
              manageEmployeeID: employeeId,
              moduleKey: row.moduleKey,
            },
          },
          create: {
            companyID: actor.companyId,
            manageEmployeeID: employeeId,
            moduleKey: row.moduleKey,
            canView: !!row.canView,
            canCreate: !!row.canCreate,
            canEdit: !!row.canEdit,
            canDelete: !!row.canDelete,
          },
          update: {
            canView: !!row.canView,
            canCreate: !!row.canCreate,
            canEdit: !!row.canEdit,
            canDelete: !!row.canDelete,
          },
        });
      }
    });

    return this.getForEmployee(actor, employeeId);
  }

  async listGrantableEmployees(actor: Actor) {
    await this.assertCanManageRights(actor);

    const rows = await this.prisma.manageEmployee.findMany({
      where: {
        companyID: actor.companyId,
        isDeleted: false,
        OR: [{ employmentStatus: null }, { employmentStatus: { not: 'Terminated' } }],
      },
      orderBy: [{ employeeFirstName: 'asc' }, { employeeLastName: 'asc' }],
      select: {
        id: true,
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        isCompanyOwner: true,
        ownerTitle: true,
      },
      take: 2000,
    });

    return rows.map((r) => ({
      id: r.id,
      employeeCode: r.employeeID,
      name: `${r.employeeFirstName ?? ''} ${r.employeeLastName ?? ''}`.trim() || 'Employee',
      isCompanyOwner: !!r.isCompanyOwner,
      ownerTitle: r.ownerTitle,
    }));
  }
}
