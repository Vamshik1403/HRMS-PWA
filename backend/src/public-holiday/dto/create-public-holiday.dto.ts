import { IsOptional, IsString, IsInt, IsDateString } from 'class-validator';

export class CreatePublicHolidayDto {
  @IsOptional() @IsInt() serviceProviderID?: number;
  @IsOptional() @IsInt() companyID?: number;
  @IsOptional() @IsInt() branchesID?: number;
  @IsOptional() @IsInt() manageHolidayID?: number;

  @IsOptional() @IsString() financialYear?: string;
  @IsOptional() @IsDateString() startDate?: Date;
  @IsOptional() @IsDateString() endDate?: Date;
}
