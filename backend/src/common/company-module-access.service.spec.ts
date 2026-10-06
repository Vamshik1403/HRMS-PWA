import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { CompanyModuleAccessService } from './company-module-access.service';
import { ALL_PRODUCT_MODULE_KEYS, PAYROLL_MODULE, PAYSLIP_MODULE } from './product-modules';

function serviceWith(latest: unknown) {
  const prisma = {
    companySubscription: {
      findFirst: jest.fn().mockResolvedValue(latest),
    },
    manageEmployee: { findUnique: jest.fn().mockResolvedValue({ isCompanyOwner: false }) },
    employeeModulePermission: { count: jest.fn().mockResolvedValue(1) },
  };
  return { svc: new CompanyModuleAccessService(prisma as any), prisma };
}

describe('CompanyModuleAccessService', () => {
  it('blocks a company with no subscription', async () => {
    const { svc } = serviceWith(null);
    await expect(svc.assertLoginAllowed(9, 'COMPANY_ADMIN')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.assertLoginAllowed(9, 'EMPLOYEE')).rejects.toMatchObject({
      message: 'NO_ACTIVE_SUBSCRIPTION',
    });
  });

  it('allows an active plan and does not treat payroll as payslip', async () => {
    const { svc } = serviceWith({
      status: SubscriptionStatus.ACTIVE,
      isActive: true,
      startDate: new Date('2020-01-01T00:00:00.000Z'),
      endDate: new Date('2099-01-01T00:00:00.000Z'),
      plan: { assignedModules: [{ module: { moduleKey: PAYSLIP_MODULE } }] },
    });
    const decision = await svc.evaluate(9);
    expect(decision.ok).toBe(true);
    expect(decision.modules).toEqual([PAYSLIP_MODULE]);
    expect(decision.modules).not.toContain(PAYROLL_MODULE);
    await expect(svc.requireCompanyModule(9, [PAYROLL_MODULE])).rejects.toMatchObject({
      message: 'MODULE_NOT_SUBSCRIBED',
    });
  });

  it('blocks an expired subscription on login and on the session', async () => {
    const { svc } = serviceWith({
      status: SubscriptionStatus.EXPIRED,
      isActive: false,
      startDate: new Date('2020-01-01T00:00:00.000Z'),
      endDate: new Date('2020-01-10T00:00:00.000Z'),
      plan: { assignedModules: [{ module: { moduleKey: 'ATTENDANCE_MODULE' } }] },
    });
    await expect(svc.assertLoginAllowed(9, 'EMPLOYEE')).rejects.toMatchObject({
      message: 'SUBSCRIPTION_EXPIRED',
    });
    await expect(svc.assertSessionAllowed(9, 'EMPLOYEE')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows exempt companies 2 and 3 with every product module and no subscription row', async () => {
    const findFirst = jest.fn();
    const svc = new CompanyModuleAccessService({ companySubscription: { findFirst } } as any);
    for (const companyId of [2, 3]) {
      const decision = await svc.evaluate(companyId);
      expect(decision.ok).toBe(true);
      expect(decision.isSubscriptionExempt).toBe(true);
      expect(decision.subscriptionRequired).toBe(false);
      expect(decision.modules).toEqual(ALL_PRODUCT_MODULE_KEYS);
    }
    expect(findFirst).not.toHaveBeenCalled();
    await expect(svc.assertLoginAllowed(2, 'EMPLOYEE')).resolves.toBeUndefined();
  });

  it('does not apply the subscription check to superadmin', async () => {
    const findFirst = jest.fn();
    const svc = new CompanyModuleAccessService({ companySubscription: { findFirst } } as any);
    await expect(svc.assertLoginAllowed(9, 'SUPERADMIN')).resolves.toBeUndefined();
    await expect(svc.assertSessionAllowed(null, 'SERVICE_PROVIDER')).resolves.toBeUndefined();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('denies an employee rights row that does not include the module', async () => {
    const prisma = {
      companySubscription: {
        findFirst: jest.fn().mockResolvedValue({
          status: SubscriptionStatus.ACTIVE,
          isActive: true,
          startDate: new Date('2020-01-01T00:00:00.000Z'),
          endDate: new Date('2099-01-01T00:00:00.000Z'),
          plan: { assignedModules: [{ module: { moduleKey: 'IM_MODULE' } }] },
        }),
      },
      manageEmployee: { findUnique: jest.fn().mockResolvedValue({ isCompanyOwner: false }) },
      employeeModulePermission: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          { moduleKey: 'MESSAGING', canView: false, canCreate: false, canEdit: false, canDelete: false },
        ]),
      },
    };
    const svc = new CompanyModuleAccessService(prisma as any);
    await expect(
      svc.assertRequestAllowed(
        { type: 'employee', role: 'EMPLOYEE', companyID: 9, employeeId: 4, isCompanyOwner: false },
        '/employee-memo',
        'GET',
      ),
    ).rejects.toMatchObject({ message: 'MODULE_ACCESS_DENIED' });
  });
});
