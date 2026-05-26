import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateTaskCustomerSiteDto {
  @IsInt() customerID!: number;
  @IsString() branchName!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() latitude?: string;
  @IsOptional() @IsString() longitude?: string;
}
