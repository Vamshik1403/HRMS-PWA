import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ApprovalWorkflowController } from './approval-workflow.controller';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { ApprovalEngineService } from './approval-engine.service';

@Module({
  imports: [PrismaModule],
  controllers: [ApprovalWorkflowController],
  providers: [ApprovalWorkflowService,ApprovalEngineService],
  exports: [ApprovalWorkflowService,ApprovalEngineService],
})
export class ApprovalWorkflowModule {}