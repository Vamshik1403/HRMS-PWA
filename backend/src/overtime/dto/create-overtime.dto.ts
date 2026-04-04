import { IsInt, IsDateString, IsString } from "class-validator";

export class CreateOvertimeDto {
  @IsInt() serviceProviderID: number;
  @IsInt() companyID: number;
  @IsInt() branchesID: number;

  @IsInt() employeeID: number;
  @IsInt() workShiftID: number;

  @IsDateString() workDate: string;

  @IsDateString() shiftStartTime: string;
  @IsDateString() shiftEndTime: string;

  @IsDateString() punchOutTime: string;
  @IsDateString() otStartTime: string;
  @IsDateString() otEndTime: string;

  @IsInt() otMinutes: number;
  otHours: number;

  @IsString() otRate: string;
}
