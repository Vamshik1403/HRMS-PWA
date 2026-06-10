import { IsInt, IsOptional, IsString, IsDateString, IsArray } from 'class-validator';

export class CreateEmployeeMemoDto {
  @IsOptional() @IsInt() serviceProviderID?: number;
  @IsOptional() @IsInt() companyID?: number;
  @IsOptional() @IsInt() branchesID?: number;
  @IsOptional() @IsInt() employeeID?: number;
  @IsOptional() @IsArray() @IsInt({ each: true }) employeeIDs?: number[];
  @IsOptional() @IsString() memoType?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() issuedDate?: string;
  @IsOptional() @IsString() issuedBy?: string;
  /** SUPERADMIN, COMPANY_ADMIN, MANAGER, etc. — used for push notification sender label. */
  @IsOptional() @IsString() issuedByRole?: string;
  @IsOptional() @IsInt() senderEmployeeId?: number;
  @IsOptional() @IsString() attachmentPath?: string;
}
