import { IsInt, IsOptional, IsString } from "class-validator";

export class CreateEmpPromotionDto {
  @IsInt() manageEmployeeID!: number;

  @IsOptional() @IsInt() serviceProviderID?: number | null;
  @IsOptional() @IsInt() companyID?: number | null;
  @IsOptional() @IsInt() branchesID?: number | null;

  @IsOptional() @IsInt() departmentNameID?: number | null;
  @IsOptional() @IsInt() designationID?: number | null;
  @IsOptional() @IsInt() managerID?: number | null;

  @IsOptional() @IsString() employmentType?: string | null;      // "Company" | "Contract"
  @IsOptional() @IsString() employmentStatus?: string | null;    // "Permanent" | "Probation"
  @IsOptional() @IsString() probationPeriod?: string | null;     // e.g. "6 months"

  @IsOptional() @IsInt() workShiftID?: number | null;
  @IsOptional() @IsInt() attendancePolicyID?: number | null;
  @IsOptional() @IsInt() leavePolicyID?: number | null;

  @IsOptional() @IsString() salaryPayGradeType?: string | null;  // "Monthly" | "Hourly"
  @IsOptional() @IsInt() monthlyPayGradeID?: number | null;
  @IsOptional() @IsInt() hourlyPayGradeID?: number | null;

  // New: promoted salary (CTC)
  @IsOptional() @IsInt() promotedSalaryCtc?: number | null;

  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() promotionDate?: string | null;       // Date string
  @IsOptional() @IsString() status?: string | null;             // "Not Applied" | "Applied"
}
