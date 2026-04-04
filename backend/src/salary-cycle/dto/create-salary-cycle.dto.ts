import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalaryCycleDto {
  @IsOptional() @Type(() => Number) @IsInt()
  serviceProviderID?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  companyID?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  branchesID?: number;

  @IsOptional() @IsString() @MaxLength(255)
  salaryCycleName?: string;

  @IsOptional() @IsString() @MaxLength(2)
  monthStartDay?: string;
  
   @IsOptional()
  latest?: '1' | 'true';


}
