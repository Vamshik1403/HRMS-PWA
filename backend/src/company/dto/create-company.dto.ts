// src/company/dto/create-company.dto.ts
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PrimaryContactDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsBoolean()
  setAsCompanyAdmin?: boolean;
}

export class CreateCompanyDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  serviceProviderID?: number;

  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() companyType?: string;
  @IsOptional() @IsString() legalEntityType?: string;
  @IsOptional() @IsString() defaultOwnerTitle?: string;
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
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() gstRegistrationType?: string;
  @IsOptional() @IsString() businessTradeName?: string;
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrimaryContactDto)
  primaryContacts?: PrimaryContactDto[];
}
