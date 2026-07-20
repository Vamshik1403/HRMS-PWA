import {
  Module,
} from '@nestjs/common';

import { ApprovalRequestController } from './approval-request.controller';
import { ApprovalRequestService } from './approval-request.service';

@Module({
  controllers: [
    ApprovalRequestController,
  ],

  providers: [
    ApprovalRequestService,
  ],

  exports: [
    ApprovalRequestService,
  ],
})
export class ApprovalRequestModule {}