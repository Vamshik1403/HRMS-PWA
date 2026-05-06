import { Module } from '@nestjs/common';
import { FactualAttendancePolicyService } from './factual-attendance-policy.service';
import { FactualAttendancePolicyController } from './factual-attendance-policy.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FactualAttendancePolicyController],
  providers: [FactualAttendancePolicyService],
})
export class FactualAttendancePolicyModule {}
