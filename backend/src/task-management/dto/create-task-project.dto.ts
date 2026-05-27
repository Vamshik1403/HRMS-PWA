import { IsArray, IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateTaskProjectDto {
  @IsOptional() @IsInt() serviceProviderID?: number;
  @IsOptional() @IsInt() companyID?: number;
  @IsOptional() @IsInt() departmentID?: number;
  @IsString() taskType!: string;
  @IsOptional() @IsInt() customerID?: number;
  @IsOptional() @IsInt() siteID?: number;
  @IsString() taskName!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() scheduleDateTime?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsDateString() dueDateTime?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsInt() createdByUserID?: number;
  @IsOptional() @IsInt() createdByEmployeeID?: number;
  @IsOptional() @IsArray() @IsInt({ each: true }) assignedEmployeeIds?: number[];
}

export class UpdateTaskProjectDto {
  @IsOptional() @IsInt() departmentID?: number;
  @IsOptional() @IsString() taskType?: string;
  @IsOptional() @IsInt() customerID?: number;
  @IsOptional() @IsInt() siteID?: number;
  @IsOptional() @IsString() taskName?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() scheduleDateTime?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsDateString() dueDateTime?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) assignedEmployeeIds?: number[];
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
}

export class CreateTaskChatDto {
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsString() attachmentUrl?: string;
  @IsOptional() @IsInt() userID?: number;
  @IsOptional() @IsInt() employeeID?: number;
  @IsOptional() @IsString() senderName?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() remark?: string;
}
