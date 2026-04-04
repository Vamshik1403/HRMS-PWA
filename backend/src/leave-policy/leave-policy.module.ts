import { Module } from '@nestjs/common';
import { LeavePolicyService } from './leave-policy.service';
import { LeavePolicyController } from './leave-policy.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LeavePolicyController],
  providers: [LeavePolicyService],
})
export class LeavePolicyModule {}
