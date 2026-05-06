import { IsOptional, IsString, IsInt, IsBoolean } from 'class-validator';

export class CreateFactualAttendancePolicyDto {
  @IsOptional() @IsInt() serviceProviderID?: number;
  @IsOptional() @IsInt() companyID?: number;
  @IsOptional() @IsInt() branchesID?: number;
  @IsOptional() @IsString() attendancePolicyName?: string;
  @IsOptional() @IsString() workingHoursType?: string;
  @IsOptional() @IsInt() checkin_begin_before_min?: number;
  @IsOptional() @IsInt() checkout_end_after_min?: number;
  @IsOptional() @IsInt() checkin_grace_time_min?: number;
  @IsOptional() @IsInt() earlyCheckoutBeforeEndMin?: number;
  @IsOptional() @IsInt() min_work_hours_half_day_min?: number;
  @IsOptional() @IsInt() max_late_check_in_time?: number;
  @IsOptional() @IsString() markAs?: string;
  @IsOptional() @IsString() lateMarkCount?: string;
  @IsOptional() @IsBoolean() allow_self_mark_attendance?: boolean;
  @IsOptional() @IsBoolean() allow_manager_update_ot?: boolean;
  @IsOptional() @IsInt() max_ot_hours_per_day_min?: number;
  @IsOptional() @IsInt() checkoutGracePeriodForOvertimeTrimming?: number;
  @IsOptional() @IsInt() breakTimeForOT?: number;
  @IsOptional() @IsBoolean() otMealApply?: boolean;
  @IsOptional() @IsInt() maxOvertimeHrs?: number;
  @IsOptional() @IsInt() minOvertimeHrs?: number;
  @IsOptional() @IsBoolean() countWorkhoursInMinutes?: boolean;
  @IsOptional() @IsBoolean() overtimeApplicable?: boolean;
  @IsOptional() @IsBoolean() overtimeTrimmingApply?: boolean;
  @IsOptional() @IsInt() minsForOTMealToken?: number;
  @IsOptional() @IsInt() minsForBreakTimeForMeal?: number;
  @IsOptional() @IsBoolean() leaveAroundHolidayCounted?: boolean;
  @IsOptional() @IsString() lateMarkMarkAs?: string;
  @IsOptional() @IsString() lateMarkMarkCount?: string;
  @IsOptional() @IsString() maxLateCheckinMarkAs?: string;
  @IsOptional() @IsInt() trimPreshiftMin?: number;
  @IsOptional() @IsInt() trimPostshiftMin?: number;
}
