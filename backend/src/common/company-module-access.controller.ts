import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyModuleAccessService } from './company-module-access.service';
import { isPrivilegedSubscriptionRole } from './product-modules';

@Controller('company-access')
@UseGuards(AuthGuard('jwt'))
export class CompanyModuleAccessController {
  constructor(private readonly access: CompanyModuleAccessService) {}

  @Get('me')
  async me(@Req() req: { user?: { companyID?: number; role?: string } }) {
    const role = req.user?.role;
    const companyId = Number(req.user?.companyID) || null;
    if (isPrivilegedSubscriptionRole(role)) {
      return {
        companyId,
        subscriptionRequired: false,
        subscriptionStatus: null,
        subscriptionValidFrom: null,
        subscriptionValidTo: null,
        isSubscriptionExempt: false,
        modules: [],
      };
    }
    const decision = await this.access.evaluate(companyId);
    return {
      companyId: decision.companyId,
      subscriptionRequired: decision.subscriptionRequired,
      subscriptionStatus: decision.subscriptionStatus,
      subscriptionValidFrom: decision.subscriptionValidFrom,
      subscriptionValidTo: decision.subscriptionValidTo,
      isSubscriptionExempt: decision.isSubscriptionExempt,
      modules: decision.modules,
    };
  }
}
