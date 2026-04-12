import { IsInt, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateEmployeeMemoDto {
  @IsOptional() @IsInt() serviceProviderID?: number;
  @IsOptional() @IsInt() companyID?: number;
  @IsOptional() @IsInt() branchesID?: number;
  @IsInt() employeeID: number;
  @IsOptional() @IsString() memoType?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() issuedDate?: string;
  @IsOptional() @IsString() issuedBy?: string;
}
