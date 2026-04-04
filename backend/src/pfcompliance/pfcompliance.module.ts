import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PFComplianceController } from './pfcompliance.controller';
import { PFComplianceService } from './pfcompliance.service';


@Module({
  controllers: [PFComplianceController],
  providers: [PFComplianceService, PrismaService],
})
export class PfcomplianceModule {}
