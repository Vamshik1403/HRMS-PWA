import { IsOptional, IsString, IsInt } from 'class-validator';

export class CreateContractorDto {
  @IsOptional() @IsInt() serviceProviderID?: number;
  @IsOptional() @IsInt() companyID?: number;
  @IsOptional() @IsString() contractorType?: string;
  @IsOptional() @IsString() contractorName?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() timeZone?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() pfNo?: string;
  @IsOptional() @IsString() tanNo?: string;
  @IsOptional() @IsString() esiNo?: string;
  @IsOptional() @IsString() linNo?: string;
  @IsOptional() @IsString() gstNo?: string;
  @IsOptional() @IsString() shopRegNo?: string;
  @IsOptional() @IsString() financialYearStart?: string;
  @IsOptional() @IsString() contactNo?: string;
  @IsOptional() @IsString() emailAdd?: string;
  @IsOptional() @IsString() companyLogoUrl?: string;
  @IsOptional() @IsString() SignatureUrl?: string;
}
