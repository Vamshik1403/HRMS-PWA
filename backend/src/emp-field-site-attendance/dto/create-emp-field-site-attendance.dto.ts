import { Type } from 'class-transformer';
import { IsOptional, IsString, IsInt, IsDateString, IsDate } from 'class-validator';

export class CreateEmpFieldSiteAttendanceDto {
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
  @IsString()
  siteName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  latitude?: string;

  @IsOptional()
  @IsString()
  longitude?: string;

@IsOptional()
@Type(() => Date)
@IsDate()
fromDate?: Date;

@IsOptional()
@Type(() => Date)
@IsDate()
toDate?: Date;
}
