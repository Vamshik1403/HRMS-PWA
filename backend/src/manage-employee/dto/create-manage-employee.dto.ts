import { Type } from "class-transformer";
import {
  IsOptional,
  IsInt,
  IsString,
  IsEmail,
  IsArray,
  ValidateNested,
  Matches,
  Length,
  IsBoolean
} from "class-validator";

// ---------- Promotion DTO ----------
export class PromotionCreateDto {
  @IsOptional() @IsInt() departmentNameID?: number;
  @IsOptional() @IsInt() designationID?: number;
  @IsOptional() @IsInt() managerID?: number;
  @IsOptional() @IsString() employmentType?: string;
  @IsOptional() @IsString() typeOfEmployee?: string;
  @IsOptional() @IsString() employmentStatus?: string;
  @IsOptional() @IsString() probationPeriod?: string;
  @IsOptional() @IsInt() workShiftID?: number;
  @IsOptional() @IsInt() attendancePolicyID?: number;
  @IsOptional() @IsInt() leavePolicyID?: number;
  @IsOptional() @IsString() salaryPayGradeType?: string;
  @IsOptional() @IsInt() monthlyPayGradeID?: number;
  @IsOptional() @IsInt() hourlyPayGradeID?: number;
}

// ---------- Bank Details DTO ----------
export class BankDetailsCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankBranchName?: string;
  @IsOptional() @IsString() accNumber?: string;
  @IsOptional() @IsString() ifscCode?: string;
  @IsOptional() @IsString() upi?: string;
}

// ---------- Education DTO ----------
export class EduCreateDto {
  @IsOptional() @IsString() instituteType?: string;
  @IsOptional() @IsString() instituteName?: string;
  @IsOptional() @IsString() degree?: string;
  @IsOptional() @IsString() pasingYear?: string;
  @IsOptional() @IsString() marks?: string;
  @IsOptional() @IsString() gpaCgpa?: string;
  @IsOptional() @IsString() class?: string;
}

// ---------- Experience DTO ----------
export class ExpCreateDto {
  @IsOptional() @IsString() orgName?: string;
  @IsOptional() @IsString() designation?: string;
  @IsOptional() @IsString() fromDate?: string;
  @IsOptional() @IsString() toDate?: string;
  @IsOptional() @IsString() responsibility?: string;
  @IsOptional() @IsString() skill?: string;
}

// ---------- Employee Designation DTO ----------
export class EmpDesignationCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsInt() designationID?: number;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Branch DTO ----------
export class EmpBranchCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsInt() branchesID?: number;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Department DTO ----------
export class EmpDepartmentCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsInt() departmentNameID?: number;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Employment Type DTO ----------
export class EmpEmploymentTypeCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsString() employmentType?: string;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Employment Status DTO ----------
export class EmpEmploymentStatusCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsString() employmentStatus?: string;
  @IsOptional() @IsString() probationPeriod?: string;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Work Shift DTO ----------
export class EmpWorkShiftCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsInt() workShiftID?: number;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Attendance Policy DTO ----------
export class EmpAttendancePolicyCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsInt() attendancePolicyID?: number;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Factual Work Shift DTO ----------
export class EmpFactualWorkShiftCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsInt() factualWorkShiftID?: number;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Factual Attendance Policy DTO ----------
export class EmpFactualAttendancePolicyCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsInt() factualAttendancePolicyID?: number;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Leave Policy DTO ----------
export class EmpLeavePolicyCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsInt() leavePolicyID?: number;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Contractor DTO ----------
export class EmpContractorCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsInt() contractorID?: number;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Device Mapping DTO ----------
export class DevMapCreateDto {
   @IsOptional() @IsInt() id?: number;
  @IsInt() deviceID!: number;
  @IsOptional() @IsString() deviceEmpCode?: string;
  @IsOptional() @IsString() authType?: string;
}

export class TokenDeviceMapCreateDto  {
   @IsOptional() @IsInt() id?: number;
  @IsInt() deviceID!: number;
  @IsOptional() @IsString() deviceEmpCode?: string;
  @IsOptional() @IsString() authType?: string;
}

// ---------- Employee Credentials DTO ----------
export class EmployeeCredentialsCreateDto {
  @IsOptional() @IsString()
@Matches(/^[0-9+\-\s()]+$/, {
  message: 'Username must be a valid mobile number'
})
username?: string;

  @IsOptional() @IsString()
@Length(6, 100, { message: 'Password must be at least 6 characters long' })
password?: string;

  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional() @IsBoolean() mustChangePassword?: boolean;

  @IsOptional() @IsString() passwordChangedAt?: string;
}

export class EmployeeCredentialsUpdateDto {
  @IsOptional() @IsString()
@Matches(/^[0-9+\-\s()]+$/, {
  message: 'Username must be a valid mobile number'
})
  username?: string;

  @IsOptional() @IsString()
  @Length(6, 100, { message: 'Password must be at least 6 characters long' })
  password?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsBoolean() mustChangePassword?: boolean;

  @IsOptional() @IsString() passwordChangedAt?: string;
}

// ---------- Login DTO ----------
export class EmployeeLoginDto {
  @IsString()
@Matches(/^[0-9+\-\s()]+$/, {
  message: 'Username must be a valid mobile number'
})

  username!: string;

  @IsString()
  @Length(1, 100, { message: 'Password is required' })
  password!: string;
}


export class EmployeeDocumentDto {

