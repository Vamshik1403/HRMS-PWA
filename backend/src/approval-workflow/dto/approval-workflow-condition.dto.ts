import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum WorkflowConditionFieldDto {
  BRANCH = 'BRANCH',
  DEPARTMENT = 'DEPARTMENT',
  DESIGNATION = 'DESIGNATION',
  EMPLOYEE = 'EMPLOYEE',

  TOTAL_AMOUNT = 'TOTAL_AMOUNT',
  SALARY_AMOUNT = 'SALARY_AMOUNT',

  LEAVE_TYPE = 'LEAVE_TYPE',
  LEAVE_DAYS = 'LEAVE_DAYS',

  EXIT_TYPE = 'EXIT_TYPE',

  REGULARISATION_TYPE = 'REGULARISATION_TYPE',
  REGULARISATION_DAYS = 'REGULARISATION_DAYS',

  REQUEST_TEXT = 'REQUEST_TEXT',
}

export enum WorkflowConditionOperatorDto {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',

  GREATER_THAN = 'GREATER_THAN',
  GREATER_THAN_OR_EQUAL = 'GREATER_THAN_OR_EQUAL',
  LESS_THAN = 'LESS_THAN',
  LESS_THAN_OR_EQUAL = 'LESS_THAN_OR_EQUAL',

  IN = 'IN',
  NOT_IN = 'NOT_IN',

  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',

  BETWEEN = 'BETWEEN',
  IS_EMPTY = 'IS_EMPTY',
  IS_NOT_EMPTY = 'IS_NOT_EMPTY',
}

export enum WorkflowConditionValueTypeDto {
  BRANCH = 'BRANCH',
  DEPARTMENT = 'DEPARTMENT',
  DESIGNATION = 'DESIGNATION',
  EMPLOYEE_LIST = 'EMPLOYEE_LIST',

  NUMBER = 'NUMBER',
  TEXT = 'TEXT',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE',
}

export class ApprovalWorkflowConditionDto {
  @IsInt()
  @Min(1)
  conditionNo: number;

  @IsEnum(WorkflowConditionFieldDto)
  fieldKey: WorkflowConditionFieldDto;

  @IsEnum(WorkflowConditionOperatorDto)
  operator: WorkflowConditionOperatorDto;

  @IsEnum(WorkflowConditionValueTypeDto)
  valueType: WorkflowConditionValueTypeDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  departmentID?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  designationID?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  branchesID?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  employeeIDs?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  numberValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  numberValueTo?: number;

  @IsOptional()
  @IsString()
  textValue?: string;

  @IsOptional()
  @IsBoolean()
  booleanValue?: boolean;

  @IsOptional()
  @IsDateString()
  dateValue?: string;

  @IsOptional()
  @IsDateString()
  dateValueTo?: string;
}