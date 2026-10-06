import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { hasModuleAction } from './company-module-permissions';
import { loadEmployeePermissions } from './employee-permission.util';
import {
  ALL_PRODUCT_MODULE_KEYS,
  isPrivilegedSubscriptionRole,
  isSubscriptionExemptCompany,
  productModulesForRequest,
  rightsKeysForProductModule,
} from './product-modules';

const CACHE_MS = 15_000;

export type SubscriptionDecision = {
  ok: boolean;
  code: 'OK' | 'NO_ACTIVE_SUBSCRIPTION' | 'SUBSCRIPTION_EXPIRED';
  companyId: number | null;
  subscriptionRequired: boolean;
  isSubscriptionExempt: boolean;
  subscriptionStatus: string | null;
  subscriptionValidFrom: string | null;
  subscriptionValidTo: string | null;
  modules: string[];
};

type LatestSubscription = {
  status: SubscriptionStatus;
  isActive: boolean;
  startDate: Date;
  endDate: Date;
  plan?: {
    assignedModules?: { module?: { moduleKey?: string | null } | null }[];
  } | null;
};

@Injectable()
export class CompanyModuleAccessService {
  private readonly cache = new Map<number, { at: number; decision: SubscriptionDecision }>();

  constructor(private readonly prisma: PrismaService) {}

  invalidate(companyId?: number | null) {
    if (!companyId) {
      this.cache.clear();
      return;
    }
    this.cache.delete(companyId);
  }

