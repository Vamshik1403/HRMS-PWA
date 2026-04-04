import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateRosterDto {
  @IsInt() @Min(1) serviceProviderID: number;
  @IsInt() @Min(1) companyID: number;
  @IsInt() @Min(1) branchesID: number;
  @IsInt() @Min(1) departmentID: number;

  @IsOptional()
  @IsInt()
  designationID?: number;

  @IsDateString() fromDate: string;
  @IsDateString() toDate: string;

  // optional override (if you want custom like "FEB-2026")
  @IsOptional()
  @IsString()
  rosterPeriod?: string;
}
