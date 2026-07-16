import { PartialType } from '@nestjs/mapped-types';
import { CreateApprovalWorkflowDto } from './create-approval-workflow.dto';

export class UpdateApprovalWorkflowDto extends PartialType(
  CreateApprovalWorkflowDto,
) {}