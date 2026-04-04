import { IsOptional, IsString, IsInt } from 'class-validator';

export class CreateDesignationsDto {
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
  @IsInt()  departmentID?: number;

  @IsOptional()
  @IsString()
  designation?: string;
  
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

    @IsOptional()
    @IsString()
    otApplicable?: string;
    
}
