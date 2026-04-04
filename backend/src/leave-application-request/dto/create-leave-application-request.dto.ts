import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateLeaveApplicationRequestDto {
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
  @IsInt()
  leaveApplicationID?: number;

  @IsOptional()
  @IsString()
  leaveApplicationStatus?: string;
}
