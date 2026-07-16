import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCompanyModuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  moduleName: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  moduleDescription?: string;

  @IsOptional()
  @IsBoolean()
  moduleStatus?: boolean;
}