import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class CreatePromotionRequestDto {
  @IsOptional() @IsInt() manageEmployeeID?: number;
  @IsOptional() @IsString() empID?: string;

  // New details
  @IsOptional() @IsInt() newDepartmentID?: number;
  @IsOptional() @IsInt() newDesignationID?: number;
  @IsOptional() @IsInt() newMonthlyPayGradeID?: number;
  @IsOptional() @IsInt() newHourlyPayGradeID?: number;
  @IsOptional() @IsInt() newSalaryCtc?: number;
  @IsOptional() @IsInt() newEmploymentType?: number;
  @IsOptional() @IsString() newEmployementStatus?: string;

  // Proposed details
  @IsOptional() @IsInt() proposedDepartmentID?: number;
  @IsOptional() @IsInt() proposedDesignationID?: number;
  @IsOptional() @IsInt() proposedMonthlyPayGradeID?: number;
  @IsOptional() @IsInt() proposedHourlyPayGradeID?: number;
  @IsOptional() @IsInt() proposedSalaryCtc?: number;
  @IsOptional() @IsInt() proposedEmploymentType?: number;

  // Meta
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() promotionDate?: string; // yyyy-mm-dd
  @IsOptional() @IsString() status?: string;
}
