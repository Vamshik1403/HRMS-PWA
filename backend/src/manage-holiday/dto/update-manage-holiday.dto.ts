import { PartialType } from '@nestjs/mapped-types';
import { CreateManageHolidayDto } from './create-manage-holiday.dto';

export class UpdateManageHolidayDto extends PartialType(CreateManageHolidayDto) {}
