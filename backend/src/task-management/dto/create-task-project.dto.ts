import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class TaskProjectContactDto {
  @IsString() contactName!: string;
  @IsString() contactNumber!: string;
  @IsOptional() @IsString() contactEmail?: string;
}

export class TaskWorkscopeDetailDto {
  @IsOptional() @Type(() => Number) @IsInt() workscopeCategoryID?: number;
  @IsOptional() @IsString() workscopeDetails?: string;
  @IsOptional() @IsString() extraNote?: string;
}

export class TaskScheduleDto {
  @IsOptional() @IsDateString() proposedDateTime?: string;
  @IsOptional() @IsString() priority?: string;
}

export class TaskImageDto {
  @IsString() filename!: string;
  @IsOptional() @IsString() filepath?: string;
  @IsOptional() @IsString() fileUrl?: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsInt() fileSize?: number;
  @IsOptional() @IsString() uploadedBy?: string;
  @IsOptional() @IsString() uploadedByName?: string;
}

export class TaskNoteDto {
  @IsOptional() @IsString() filename?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() filepath?: string;
  @IsOptional() @IsString() fileUrl?: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsInt() fileSize?: number;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() uploadedBy?: string;
  @IsOptional() @IsString() uploadedByName?: string;
}

export class TaskInventoryDto {
  @IsOptional() @Type(() => Number) @IsInt() productTypeId?: number;
  @IsOptional() @IsString() makeModel?: string;
  @IsOptional() @IsString() snMac?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() purchaseDate?: string;
  @IsOptional() @IsString() warrantyPeriod?: string;
  @IsOptional() @IsString() warrantyStatus?: string;
  @IsOptional() @IsBoolean() thirdPartyPurchase?: boolean;
}

export class TaskPurchaseProductDto {
  @IsOptional() @IsString() make?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() warranty?: string;
  @IsOptional() @IsString() rate?: string;
  @IsOptional() @IsString() vendor?: string;
  @IsOptional() @IsString() validity?: string;
  @IsOptional() @IsString() availability?: string;
}

export class TaskPurchaseAttachmentDto {
  @IsString() filename!: string;
  @IsOptional() @IsString() filepath?: string;
  @IsOptional() @IsString() fileUrl?: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsInt() fileSize?: number;
}

export class TaskPurchaseDto {
  @IsOptional() @IsString() purchaseType?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskPurchaseProductDto)
  products?: TaskPurchaseProductDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskPurchaseAttachmentDto)
  attachments?: TaskPurchaseAttachmentDto[];
}

export class TaskEngineerAssignmentDto {
  @IsOptional() @Type(() => Number) @IsInt() manageEmployeeID?: number;
  @IsOptional() @IsString() engineerName?: string;
  @IsOptional() @IsString() engineerEmail?: string;
  @IsOptional() @IsString() engineerPhone?: string;
  @IsOptional() @IsDateString() proposedDateTime?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() assignedDate?: string;
}

export class CreateTaskProjectDto {
  @IsOptional() @IsInt() serviceProviderID?: number;
  @IsOptional() @IsInt() companyID?: number;
  @IsOptional() @IsInt() departmentID?: number;
  @IsString() taskType!: string;
  @IsOptional() @IsInt() customerID?: number;
  @IsOptional() @IsInt() siteID?: number;
  @IsString() taskName!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() attachment?: string;
  @IsOptional() @IsDateString() scheduleDateTime?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsDateString() dueDateTime?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() createdByName?: string;
  @IsOptional() @IsInt() createdByUserID?: number;
  @IsOptional() @IsInt() createdByEmployeeID?: number;
  @IsOptional() @IsArray() @IsInt({ each: true }) assignedEmployeeIds?: number[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskProjectContactDto)
  contacts?: TaskProjectContactDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskWorkscopeDetailDto)
  workscopeDetails?: TaskWorkscopeDetailDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskScheduleDto)
  schedules?: TaskScheduleDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskImageDto)
  images?: TaskImageDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskNoteDto)
  notes?: TaskNoteDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskInventoryDto)
  inventories?: TaskInventoryDto[];
  @IsOptional()
  @ValidateNested()
  @Type(() => TaskPurchaseDto)
  purchase?: TaskPurchaseDto;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskEngineerAssignmentDto)
  engineerAssignments?: TaskEngineerAssignmentDto[];
}

export class UpdateTaskProjectDto {
  @IsOptional() @IsInt() departmentID?: number;
  @IsOptional() @IsString() taskType?: string;
  @IsOptional() @IsInt() customerID?: number;
  @IsOptional() @IsInt() siteID?: number;
  @IsOptional() @IsString() taskName?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() attachment?: string;
  @IsOptional() @IsDateString() scheduleDateTime?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsDateString() dueDateTime?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() createdByName?: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) assignedEmployeeIds?: number[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskProjectContactDto)
  contacts?: TaskProjectContactDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskWorkscopeDetailDto)
  workscopeDetails?: TaskWorkscopeDetailDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskScheduleDto)
  schedules?: TaskScheduleDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskImageDto)
  images?: TaskImageDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskNoteDto)
  notes?: TaskNoteDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskInventoryDto)
  inventories?: TaskInventoryDto[];
  @IsOptional()
  @ValidateNested()
  @Type(() => TaskPurchaseDto)
  purchase?: TaskPurchaseDto;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskEngineerAssignmentDto)
  engineerAssignments?: TaskEngineerAssignmentDto[];
}

export class TaskStatusChangeDto {
  @IsString() status!: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsInt() userID?: number;
  @IsOptional() @IsInt() employeeID?: number;
  @IsOptional() @IsString() actorName?: string;
}

export class TaskPriorityChangeDto {
  @IsString() priority!: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsInt() userID?: number;
  @IsOptional() @IsInt() employeeID?: number;
  @IsOptional() @IsString() actorName?: string;
}

export class CreateTaskRemarkDto {
  @IsString() remark!: string;
  @IsOptional() @IsInt() userID?: number;
  @IsOptional() @IsInt() employeeID?: number;
  @IsOptional() @IsString() authorName?: string;
  @IsOptional() @IsString() createdBy?: string;
  @IsOptional() @IsString() status?: string;
}

export class CreateTaskChatDto {
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsString() attachmentUrl?: string;
  @IsOptional() @IsInt() userID?: number;
  @IsOptional() @IsInt() employeeID?: number;
  @IsOptional() @IsInt() recipientEmployeeID?: number;
  @IsOptional() @IsString() senderName?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() remark?: string;
}
