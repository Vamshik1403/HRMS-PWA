import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalaryAllowanceDto {
  @IsOptional() @Type(() => Number) @IsInt()
  serviceProviderID?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  companyID?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  branchesID?: number;

  @IsOptional() @IsString() @MaxLength(255)
  salaryAllowanceName?: string;

  @IsOptional() @IsString()
  allowanceType?:string;

  @IsOptional() @IsString()
  basedOn?: string; 

  @IsOptional() @IsString() @MaxLength(100)
  salaryAllowanceType?: string; // e.g., "fixed" | "percentage" | etc.

  @IsOptional() @IsString() @MaxLength(100)
  salaryAllowanceValue?: string; // keep as string per schema

  @IsOptional() @IsString() @MaxLength(100)
  salaryAllowanceMonthLimit?: string; // keep as string per schema
}
