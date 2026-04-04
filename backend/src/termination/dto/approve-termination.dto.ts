import { IsDateString, IsOptional, IsInt, Min } from 'class-validator';

export class ApproveTerminationDto {
  @IsDateString()
  lastWorkingDay: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  noticeDays?: number;

  @IsOptional()
  @IsDateString()
  disableLoginOn?: string;
}
