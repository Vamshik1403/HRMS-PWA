import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreatePFComplianceDto {

  @Type(() => Number)
  @IsInt()
  companyID: number;

  @IsOptional() @Type(() => Number) @IsInt()
  epfThresholdCount?: number;

  @IsOptional() @IsBoolean()
  epfApplicable?: boolean;

  @IsOptional() @IsBoolean()
  voluntaryEnabled?: boolean;

  @IsOptional() @Type(() => Number) @IsInt()
  wageCeiling?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  basicValidationPercent?: number;

  @IsOptional() @IsBoolean()
  compulsoryForAll?: boolean;

  // Rates
  @IsOptional() @Type(() => Number) @IsNumber()
  employeeRate?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  employerRate?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  epsRate?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  edliRate?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  adminChargeRate?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  edliMax?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  adminChargeMax?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  dueDate?: number;
}
