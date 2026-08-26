import {
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
  IsInt,
  IsBoolean,
  IsArray,
  ArrayUnique,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  SERVICE_PROVIDER = 'SERVICE_PROVIDER',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  BRANCH_ADMIN = 'BRANCH_ADMIN',
  CONTRACTOR_ADMIN = 'CONTRACTOR_ADMIN',
  EXECUTIVE = 'EXECUTIVE',
  EMPLOYEE = 'EMPLOYEE',
}

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  contactNo: string;

  @IsOptional()
  @IsEmail()
  email: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  serviceProviderID?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  companyID?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  companyIDs?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchesID?: number;

@IsOptional()
@Type(() => Number)
@IsInt()
contractorID?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}