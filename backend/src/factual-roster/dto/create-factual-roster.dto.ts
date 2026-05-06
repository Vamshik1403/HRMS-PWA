import { IsInt, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateFactualRosterDto {
  @IsInt() serviceProviderID: number;
  @IsInt() companyID: number;
  @IsInt() branchesID: number;
  @IsInt() departmentID: number;
  @IsOptional() @IsInt() designationID?: number;
  @IsNotEmpty() @IsString() fromDate: string;
  @IsNotEmpty() @IsString() toDate: string;
  @IsOptional() @IsString() rosterPeriod?: string;
  @IsOptional() @IsInt() createdBy?: number;
}
