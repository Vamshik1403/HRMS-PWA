import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { RosterDayType, RosterLeaveType } from '../enums/roster.enums';

export class UpsertRosterDayDto {
  @IsInt() @Min(1) rosterEmployeeID: number;

  @IsDateString()
  workDate: string;

  @IsEnum(RosterDayType)
  dayType: RosterDayType;

  @IsOptional()
  @IsInt()
  workShiftID?: number;

  @IsOptional()
  @IsEnum(RosterLeaveType)
  leaveType?: RosterLeaveType;
}
