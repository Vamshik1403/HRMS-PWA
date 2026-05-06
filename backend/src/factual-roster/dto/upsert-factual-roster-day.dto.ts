import { IsInt, IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { FactualRosterDayType, FactualRosterLeaveType } from '../enums/factual-roster.enums';

export class UpsertFactualRosterDayDto {
  @IsInt() factualRosterEmployeeID: number;
  @IsNotEmpty() @IsString() workDate: string;
  @IsEnum(FactualRosterDayType) dayType: string;
  @IsOptional() @IsInt() factualWorkShiftID?: number;
  @IsOptional() @IsEnum(FactualRosterLeaveType) leaveType?: string;
}
