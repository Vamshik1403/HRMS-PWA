import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class CreateBonusAllocationDto {
  // Required FKs
  @Type(() => Number) @IsInt() @Min(1)
  bonusSetupID!: number;

  @Type(() => Number) @IsInt() @Min(1)
  employeeID!: number;

  // Optional numbers
  @IsOptional() @Type(() => Number) @IsInt()
  financialYear?: number;    // e.g., 2025

  @IsOptional() @Type(() => Number) @IsInt()
  salaryPeriod?: number;     // e.g., month index (1-12) or custom period
}
