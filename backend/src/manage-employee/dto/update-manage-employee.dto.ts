import {
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BankDetailsCreateDto, EmpDesignationCreateDto, TokenDeviceMapCreateDto, EmpBranchCreateDto, EmpDepartmentCreateDto, EmpEmploymentTypeCreateDto, EmpEmploymentStatusCreateDto, EmpWorkShiftCreateDto, EmpAttendancePolicyCreateDto, EmpLeavePolicyCreateDto, EmpContractorCreateDto } from './create-manage-employee.dto';
import e from 'express';

export class EduUpdateDto {
  @IsOptional() @IsInt() id?: number; // present if updating
  @IsOptional() @IsString() instituteType?: string;
  @IsOptional() @IsString() instituteName?: string;
  @IsOptional() @IsString() degree?: string;
  @IsOptional() @IsString() pasingYear?: string;
  @IsOptional() @IsString() marks?: string;
  @IsOptional() @IsString() gpaCgpa?: string;
  @IsOptional() @IsString() class?: string;
}

export class ExpUpdateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsString() orgName?: string;
  @IsOptional() @IsString() designation?: string;
  @IsOptional() @IsString() fromDate?: string;
  @IsOptional() @IsString() toDate?: string;
  @IsOptional() @IsString() responsibility?: string;
  @IsOptional() @IsString() skill?: string;
}

// ---------- Bank Details DTO ----------
export class BankDetailsUpdateDto {
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankBranchName?: string;
  @IsOptional() @IsString() accNumber?: string;
  @IsOptional() @IsString() ifscCode?: string;
  @IsOptional() @IsString() upi?: string;
}


export class DevMapUpdateDto {
  @IsOptional() @IsInt() id?: number;   // present if updating
  @IsInt() deviceID!: number;           // always required to connect/keep
  @IsOptional() @IsString() deviceEmpCode?: string;
  @IsOptional() @IsString() authType?: string;
}

export class TokenDeviceMapUpdateDto {
  @IsOptional() @IsInt() id?: number
  @IsInt() deviceID!: number;
  @IsOptional() @IsString() deviceEmpCode?: string;
} 

export class PromotionUpdateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsInt() departmentNameID?: number | null;
  @IsOptional() @IsInt() designationID?: number | null;
  @IsOptional() @IsInt() managerID?: number | null;
  @IsOptional() @IsString() employmentType?: string | null;
  @IsOptional() @IsString() employmentStatus?: string | null;
  @IsOptional() @IsString() probationPeriod?: string | null;
  @IsOptional() @IsInt() workShiftID?: number | null;
  @IsOptional() @IsInt() attendancePolicyID?: number | null;
  @IsOptional() @IsInt() leavePolicyID?: number | null;
  @IsOptional() @IsString() salaryPayGradeType?: string | null;
  @IsOptional() @IsInt() monthlyPayGradeID?: number | null;
  @IsOptional() @IsInt() hourlyPayGradeID?: number | null;
}

export class UpdateManageEmployeeDto {
  // FKs
  @IsOptional() @IsInt() serviceProviderID?: number | null;
  @IsOptional() @IsInt() companyID?: number | null;
  @IsOptional() @IsInt() branchesID?: number | null;
  @IsOptional() @IsInt() contractorID?: number | null;

  // Scalars
  @IsOptional() @IsString() employeeFirstName?: string | null;
  @IsOptional() @IsString() employeeLastName?: string | null;
  @IsOptional() @IsString() deviceEmployeeCode?: string | null;
  @IsOptional() @IsString() employeeID?: string | null;

  @IsOptional() @IsString() joiningDate?: string | null;
  @IsOptional() @IsString() businessPhoneNo?: string | null;
  @IsOptional() @IsEmail() businessEmail?: string | null;
  @IsOptional() @IsString() personalPhoneNo?: string | null;
  @IsOptional() @IsEmail() personalEmail?: string | null;
  @IsOptional() @IsString() emergancyContact?: string | null;

