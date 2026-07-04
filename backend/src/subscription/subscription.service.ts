import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { CreateCompanySubscriptionDto } from './dto/create-company-subscription.dto';
import { UpdateCompanySubscriptionDto } from './dto/update-company-subscription.dto';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  private calculateEndDate(startDate: Date, validityDays: number) {
    const end = new Date(startDate);
    end.setDate(end.getDate() + validityDays - 1);
    end.setHours(23, 59, 59, 999);
    return end;
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

      return tx.subscriptionPlan.update({
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

    const startDate = new Date(dto.startDate);
    const endDate = this.calculateEndDate(startDate, plan.validityDays);

    await this.prisma.companySubscription.updateMany({
      where: {
        companyID: dto.companyID,
        status: SubscriptionStatus.ACTIVE,
      },
      data: {
        status: SubscriptionStatus.RENEWED,
        isActive: false,
      },
    });

    return this.prisma.companySubscription.create({
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

      const startDate = dto.startDate ? new Date(dto.startDate) : existing.startDate;
      endDate = this.calculateEndDate(startDate, plan.validityDays);
    }

    return this.prisma.companySubscription.update({
      where: { id },
      data: {
        ...(dto.planID !== undefined && { planID: dto.planID }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
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
        plan: true,
      },
    });
  }

  async deactivateSubscription(id: number, body: { deactivationWef: string; reason?: string }) {
    await this.findOneSubscription(id);

    return this.prisma.companySubscription.update({
      where: { id },
      data: {
        status: SubscriptionStatus.INACTIVE,
        isActive: false,
        deactivatedAt: new Date(),
        deactivationWef: new Date(body.deactivationWef),
        deactivationReason: body.reason,
      },
    });
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