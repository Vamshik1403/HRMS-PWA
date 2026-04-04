import { IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class FindSalaryCycleQueryDto {
  @IsOptional() @Type(() => Number) @IsInt()
  serviceProviderID?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  companyID?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  branchesID?: number;

  // optional: return only the most recent matching row
  @IsOptional()
  latest?: '1' | 'true';
}
