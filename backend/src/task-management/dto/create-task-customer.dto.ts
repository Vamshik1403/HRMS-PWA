import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateTaskCustomerDto {
  @IsOptional() @IsInt() serviceProviderID?: number;
  @IsOptional() @IsInt() companyID?: number;
@IsOptional()
@Type(() => Number)
@IsInt()
branchesID?: number;
  @IsString() customerName!: string;
  @IsString() customerCode!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsInt() createdByUserID?: number;
}
