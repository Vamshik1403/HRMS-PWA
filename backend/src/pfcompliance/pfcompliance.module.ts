import { Module } from '@nestjs/common';
import { PFComplianceController } from './pfcompliance.controller';
import { PFComplianceService } from './pfcompliance.service';


@Module({
  controllers: [PFComplianceController],
  providers: [PFComplianceService],
})
export class PfcomplianceModule {}
