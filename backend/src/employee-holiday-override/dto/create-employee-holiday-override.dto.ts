import { IsOptional, IsInt, IsDateString, IsString } from 'class-validator';

export class CreateEmployeeHolidayOverrideDto {
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
  holidayId: number;

  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
