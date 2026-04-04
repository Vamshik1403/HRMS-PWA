import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateHourlyPayGradeDto {
  @IsOptional() @Type(() => Number) @IsInt()
  serviceProviderID?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  companyID?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  branchesID?: number;

  @IsOptional() @IsString() @MaxLength(255)
  hourlyPayGradeName?: string;

  // Stored as String? in schema
  @IsOptional() @IsString() @MaxLength(100)
  hourlyRate?: string;
}
