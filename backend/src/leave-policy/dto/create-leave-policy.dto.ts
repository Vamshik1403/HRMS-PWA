import { IsOptional, IsString, IsInt, IsArray, IsBoolean, IsDateString } from 'class-validator';

export class CreateLeavePolicyDto {
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
  leavePolicyName?: string;

  @IsOptional()
  @IsString()
  sickLeaveCount?: string;

  @IsOptional()
  @IsString()
  casualLeaveCount?: string;

  @IsOptional()
  @IsString()
  maternityLeaveCount?: string;

  @IsOptional()
  @IsString()
  paternityLeaveCount?: string;

  @IsOptional()
  @IsString()
  earnLeaveWorkingMonths?: string;

  @IsOptional()
  @IsInt()
  earnLeaveCount?: number;

  @IsOptional()
  @IsBoolean()
  isPrivilegedLeaveApplicable?: boolean;

  @IsOptional()
  @IsString()
  privilegedLeaveRatio?: string;

  @IsOptional()
  @IsBoolean()
  weekOffConsideredInPL?: boolean;

  @IsOptional()
  @IsBoolean()
  holidayConsideredInPL?: boolean;

  @IsOptional()
  @IsBoolean()
  paidLeaveConsideredInPL?: boolean;

  @IsOptional()
  @IsInt()
  plCarryForwardLimit?: number;

  @IsOptional()
  @IsDateString()
  lapseEncashmentDate?: string;

  // ManageHoliday IDs selected in the UI; used to link via PublicHoliday
  @IsOptional()
  @IsArray()
  applicableHolidayIds?: number[];
}
