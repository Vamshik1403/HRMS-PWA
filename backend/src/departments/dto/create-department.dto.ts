import { IsOptional, IsString, IsInt, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDepartmentsDto {
  @IsOptional()
  @IsInt()
  serviceProviderID?: number;

  @IsOptional()
  @IsInt()
  companyID?: number;

  /** Legacy single-branch field (kept for compatibility). Prefer branchIDs. */
  @IsOptional()
  @IsInt()
  branchesID?: number;

  @IsOptional()
  @IsInt()
  parentDepartmentID?: number | null;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  branchIDs?: number[];

  @IsOptional()
  @IsString()
  departmentName?: string;
}
