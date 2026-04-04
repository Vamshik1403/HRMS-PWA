import { PartialType } from '@nestjs/mapped-types';
import { CreateEmployeeHolidayOverrideDto } from './create-employee-holiday-override.dto';

export class UpdateEmployeeHolidayOverrideDto extends PartialType(CreateEmployeeHolidayOverrideDto) {}
