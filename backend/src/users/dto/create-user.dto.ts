// create-user.dto.ts
import { IsString, IsOptional, IsEnum, MinLength, IsInt, IsBoolean } from 'class-validator';

export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  BRANCH_ADMIN = 'BRANCH_ADMIN',
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
  @IsInt()
  serviceProviderID?: number;
  @IsOptional()
  @IsInt()
  companyID?: number;
  @IsOptional()
  @IsInt()
  branchesID?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}