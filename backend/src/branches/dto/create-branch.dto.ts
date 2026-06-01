import { IsOptional, IsString, IsEmail, IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BankDetailCreateDto {
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankBranchName?: string; // UI "branchName"
  @IsOptional() @IsString() accountNo?: string;
  @IsOptional() @IsString() ifscCode?: string;
}

export class CreateBranchesDto {
  @IsOptional() @IsInt() serviceProviderID?: number;
  @IsOptional() @IsInt() companyID?: number;

  @IsOptional() @IsString() branchName?: string;
  @IsOptional() @IsString() branchType?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() timeZone?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() pfNo?: string;
  @IsOptional() @IsString() tanNo?: string;
  @IsOptional() @IsString() esiNo?: string;
  @IsOptional() @IsString() linNo?: string;
  @IsOptional() @IsString() gstNo?: string;
  @IsOptional() @IsString() gstCertUrl?: string;
  @IsOptional() @IsString() msmeNo?: string;
  @IsOptional() @IsString() msmeCertUrl?: string;
  @IsOptional() @IsString() shopRegNo?: string;
  @IsOptional() shopRegCertHistory?: any;
  @IsOptional() @IsString() financialYearStart?: string;
  @IsOptional() @IsString() contactNo?: string;
  @IsOptional() @IsEmail()  emailAdd?: string;
  @IsOptional() @IsString() companyLogoUrl?: string;
  @IsOptional() @IsString() SignatureUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankDetailCreateDto)
  bankDetails?: BankDetailCreateDto[];
}
