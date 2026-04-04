import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class CreateEmpCurrentPositionDto {
  @IsOptional() @IsInt() serviceProviderID?: number;
  @IsOptional() @IsInt() companyID?: number;
  @IsOptional() @IsInt() branchesID?: number;
  @IsOptional() @IsInt() manageEmployeeID?: number;

  @IsOptional() @IsInt() existingDepartmentID?: number;
  @IsOptional() @IsInt() existingDesignationID?: number;
  @IsOptional() @IsInt() existingMonthlyPayGradeID?: number;
  @IsOptional() @IsInt() existingHourlyPayGradeID?: number;
  @IsOptional() @IsInt() existingSalaryCtc?: number;
  @IsOptional() @IsInt() existingEmploymentType?: number;

  @IsOptional() @IsDateString() effectiveFrom?: string; // yyyy-mm-dd
  @IsOptional() @IsDateString() effectiveTo?: string;   // yyyy-mm-dd
}
