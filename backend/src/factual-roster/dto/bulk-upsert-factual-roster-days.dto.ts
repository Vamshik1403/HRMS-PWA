import { IsInt, IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { FactualRosterDayType, FactualRosterLeaveType } from '../enums/factual-roster.enums';

export class BulkUpsertFactualRosterDaysDto {
  @IsOptional() @IsInt() factualRosterID?: number;
  @IsInt() employeeID: number;
  @IsNotEmpty() @IsString() fromDate: string;
  @IsNotEmpty() @IsString() toDate: string;
  @IsEnum(FactualRosterDayType) dayType: string;
  @IsOptional() @IsInt() factualWorkShiftID?: number;
  @IsOptional() @IsInt() workShiftID?: number; // alias for compatibility
  @IsOptional() @IsEnum(FactualRosterLeaveType) leaveType?: string;
}
