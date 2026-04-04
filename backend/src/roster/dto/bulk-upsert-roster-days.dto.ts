import { IsDateString, IsEnum, IsInt, IsOptional, IsNotEmpty } from 'class-validator';
import { RosterDayType, RosterLeaveType } from '../enums/roster.enums';

export class BulkUpsertRosterDaysDto {
  @IsInt()
  @IsNotEmpty()
  employeeID: number; // Change from rosterEmployeeID to employeeID

  @IsDateString()
  @IsNotEmpty()
  fromDate: string;

  @IsDateString()
  @IsNotEmpty()
  toDate: string;

  @IsEnum(RosterDayType)
  @IsNotEmpty()
  dayType: RosterDayType;

  @IsOptional()
  @IsInt()
  workShiftID?: number;

  @IsOptional()
  @IsEnum(RosterLeaveType)
  leaveType?: RosterLeaveType;
}