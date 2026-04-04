import { IsOptional, IsString, IsInt } from 'class-validator';

export class CreateDepartmentsDto {
  @IsOptional()
  @IsInt()
  serviceProviderID?: number;

  @IsOptional()
  @IsInt()
  companyID?: number;

  @IsOptional()
  @IsInt()
  branchesID?: number;

  @IsOptional()
  @IsString()
  departmentName?: string;
}
