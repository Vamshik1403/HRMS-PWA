import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateRosterDto {
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;

  @IsOptional()
  @IsString()
  status?: 'DRAFT' | 'PUBLISHED' | 'LOCKED';

  @IsOptional()
  @IsString()
  rosterPeriod?: string;
}
