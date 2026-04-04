import { IsOptional, IsString, IsEmail } from 'class-validator';

export class CreateServiceProviderDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  companyAddress?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  gstNo?: string;

  @IsOptional()
  @IsString()
  contactNo?: string;

  @IsOptional()
  @IsEmail()
  emailAdd?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  companyLogoUrl?: string;
}
