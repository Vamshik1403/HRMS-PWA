// src/process-att-logs/dto/query-process_att_log.dto.ts
import { IsOptional, IsInt, IsDateString, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryProcessAttLogDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  deviceId?: number;

  @IsOptional()
  @IsString()
  deviceIds?: string; // Comma-separated device IDs

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  company_name?: string;

  @IsOptional()
  @IsString()
  branch_name?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  offset?: number;

  @IsOptional()
  @IsString()
  orderBy?: 'asc' | 'desc';
}