  @IsOptional() @IsString() presentAddress?: string | null;
  @IsOptional() @IsString() permenantAddress?: string | null;

  @IsOptional() @IsString() employeePhotoUrl?: string | null;
  @IsOptional() @IsString() gender?: string | null;
  @IsOptional() @IsString() dateOfBirth?: string | null; // fixed typo
  @IsOptional() @IsString() bloodGroup?: string | null;
  @IsOptional() @IsString() maritalStatus?: string | null;
  @IsOptional() @IsString() employeeFatherName?: string | null;
  @IsOptional() @IsString() employeeMotherName?: string | null;
  @IsOptional() @IsString() employeeSpouseName?: string | null;

  // Basic position fields (stored directly on ManageEmployee)
  @IsOptional() @IsInt() departmentNameID?: number | null;
  @IsOptional() @IsInt() designationID?: number | null;
  @IsOptional() @IsInt() managerID?: number | null;
  @IsOptional() @IsString() employmentType?: string | null;
  @IsOptional() @IsString() typeOfEmployee?: string | null;
  @IsOptional() @IsString() employmentStatus?: string | null;
  @IsOptional() @IsString() probationPeriod?: string | null;
  @IsOptional() @IsInt() workShiftID?: number | null;
  @IsOptional() @IsInt() attendancePolicyID?: number | null;
  @IsOptional() @IsInt() leavePolicyID?: number | null;
  @IsOptional() @IsString() salaryPayGradeType?: string | null;
  @IsOptional() @IsInt() monthlyPayGradeID?: number | null;
  @IsOptional() @IsInt() hourlyPayGradeID?: number | null;

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
  

  // Nested arrays (upsert)
  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EduUpdateDto)
  edu?: EduUpdateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpUpdateDto)
  exp?: ExpUpdateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DevMapUpdateDto)
  devices?: DevMapUpdateDto[];

     @IsOptional() @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TokenDeviceMapCreateDto)
    tokenDevices?: TokenDeviceMapCreateDto[];

  @IsOptional() @IsArray()
@ValidateNested({ each: true })
@Type(() => BankDetailsCreateDto)
bankDetails?: BankDetailsCreateDto[];

@IsOptional() @IsArray()
@ValidateNested({ each: true })
@Type(() => EmpDesignationCreateDto)
empDesignations?: EmpDesignationCreateDto[];

@IsOptional() @IsArray()
bankDetailsIdsToDelete?: number[];

@IsOptional() @IsArray()
empDesignationIdsToDelete?: number[];



  // Promotion (1:1)
  @IsOptional()
  @ValidateNested()
  @Type(() => PromotionUpdateDto)
  promotion?: PromotionUpdateDto;

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
  @Type(() => EmpLeavePolicyCreateDto)
  empLeavePolicies?: EmpLeavePolicyCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpContractorCreateDto)
  empContractors?: EmpContractorCreateDto[];

  // Optional arrays of ids to delete
  @IsOptional() @IsArray() eduIdsToDelete?: number[];
  @IsOptional() @IsArray() expIdsToDelete?: number[];
  @IsOptional() @IsArray() deviceMapIdsToDelete?: number[];
  @IsOptional() @IsArray() tokenDeviceMapIdsToDelete?: number[];
  @IsOptional() @IsArray() empBranchIdsToDelete?: number[];
  @IsOptional() @IsArray() empDepartmentIdsToDelete?: number[];
  @IsOptional() @IsArray() empEmploymentTypeIdsToDelete?: number[];
  @IsOptional() @IsArray() empEmploymentStatusIdsToDelete?: number[];
  @IsOptional() @IsArray() empWorkShiftIdsToDelete?: number[];
  @IsOptional() @IsArray() empAttendancePolicyIdsToDelete?: number[];
  @IsOptional() @IsArray() empLeavePolicyIdsToDelete?: number[];
  @IsOptional() @IsArray() empContractorIdsToDelete?: number[];
}
