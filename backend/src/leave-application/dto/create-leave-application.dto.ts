import { IsInt, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateLeaveApplicationDto {
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
  manageEmployeeID?: number;

  @IsOptional()
  @IsInt()
  remainingSickLeave?: number;

  @IsOptional()
  @IsInt()
  remainingCasualLeave?: number;

  @IsOptional()
  @IsInt()
  remainingEarnedLeave?: number;

  @IsOptional()
  @IsString()
  appliedLeaveType?: string;

  @IsOptional()
  @IsString()
  childNumber?: string;

  @IsOptional()
  @IsString()
  birthEventDate?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: Date;

  @IsOptional()
  @IsDateString()
  toDate?: Date;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  revokedReason?: string;

  @IsOptional()
  dayStatuses?: string;

  @IsOptional()
  @IsString()
  revokedAt?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
