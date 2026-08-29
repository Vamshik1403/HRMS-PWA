import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { TaskContactDto } from './task-contact.dto';

export class CreateTaskCustomerDto {
  @IsOptional() @IsInt() serviceProviderID?: number;
  @IsOptional() @IsInt() companyID?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchesID?: number;
  @IsString() customerName!: string;
  @IsString() customerCode!: string;
  @IsOptional() @IsString() addressType?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() gstNo?: string;
  @IsOptional() @IsString() relationshipManagerName?: string;
  @IsOptional() @IsString() relationshipManagerEmail?: string;
  @IsOptional() @IsInt() createdByUserID?: number;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskContactDto)
  contacts?: TaskContactDto[];
}
