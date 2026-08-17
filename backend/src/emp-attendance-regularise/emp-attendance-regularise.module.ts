import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { ApprovalWorkflowModule } from '../approval-workflow/approval-workflow.module';

import { EmpAttendanceRegulariseController } from './emp-attendance-regularise.controller';
import { EmpAttendanceRegulariseService } from './emp-attendance-regularise.service';

@Module({
  imports: [
    PrismaModule,

    /*
     * Gives this module access to ApprovalEngineService.
     */
    ApprovalWorkflowModule,
  ],

  controllers: [
    EmpAttendanceRegulariseController,
  ],

  providers: [
    EmpAttendanceRegulariseService,
  ],

  exports: [
    EmpAttendanceRegulariseService,
  ],
})
export class EmpAttendanceRegulariseModule {}