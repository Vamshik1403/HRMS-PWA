import { Module } from '@nestjs/common';
import { ESICComplianceService } from './esiccompliance.service';
import { ESICComplianceController } from './esiccompliance.controller';

@Module({
  controllers: [ESICComplianceController],
  providers: [ESICComplianceService],
})
export class ESICComplianceModule {}
