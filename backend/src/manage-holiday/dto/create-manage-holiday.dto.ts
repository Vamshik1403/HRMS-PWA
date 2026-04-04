import { IsOptional, IsString, IsInt } from 'class-validator';

export class CreateManageHolidayDto {
  @IsOptional() @IsInt() serviceProviderID?: number;
  @IsOptional() @IsInt() companyID?: number;
  @IsOptional() @IsInt() branchesID?: number;
  @IsOptional() @IsString() monthPeriod?: string;
  @IsOptional() @IsString() holidayName?: string;
}
