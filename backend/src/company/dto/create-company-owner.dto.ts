import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OwnerModulePermissionDto {
  @IsString()
  moduleKey!: string;

  @IsOptional()
  @IsBoolean()
  canView?: boolean;

  @IsOptional()
  @IsBoolean()
  canCreate?: boolean;

  @IsOptional()
  @IsBoolean()
  canEdit?: boolean;

  @IsOptional()
  @IsBoolean()
  canDelete?: boolean;
}

export class CreateCompanyOwnerDto {
  @IsNotEmpty()
  @IsString()
  firstName!: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsNotEmpty()
  @IsString()
  personalPhoneNo!: string;

  @IsOptional()
  @IsString()
  businessPhoneNo?: string;

  @IsNotEmpty()
  @IsEmail()
  businessEmail!: string;

  @IsOptional()
  @IsString()
  salutation?: string;

  @IsOptional()
  @IsString()
  employeeCode?: string;

  @IsOptional()
  @IsString()
  joiningDate?: string;

  /** Designation / owner title for the company owner (shown as Designation). */
  @IsOptional()
  @IsString()
  ownerTitle?: string;

  @IsOptional()
  @IsBoolean()
  isCompanyOwner?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OwnerModulePermissionDto)
  permissions?: OwnerModulePermissionDto[];
}

export class SaveOwnerPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OwnerModulePermissionDto)
  permissions!: OwnerModulePermissionDto[];
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
