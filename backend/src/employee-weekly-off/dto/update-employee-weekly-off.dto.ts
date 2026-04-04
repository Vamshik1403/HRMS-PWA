import { PartialType } from '@nestjs/mapped-types';
import { CreateEmployeeWeeklyOffDto } from './create-employee-weekly-off.dto';

export class UpdateEmployeeWeeklyOffDto extends PartialType(CreateEmployeeWeeklyOffDto) {}
