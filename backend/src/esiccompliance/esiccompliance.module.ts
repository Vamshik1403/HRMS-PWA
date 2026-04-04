import { Module } from '@nestjs/common';
import { ESICComplianceService } from './esiccompliance.service';
import { ESICComplianceController } from './esiccompliance.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ESICComplianceController],
  providers: [ESICComplianceService,PrismaService],
})
export class ESICComplianceModule {}
