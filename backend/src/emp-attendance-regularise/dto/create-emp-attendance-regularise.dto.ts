import { IsOptional, IsString, IsInt, IsDateString, IsBoolean } from 'class-validator';

export class CreateEmpAttendanceRegulariseDto {
  @IsOptional()
  @IsInt()
  serviceProviderID?: number;

  @IsOptional()
  @IsInt()
  companyID?: number;

  @IsOptional()
  @IsInt()
  branchesID?: number;

  @IsOptional()
  @IsInt()
  departmentID?: number;

  @IsOptional()
  @IsInt()
  manageEmployeeID?: number;

  @IsOptional()
  @IsDateString()
  attendanceDate?: string;

  @IsOptional()
  @IsString()
  day?: string;

  @IsOptional()
  @IsDateString()
  checkInTime?: string;

  @IsOptional()
  @IsDateString()
  checkOutTime?: string;

  @IsOptional()
  @IsString()
  actualStatus?: string;

  @IsOptional()
  @IsString()
  requestedStatus?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  overtimeApplicable?: boolean;

  @IsOptional()
  @IsBoolean()
  otMealApply?: boolean;

  @IsOptional()
  @IsInt()
  otMealMinutes?: number;

  @IsOptional()
  @IsInt()
  otBreakMinutes?: number;
}
