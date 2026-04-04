// src/generate-salary/dto/create-generate-salary.dto.ts
import { IsInt, IsOptional, isString, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGenerateSalaryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  serviceProviderID?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  companyID?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchesID?: number;
  @Type(() => Number)
  @IsInt()
  employeeID!: number; // required (FK to ManageEmployee)
  @IsOptional()
  @IsString()
  monthPeriod: string;
  @IsString()
  @IsOptional()
  paymentMode?: string;
  @IsString()
  @IsOptional()
  paymentType: string;
  @IsString()
  @IsOptional()
  paymentDate: string;
  @IsString()
  @IsOptional()
  paymentRemark: string;
  @IsString()
  @IsOptional()
  paymentProof: string;
  @IsOptional()
  @IsString()
  status?: string;
}