  id?: number;

  documentName: string;

  documentCategory: string;

  description?: string;

  issuedDate?: Date;

  expiryDate?: Date;

  fileName?: string;

  fileUrl?: string;

  fileType?: string;

  fileSize?: number;
}

// ---------- Create Employee DTO ----------
export class CreateManageEmployeeDto {
  // FKs
  @IsOptional() @IsInt() serviceProviderID?: number;
  @IsOptional() @IsInt() companyID?: number;
  @IsOptional() @IsInt() branchesID?: number;
  @IsOptional() @IsInt() contractorID?: number;

  // Scalars
  @IsOptional() @IsString() employeeFirstName?: string;
  @IsOptional() @IsString() employeeLastName?: string;

  @IsOptional()
  @IsString()
  employeeID?: string;

  @IsOptional() @IsString() empType?: string;

  @IsOptional() @IsString() pfMemberStatus?: string;

  @IsOptional() @IsString() pfNumber?: string;

  @IsOptional() @IsString() aadharNo?: string;
  @IsOptional() @IsString() panNo?: string;
  @IsOptional() @IsString() uanNo?: string;
  @IsOptional() @IsString() esiNo?: string;

  @IsOptional() @IsString() joiningDate?: string;

  @IsOptional() @IsString() businessPhoneNo?: string;
  @IsOptional() @IsEmail() businessEmail?: string;

  @IsOptional()
  @IsString()
  personalPhoneNo?: string;

  @IsOptional() @IsEmail() personalEmail?: string;
  @IsOptional() @IsString() emergancyContact?: string;

  @IsOptional() @IsString() presentAddress?: string;
  @IsOptional() @IsString() permenantAddress?: string;

  @IsOptional() @IsString() employeePhotoUrl?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsInt() numberOfChildren?: number;
  @IsOptional() @IsString() dateOfBirth?: string;
  @IsOptional() @IsString() bloodGroup?: string;
  @IsOptional() @IsString() maritalStatus?: string;
  @IsOptional() @IsString() employeeFatherName?: string;
  @IsOptional() @IsString() employeeMotherName?: string;
  @IsOptional() @IsString() employeeSpouseName?: string;

  @IsOptional() @IsInt() departmentNameID?: number;
  @IsOptional() @IsInt() designationID?: number;
  @IsOptional() @IsString() employmentType?: string;
  @IsOptional() @IsString() typeOfEmployee?: string;
  @IsOptional() @IsString() employmentStatus?: string;
  @IsOptional() @IsString() probationPeriod?: string;
  @IsOptional() @IsInt() workShiftID?: number;
  @IsOptional() @IsInt() attendancePolicyID?: number;
  @IsOptional() @IsInt() leavePolicyID?: number;
  @IsOptional() @IsString() salaryPayGradeType?: string;
  @IsOptional() @IsInt() monthlyPayGradeID?: number;
  @IsOptional() @IsInt() hourlyPayGradeID?: number;

  @IsOptional()
  @IsString()
  shiftEligibility?: string;

  @IsOptional()
  @IsString()
  nightShiftEligibility?: string;

  @IsOptional()
  @IsString()
  maxHoursPerDay?: string;

  @IsOptional()
  @IsString()
  weeklyOffPattern?: string;

  @IsOptional()
  @IsString()
  noticePeriodDaysForResignation?: string;

  @IsOptional()
  @IsString()
  noticePeriodDaysForTermination?: string;

  @IsOptional() @IsBoolean()
  allowRotatingShift?: boolean;
  allowCreateTaskOnMobile?: boolean;
  pwaShowLeaveBalance?: boolean;

  @IsOptional() @IsBoolean()
  mobileAttendanceEnabled?: boolean;

  @IsOptional() @IsBoolean()
  mobileBreakEnabled?: boolean;

  // Nested arrays
  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EduCreateDto)
  edu?: EduCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankDetailsCreateDto)
  bankDetails?: BankDetailsCreateDto[];

  employeeDocuments?: EmployeeDocumentDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpCreateDto)
  exp?: ExpCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DevMapCreateDto)
  devices?: DevMapCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpDesignationCreateDto)
  empDesignations?: EmpDesignationCreateDto[];

   @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TokenDeviceMapCreateDto)
  tokenDevices?: TokenDeviceMapCreateDto[];  

  @IsOptional()
  @ValidateNested()
  @Type(() => PromotionCreateDto)
  promotion?: PromotionCreateDto;

  // Multi-value junction table arrays
  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpBranchCreateDto)
  empBranches?: EmpBranchCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpDepartmentCreateDto)
  empDepartments?: EmpDepartmentCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpEmploymentTypeCreateDto)
  empEmploymentTypes?: EmpEmploymentTypeCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpEmploymentStatusCreateDto)
  empEmploymentStatuses?: EmpEmploymentStatusCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpWorkShiftCreateDto)
  empWorkShifts?: EmpWorkShiftCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpAttendancePolicyCreateDto)
  empAttendancePolicies?: EmpAttendancePolicyCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpFactualWorkShiftCreateDto)
  empFactualWorkShifts?: EmpFactualWorkShiftCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpFactualAttendancePolicyCreateDto)
  empFactualAttendancePolicies?: EmpFactualAttendancePolicyCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpLeavePolicyCreateDto)
  empLeavePolicies?: EmpLeavePolicyCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpContractorCreateDto)
  empContractors?: EmpContractorCreateDto[];
}

