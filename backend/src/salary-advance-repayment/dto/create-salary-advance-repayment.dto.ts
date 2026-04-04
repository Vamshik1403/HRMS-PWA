import { IsEnum, IsInt, IsOptional, IsDateString, IsNumber, IsString } from 'class-validator';

export class CreateSalaryAdvanceRepaymentDto {
  @IsInt()
  salaryAdvanceID: number;


  @IsString()
  approvedAmount: string;


  @IsOptional() 
  @IsString()
  startMonth?: string;


  @IsOptional()
   @IsString()
  amount?: string;
}
