import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateSalaryAdvanceDto {
  @IsOptional() @IsInt()
  serviceProviderID?: number;

  @IsOptional() @IsInt()
  companyID?: number;

  @IsOptional() @IsInt()
  branchesID?: number;

  @IsOptional() @IsInt()
  manageEmployeeID?: number;

  @IsOptional() @IsString()
  previousAdvancesDue?: string;

  @IsOptional() @IsString()
  advanceAmount?: string;

  @IsOptional() @IsString()
  reason?: string;

  @IsOptional() @IsString()
  repaymentTanure?: string;

  @IsOptional() @IsString()
  status?: string;
}
