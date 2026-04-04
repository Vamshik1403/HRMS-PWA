import { IsOptional, IsInt, IsString, IsDateString } from "class-validator";

export class UpdatePublicHolidayDto {
  @IsOptional() @IsInt() serviceProviderID?: number;
  @IsOptional() @IsInt() companyID?: number;
  @IsOptional() @IsInt() branchesID?: number;
  @IsOptional() @IsInt() manageHolidayID?: number;
  
  @IsOptional() @IsString() financialYear?: string;
  @IsOptional() @IsDateString() startDate?: Date;
  @IsOptional() @IsDateString() endDate?: Date;
}