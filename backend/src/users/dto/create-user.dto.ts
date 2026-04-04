// create-user.dto.ts
import { IsString, IsOptional, IsEnum, MinLength, IsInt } from 'class-validator';

export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
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
}