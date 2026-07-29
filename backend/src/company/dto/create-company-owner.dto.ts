import {
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCompanyOwnerDto {
  @IsNotEmpty()
  @IsString()
  firstName!: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  username!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  personalPhoneNo?: string;

  @IsOptional()
  @IsString()
  businessEmail?: string;

  @IsOptional()
  @IsString()
  employeeCode?: string;

  @IsOptional()
  @IsString()
  joiningDate?: string;
}

export class CreateCompanyWithOwnerDto {
  // Company fields mirrored from CreateCompanyDto (subset used by wizard)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  serviceProviderID?: number;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  companyType?: string;

  @IsOptional()
  @IsString()
  legalEntityType?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsString()
  contactNo?: string;

  @IsOptional()
  @IsString()
  emailAdd?: string;

  @IsOptional()
  @IsString()
  timeZone?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  /** Owner account (required for new-tenant flow) */
  @IsNotEmpty()
  @IsString()
  ownerFirstName!: string;

  @IsOptional()
  @IsString()
  ownerLastName?: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  ownerUsername!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  ownerPassword!: string;

  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @IsOptional()
  @IsString()
  ownerEmail?: string;
}
