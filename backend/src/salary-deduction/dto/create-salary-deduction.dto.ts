import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalaryDeductionDto {
  @IsOptional() @Type(() => Number) @IsInt()
  serviceProviderID?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  companyID?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  branchesID?: number;

  @IsOptional() @IsString() @MaxLength(255)
  salaryDeductionName?: string;

  @IsOptional() @IsString() @MaxLength(255)
  displayName?: string;

  @IsOptional() @IsString() @MaxLength(255)
  deductionTypeField?: string;

  @IsOptional() @IsString()
  basedOn?: string;

  @IsOptional() @IsString() @MaxLength(100)
  salaryDeductionType?: string; // e.g., "Fixed" | "Percentage"

  @IsOptional() @IsString() @MaxLength(100)
  salaryDeductionValue?: string; // keep as string per schema

  @IsOptional() @IsString() @MaxLength(100)
  salaryDeductionMonthLimit?: string; // keep as string per schema
}
