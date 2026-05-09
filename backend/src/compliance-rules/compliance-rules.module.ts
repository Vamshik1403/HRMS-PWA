import { Module } from '@nestjs/common';
import { ComplianceRulesController } from './compliance-rules.controller';
import { ComplianceRulesService } from './compliance-rules.service';

@Module({
  controllers: [ComplianceRulesController],
  providers: [ComplianceRulesService],
})
export class ComplianceRulesModule {}
