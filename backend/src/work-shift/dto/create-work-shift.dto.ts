// create-work-shift.dto.ts
import { IsOptional, IsString, IsInt, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class WorkShiftDayDto {
  @IsOptional() @IsString() weekDay?: string;
  @IsOptional() @IsString() shiftType?: string;
  @IsOptional() weeklyOff?: boolean;
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
  @IsOptional() @IsString() breakStart?: string;
  @IsOptional() @IsString() breakEnd?: string;
  @IsOptional() @IsInt() totalMinutes?: number;
}

export class CreateWorkShiftDto {
  @IsOptional() @IsInt() serviceProviderID?: number;
  @IsOptional() @IsInt() companyID?: number;
  @IsOptional() @IsInt() branchesID?: number;
  @IsOptional() @IsString() workShiftName?: string;
  @IsOptional() @IsString() workShiftType?: string;
  @IsOptional() @IsBoolean() isFlexible?: boolean;
  @IsOptional() @IsBoolean() isRotating?: boolean;
  @IsOptional() @IsString() isActive?: string;
  @IsOptional() @IsInt() breakTimeMin?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => WorkShiftDayDto) workShiftDays?: WorkShiftDayDto[];
}