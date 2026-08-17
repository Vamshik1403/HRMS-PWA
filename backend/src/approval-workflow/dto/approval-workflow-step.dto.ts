import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  ApprovalRequirement,
  WorkflowApproverType,
} from '@prisma/client';

export class ApprovalWorkflowStepDto {
  @IsInt()
  @IsPositive()
  stepNo: number;

  @IsEnum(WorkflowApproverType)
  approverType: WorkflowApproverType;

  @IsOptional()
  @IsInt()
  @IsPositive()
  designationID?: number;

  @IsEnum(ApprovalRequirement)
  approvalRequirement: ApprovalRequirement;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  stepName?: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsBoolean()
  canReject?: boolean;

  @IsOptional()
  @IsBoolean()
  canSendBack?: boolean;

  @IsOptional()
  @IsInt()
  @IsPositive()
  approvalTimeout?: number;
}