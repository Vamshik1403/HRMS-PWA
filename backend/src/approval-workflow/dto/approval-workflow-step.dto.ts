import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class ApprovalWorkflowStepDto {
  @IsInt()
  @Min(1)
  stepNo: number;

  /** DESIGNATION (default) or REPORTING_MANAGER */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  approverType?: string;

  @ValidateIf((o) => (o.approverType || 'DESIGNATION').toUpperCase() !== 'REPORTING_MANAGER')
  @IsInt()
  @Min(1)
  designationID?: number;

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

  /**
   * Approval timeout in hours.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  approvalTimeout?: number;
}
