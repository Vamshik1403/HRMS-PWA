// src/company/dto/create-company.dto.ts
import { IsBoolean, IsOptional, IsString, IsEmail, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCompanyDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  serviceProviderID?: number;

  
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() companyType?: string; 
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() timeZone?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() pfNo?: string;
  @IsOptional() @IsString() tanNo?: string;
  @IsOptional() @IsString() panNo?: string;
  @IsOptional() @IsString() esiNo?: string;
  @IsOptional() @IsString() linNo?: string;
  @IsOptional() @IsString() gstNo?: string;
  @IsOptional() @IsString() gstCertUrl?: string;
  @IsOptional() @IsString() shopRegNo?: string;
  @IsOptional() shopRegCertHistory?: any;
  @IsOptional() @IsString() financialYearStart?: string;
  @IsOptional() @IsString() contactNo?: string;
  @IsOptional() @IsEmail() emailAdd?: string;
  @IsOptional() @IsString() companyLogoUrl?: string;
  @IsOptional() @IsString() SignatureUrl?: string;

  
      @IsOptional()
      @IsString()
      noticePeriodDaysForResignation?: string;
  
      @IsOptional()
      @IsString()
      noticePeriodDaysForTermination?: string;

  @IsOptional()
  @IsBoolean()
  pwaShowLeaveBalance?: boolean;
}
