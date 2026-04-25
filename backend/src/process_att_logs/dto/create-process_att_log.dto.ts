import { IsOptional, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProcessAttLogDto {

  @IsOptional()
  @IsString()
  device_sn?: string;

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @Type(() => Date)
  punch_time?: Date;

  @IsOptional()
  @IsString()
  company_name?: string;

  @IsOptional()
  @IsString()
  branch_name?: string;

  @IsOptional()
  @IsString()
  department_name?: string;

  @IsOptional()
  @IsString()
  device_emp_code?: string;

  @IsOptional()
  @IsInt()
  manage_employee_id?: number;

  @IsOptional()
  @IsInt()
  device_id?: number;

  @IsOptional()
  @IsString()
  raw_body?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  device_name?: string;
}