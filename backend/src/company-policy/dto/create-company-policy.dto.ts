import { IsDateString, IsEnum, IsString, MinLength } from 'class-validator';
import { CompanyPolicyType } from '@prisma/client';

export class CreateCompanyPolicyDto {
  @IsEnum(CompanyPolicyType)
  type: CompanyPolicyType;

  @IsString()
  @MinLength(1)
  policyName: string;

  @IsString()
  @MinLength(1)
  versionName: string;

  @IsDateString()
  effectiveFrom: string;

  @IsString()
  bodyHtml: string;
}
