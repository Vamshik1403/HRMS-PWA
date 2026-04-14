import { IsEnum, IsInt, IsOptional, IsString, IsDateString, Min } from 'class-validator';

export enum ExitType {
  RESIGNATION = 'RESIGNATION',
  TERMINATION = 'TERMINATION',
  RETRENCHMENT = 'RETRENCHMENT',
  RETIREMENT = 'RETIREMENT',
  DEATH = 'DEATH',
  ABSCONDING = 'ABSCONDING',
  CONTRACT_END = 'CONTRACT_END',
}

export class CreateTerminationDto {
  @IsInt()
  employeeId: number;

  @IsEnum(ExitType)
  exitType: ExitType;

  @IsOptional()
  @IsString()
  reasonCategory?: string;

  @IsOptional()
  @IsString()
  reasonNote?: string;

  @IsOptional()
  @IsDateString()
  resignationDate?: string;

  @IsOptional()
  @IsDateString()
  noticeStartDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  noticeDays?: number;
}
