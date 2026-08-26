import { Module } from '@nestjs/common';
import { CompanyPolicyController } from './company-policy.controller';
import { CompanyPolicyService } from './company-policy.service';

@Module({
  controllers: [CompanyPolicyController],
  providers: [CompanyPolicyService],
})
export class CompanyPolicyModule {}
