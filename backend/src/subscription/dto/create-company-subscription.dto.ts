import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class CreateCompanySubscriptionDto {
  @IsInt()
  companyID: number;

  @IsInt()
  planID: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsInt()
  renewedFromID?: number;
}