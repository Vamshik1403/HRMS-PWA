import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';

export class UpdateCompanySubscriptionDto {
  @IsOptional()
  @IsInt()
  planID?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsDateString()
  deactivationWef?: string;

  @IsOptional()
  @IsString()
  deactivationReason?: string;
}