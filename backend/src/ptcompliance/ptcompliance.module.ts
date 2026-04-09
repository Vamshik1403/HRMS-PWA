import { Module } from '@nestjs/common';

import { PTComplianceController } from './ptcompliance.controller';
import { PTComplianceService } from './ptcompliance.service';

@Module({
  controllers: [PTComplianceController],
  providers: [PTComplianceService],
  exports: [PTComplianceService],
})
export class PTComplianceModule {}