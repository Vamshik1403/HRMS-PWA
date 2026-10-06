import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyModuleAccessService } from '../common/company-module-access.service';
import { endOfIstValidity, startOfIstDay } from '../common/product-modules';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { CreateCompanySubscriptionDto } from './dto/create-company-subscription.dto';
import { UpdateCompanySubscriptionDto } from './dto/update-company-subscription.dto';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleAccess: CompanyModuleAccessService,
  ) {}

  private calculateEndDate(startDate: Date, validityDays: number) {
    return endOfIstValidity(startDate, validityDays);
  }

  async createPlan(dto: CreateSubscriptionDto) {
    return this.prisma.$transaction(async (tx) => {
      const modules = await tx.module.findMany({
        where: { id: { in: dto.moduleIDs } },
        select: { id: true },
      });

      if (modules.length !== dto.moduleIDs.length) {
        throw new BadRequestException('One or more selected modules are invalid');
      }

      return tx.subscriptionPlan.create({
        data: {
          planName: dto.planName.trim(),
          validityDays: dto.validityDays,
          planAmount: new Prisma.Decimal(dto.planAmount),
          isActive: dto.isActive ?? true,
          assignedModules: {
            create: dto.moduleIDs.map((moduleID) => ({ moduleID })),
          },
        },
        include: {
          assignedModules: { include: { module: true } },
        },
      });
    });
  }

  async findAllPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { id: 'desc' },
      include: {
        assignedModules: { include: { module: true } },
        _count: { select: { subscriptions: true } },
      },
    });
  }

  async findOnePlan(id: number) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        assignedModules: { include: { module: true } },
        subscriptions: { include: { company: true } },
      },
    });

    if (!plan) throw new NotFoundException('Subscription plan not found');
    return plan;
  }

  async updatePlan(id: number, dto: UpdateSubscriptionDto) {
    await this.findOnePlan(id);

    return this.prisma.$transaction(async (tx) => {
      if (dto.moduleIDs) {
        const modules = await tx.module.findMany({
          where: { id: { in: dto.moduleIDs } },
          select: { id: true },
        });

        if (modules.length !== dto.moduleIDs.length) {
          throw new BadRequestException('One or more selected modules are invalid');
        }

        await tx.subscriptionPlanModule.deleteMany({ where: { planID: id } });
      }

      const updated = await tx.subscriptionPlan.update({
        where: { id },
        data: {
          ...(dto.planName !== undefined && { planName: dto.planName.trim() }),
          ...(dto.validityDays !== undefined && { validityDays: dto.validityDays }),
          ...(dto.planAmount !== undefined && { planAmount: new Prisma.Decimal(dto.planAmount) }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.moduleIDs && {
            assignedModules: {
              create: dto.moduleIDs.map((moduleID) => ({ moduleID })),
            },
          }),
        },
        include: {
          assignedModules: { include: { module: true } },
        },
      });

      if (dto.moduleIDs) {
        const companies = await tx.companySubscription.findMany({
          where: { planID: id, status: SubscriptionStatus.ACTIVE, isActive: true },
          select: { companyID: true },
        });
        const seen = new Set<number>();
        for (const row of companies) {
          if (seen.has(row.companyID)) continue;
          seen.add(row.companyID);
          await this.moduleAccess.syncCompanyModules(row.companyID, dto.moduleIDs, tx);
        }
      }

      return updated;
    });
  }

  async removePlan(id: number) {
    const linked = await this.prisma.companySubscription.count({
      where: { planID: id },
    });

    if (linked > 0) {
      throw new BadRequestException('Plan already assigned. Deactivate it instead of deleting.');
    }

    return this.prisma.subscriptionPlan.delete({ where: { id } });
  }

  async assignPlan(dto: CreateCompanySubscriptionDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyID },
    });

    if (!company) throw new NotFoundException('Company not found');

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planID },
    });

    if (!plan || !plan.isActive) {
      throw new BadRequestException('Invalid or inactive plan');
    }

    const startDate = startOfIstDay(new Date(dto.startDate));
    const endDate = this.calculateEndDate(startDate, plan.validityDays);

    return this.prisma.$transaction(async (tx) => {
      const fullPlan = await tx.subscriptionPlan.findUnique({
        where: { id: dto.planID },
        include: { assignedModules: true },
      });
      if (!fullPlan || !fullPlan.isActive) {
        throw new BadRequestException('Invalid or inactive plan');
      }

      await tx.companySubscription.updateMany({
        where: {
          companyID: dto.companyID,
          status: SubscriptionStatus.ACTIVE,
        },
        data: {
          status: SubscriptionStatus.RENEWED,
          isActive: false,
        },
      });

      const created = await tx.companySubscription.create({
        data: {
          companyID: dto.companyID,
          planID: dto.planID,
          startDate,
          endDate,
          status: SubscriptionStatus.ACTIVE,
          isActive: true,
          renewedFromID: dto.renewedFromID,
        },
        include: {
          company: true,
          plan: { include: { assignedModules: { include: { module: true } } } },
        },
      });

      await this.moduleAccess.syncCompanyModules(
        dto.companyID,
        fullPlan.assignedModules.map((row) => row.moduleID),
        tx,
      );
      return created;
    });
  }

  async findAllSubscriptions() {
    await this.autoExpireSubscriptions();

    return this.prisma.companySubscription.findMany({
      orderBy: { id: 'desc' },
      include: {
        company: true,
        plan: { include: { assignedModules: { include: { module: true } } } },
      },
    });
  }

  async findOneSubscription(id: number) {
    const subscription = await this.prisma.companySubscription.findUnique({
      where: { id },
      include: {
        company: true,
        plan: { include: { assignedModules: { include: { module: true } } } },
        renewals: true,
        renewedFrom: true,
      },
    });

    if (!subscription) throw new NotFoundException('Subscription not found');
    return subscription;
  }

  async updateSubscription(id: number, dto: UpdateCompanySubscriptionDto) {
    const existing = await this.findOneSubscription(id);

    let endDate = existing.endDate;

    if (dto.planID || dto.startDate) {
      const planID = dto.planID ?? existing.planID;
      const plan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: planID },
      });

      if (!plan) throw new NotFoundException('Plan not found');

      const startDate = dto.startDate ? startOfIstDay(new Date(dto.startDate)) : existing.startDate;
      endDate = this.calculateEndDate(startDate, plan.validityDays);
    }

    const updated = await this.prisma.companySubscription.update({
      where: { id },
      data: {
        ...(dto.planID !== undefined && { planID: dto.planID }),
        ...(dto.startDate !== undefined && { startDate: startOfIstDay(new Date(dto.startDate)) }),
        endDate,
        ...(dto.status !== undefined && {
          status: dto.status,
          isActive: dto.status === SubscriptionStatus.ACTIVE,
        }),
        ...(dto.deactivationWef !== undefined && {
          deactivationWef: new Date(dto.deactivationWef),
          deactivatedAt: new Date(),
          status: SubscriptionStatus.INACTIVE,
          isActive: false,
        }),
        ...(dto.deactivationReason !== undefined && {
          deactivationReason: dto.deactivationReason,
        }),
      },
      include: {
        company: true,
        plan: { include: { assignedModules: true } },
      },
    });

    if (dto.planID) {
      const moduleIds = (updated.plan?.assignedModules || []).map((row) => row.moduleID);
      await this.moduleAccess.syncCompanyModules(updated.companyID, moduleIds);
    } else {
      this.moduleAccess.invalidate(updated.companyID);
    }
    return updated;
  }

  async deactivateSubscription(id: number, body: { deactivationWef: string; reason?: string }) {
    await this.findOneSubscription(id);

    const updated = await this.prisma.companySubscription.update({
      where: { id },
      data: {
        status: SubscriptionStatus.INACTIVE,
        isActive: false,
        deactivatedAt: new Date(),
        deactivationWef: new Date(body.deactivationWef),
        deactivationReason: body.reason,
      },
    });
    this.moduleAccess.invalidate(updated.companyID);
    return updated;
  }

  async renewSubscription(id: number, dto: CreateCompanySubscriptionDto) {
    const old = await this.findOneSubscription(id);

    return this.assignPlan({
      companyID: old.companyID,
      planID: dto.planID,
      startDate: dto.startDate,
      renewedFromID: id,
    });
  }

  /**
   * Returns true if the company has at least one subscription assigned and its
   * most recent subscription has expired (past endDate). Companies with no
   * subscription assigned at all are treated as not-expired (unrestricted),
   * since subscription enforcement only applies once a plan has been assigned.
   */
  async isCompanySubscriptionExpired(companyID: number): Promise<boolean> {
    if (!companyID) return false;

    const latest = await this.prisma.companySubscription.findFirst({
      where: { companyID },
      orderBy: { endDate: 'desc' },
    });

    if (!latest) return false;

    if (latest.status === SubscriptionStatus.EXPIRED || latest.status === SubscriptionStatus.CANCELLED) {
      return true;
    }

    return new Date(latest.endDate).getTime() < Date.now();
  }

  async autoExpireSubscriptions() {
    const now = new Date();

    await this.prisma.companySubscription.updateMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: { lt: now },
      },
      data: {
        status: SubscriptionStatus.EXPIRED,
        isActive: false,
      },
    });
  }
}