  async evaluate(companyId?: number | null): Promise<SubscriptionDecision> {
    if (!companyId) {
      return this.openDecision(null, false);
    }
    if (isSubscriptionExemptCompany(companyId)) {
      return {
        ok: true,
        code: 'OK',
        companyId,
        subscriptionRequired: false,
        isSubscriptionExempt: true,
        subscriptionStatus: 'EXEMPT',
        subscriptionValidFrom: null,
        subscriptionValidTo: null,
        modules: [...ALL_PRODUCT_MODULE_KEYS],
      };
    }

    const hit = this.cache.get(companyId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.decision;

    const latest = await this.prisma.companySubscription.findFirst({
      where: { companyID: companyId },
      orderBy: { endDate: 'desc' },
      include: {
        plan: { include: { assignedModules: { include: { module: true } } } },
      },
    });
    const decision = this.decide(companyId, latest);
    this.cache.set(companyId, { at: Date.now(), decision });
    return decision;
  }

  async assertLoginAllowed(companyId?: number | null, role?: string | null) {
    if (isPrivilegedSubscriptionRole(role)) return;
    const decision = await this.evaluate(companyId);
    if (!decision.ok) throw new ForbiddenException(decision.code);
  }

  async assertSessionAllowed(companyId?: number | null, role?: string | null) {
    if (isPrivilegedSubscriptionRole(role)) return;
    const decision = await this.evaluate(companyId);
    if (!decision.ok) throw new UnauthorizedException(decision.code);
  }

  async requireCompanyModule(companyId: number | null | undefined, moduleKeys: string[]) {
    const decision = await this.evaluate(companyId);
    if (!decision.ok) throw new ForbiddenException(decision.code);
    if (!decision.subscriptionRequired || decision.isSubscriptionExempt) return decision;
    if (moduleKeys.some((key) => decision.modules.includes(key))) return decision;
    throw new ForbiddenException('MODULE_NOT_SUBSCRIBED');
  }

  async assertRequestAllowed(user: any, url: string, method: string) {
    if (!user) return;
    const role = user.role as string | undefined;
    if (isPrivilegedSubscriptionRole(role)) return;
    const companyId = Number(user.companyID) || null;
    const required = productModulesForRequest(url, method);
    if (!required) {
      await this.assertSessionAllowed(companyId, role);
      return;
    }
    const decision = await this.requireCompanyModule(companyId, required);
    await this.assertEmployeeRights(user, required, decision);
  }

  async syncCompanyModules(
    companyId: number,
    enabledModuleIds: number[],
    db: Pick<PrismaService, 'module' | 'companyModule'> | any = this.prisma,
  ) {
    if (isSubscriptionExemptCompany(companyId)) return;
    const all = await db.module.findMany({ select: { id: true } });
    const enabled = new Set(enabledModuleIds.map((id) => Number(id)));
    for (const moduleRow of all) {
      await db.companyModule.upsert({
        where: { companyID_moduleID: { companyID: companyId, moduleID: moduleRow.id } },
        update: { isEnabled: enabled.has(moduleRow.id) },
        create: {
          companyID: companyId,
          moduleID: moduleRow.id,
          isEnabled: enabled.has(moduleRow.id),
        },
      });
    }
    this.invalidate(companyId);
  }

  private openDecision(companyId: number | null, exempt: boolean): SubscriptionDecision {
    return {
      ok: true,
      code: 'OK',
      companyId,
      subscriptionRequired: false,
      isSubscriptionExempt: exempt,
      subscriptionStatus: exempt ? 'EXEMPT' : null,
      subscriptionValidFrom: null,
      subscriptionValidTo: null,
      modules: exempt ? [...ALL_PRODUCT_MODULE_KEYS] : [],
    };
  }

  private decide(companyId: number, latest: LatestSubscription | null): SubscriptionDecision {
    if (!latest) {
      return {
        ok: false,
        code: 'NO_ACTIVE_SUBSCRIPTION',
        companyId,
        subscriptionRequired: true,
        isSubscriptionExempt: false,
        subscriptionStatus: null,
        subscriptionValidFrom: null,
        subscriptionValidTo: null,
        modules: [],
      };
    }

    const now = Date.now();
    const start = new Date(latest.startDate).getTime();
    const end = new Date(latest.endDate).getTime();
    const expired =
      latest.status === SubscriptionStatus.EXPIRED ||
      latest.status === SubscriptionStatus.CANCELLED ||
      end < now;
    const modules = (latest.plan?.assignedModules || [])
      .map((row) => row.module?.moduleKey)
      .filter((key): key is string => !!key);

    const base = {
      companyId,
      subscriptionRequired: true,
      isSubscriptionExempt: false,
      subscriptionStatus: latest.status,
      subscriptionValidFrom: new Date(latest.startDate).toISOString(),
      subscriptionValidTo: new Date(latest.endDate).toISOString(),
      modules,
    };

    if (expired) return { ...base, ok: false, code: 'SUBSCRIPTION_EXPIRED' };
    if (!latest.isActive || latest.status !== SubscriptionStatus.ACTIVE || start > now) {
      return { ...base, ok: false, code: 'NO_ACTIVE_SUBSCRIPTION', modules: [] };
    }
    return { ...base, ok: true, code: 'OK' };
  }

  private async assertEmployeeRights(user: any, moduleKeys: string[], decision: SubscriptionDecision) {
    if (decision.isSubscriptionExempt || !decision.subscriptionRequired) return;
    if (user?.type !== 'employee') return;
    if (user?.isCompanyOwner) return;

    const employeeId = Number(user.employeeId || user.sub);
    const companyId = Number(user.companyID);
    if (!employeeId || !companyId) return;

    const emp = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: { isCompanyOwner: true },
    });
    if (emp?.isCompanyOwner) return;

    const rowCount = await this.prisma.employeeModulePermission.count({
      where: { manageEmployeeID: employeeId, companyID: companyId },
    });
    if (rowCount === 0) return;

    const rights = [...new Set(moduleKeys.flatMap((key) => rightsKeysForProductModule(key)))];
    if (rights.length === 0) return;

    const permissions = await loadEmployeePermissions(this.prisma, employeeId, companyId, false);
    const allowed = rights.some((key) => hasModuleAction(permissions, false, key, 'view'));
    if (!allowed) throw new ForbiddenException('MODULE_ACCESS_DENIED');
  }
}
