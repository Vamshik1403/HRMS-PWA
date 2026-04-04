import { IsOptional, IsString, IsInt } from 'class-validator';

export class CreateBankDetailsDto {
  // relation IDs (used for connect). Provide any that apply.
  @IsOptional() @IsInt() serviceProviderID?: number;
  @IsOptional() @IsInt() companyID?: number;
  @IsOptional() @IsInt() branchesID?: number;

  // scalar columns
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankBranchName?: string;
  @IsOptional() @IsString() accountNo?: string;
  @IsOptional() @IsString() ifscCode?: string;
}
