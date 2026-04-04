import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBonusSetupDto {
  @IsOptional() @Type(() => Number) @IsInt()
  serviceProviderID?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  companyID?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  branchesID?: number;

  @IsOptional() @IsString() @MaxLength(255)
  bonusName?: string;

  @IsOptional() @IsString() @MaxLength(255)
  bonusType?:string;

  @IsOptional() @IsString() @MaxLength(500)
  bonusDescription?: string;

  @IsOptional() @IsString() @MaxLength(100)
  bonusBasedOn?: string;

  @IsOptional() @IsString() @MaxLength(50)
  bonusPercentage?: string;

  @IsOptional() @IsString() 
  bonusFixed?:string
}
