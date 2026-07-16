import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApprovalWorkflowStepDto } from './approval-workflow-step.dto';
import { WorkflowConditionMatchType } from '@prisma/client';
import { ApprovalWorkflowConditionDto } from './approval-workflow-condition.dto';

export class CreateApprovalWorkflowDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  serviceProviderID?: number;

  @IsInt()
  @Min(1)
  companyID: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  branchesID?: number;

  @IsInt()
  @Min(1)
  companyModuleID: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  workflowName: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  workflowDescription?: string;

  @IsDateString()
  effectiveFrom: string;

  @IsOptional()
  @IsBoolean()
  allowAnySameDesignation?: boolean;

  @IsOptional()
  @IsBoolean()
  workflowStatus?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  createdByUserID?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApprovalWorkflowStepDto)
  steps: ApprovalWorkflowStepDto[];

  @IsOptional()
@IsEnum(WorkflowConditionMatchType)
conditionMatchType?: WorkflowConditionMatchType;

@IsOptional()
@IsArray()
@ValidateNested({ each: true })
@Type(() => ApprovalWorkflowConditionDto)
conditions?: ApprovalWorkflowConditionDto[];
}