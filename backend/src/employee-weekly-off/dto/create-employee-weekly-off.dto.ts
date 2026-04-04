import { IsOptional, IsInt, IsDateString } from 'class-validator';

export class CreateEmployeeWeeklyOffDto {
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

  @IsDateString()
  date: string;
}
