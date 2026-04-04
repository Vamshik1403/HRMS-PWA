import { IsOptional, IsInt, IsNumber, IsDateString, IsString } from 'class-validator';

export class CreatePrivilegedLeaveDto {
  @IsOptional()
  @IsInt()
  serviceProviderID?: number;

  @IsOptional()
  @IsInt()
  companyID?: number;

  @IsOptional()
  @IsInt()
  branchesID?: number;

  @IsInt()
  employeeID: number;

  @IsInt()
  leavePolicyID: number;

  @IsOptional()
  @IsNumber()
  creditedLeaves?: number;

  @IsOptional()
  @IsNumber()
  usedLeaves?: number;

  @IsOptional()
  @IsNumber()
  balanceLeaves?: number;

  @IsDateString()
  creditDate: string;

  @IsOptional()
  @IsString()
  description?: string;
}
