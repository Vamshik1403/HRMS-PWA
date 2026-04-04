import { Module } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { PTComplianceController } from './ptcompliance.controller';
import { PTComplianceService } from './ptcompliance.service';

@Module({
  controllers: [PTComplianceController],
  providers: [PTComplianceService, PrismaService],
  exports: [PTComplianceService],
})
export class PTComplianceModule {}