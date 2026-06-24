import { IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '../../users/enums/user-role.enum';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsString()
  @IsOptional()
  firstName: string;
  
  @IsString()
  @IsOptional()
  lastName: string;

  @IsOptional()
  @IsString()
  contactNo: string;
  
  @IsOptional()
  @IsString()
  email: string;
}
