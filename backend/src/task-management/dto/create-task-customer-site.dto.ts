import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { TaskContactDto } from './task-contact.dto';

export class TaskSiteNoteDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() createdBy?: string;
}

export class CreateTaskCustomerSiteDto {
  @IsInt() customerID!: number;
  @IsOptional() @IsInt() companyID?: number;
  @IsString() branchName!: string;
  @IsOptional() @IsString() siteCode?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() gstNo?: string;
  @IsOptional() @IsString() latitude?: string;
  @IsOptional() @IsString() longitude?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskContactDto)
  contacts?: TaskContactDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskSiteNoteDto)
  notes?: TaskSiteNoteDto[];
}
