import { IsBoolean } from 'class-validator';

export class UpdateWorkflowStatusDto {
  @IsBoolean()
  workflowStatus: boolean;
}