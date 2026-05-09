import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateComplianceRuleDto {
  @IsOptional() @Type(() => Number) @IsInt()
  serviceProviderID?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  companyID?: number;

  @IsString() @MaxLength(2000)
  ruleText!: string;

  @IsOptional() @Type(() => Boolean) @IsBoolean()
  isActive?: boolean;
}
