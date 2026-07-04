import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  planName: string;

  @IsInt()
  @Min(1)
  validityDays: number;

  @IsNumber()
  @Min(0)
  planAmount: number;

  @IsArray()
  @IsInt({ each: true })
  moduleIDs: number[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}