import { PartialType } from '@nestjs/mapped-types';
import { CreateCalenderDto } from './create-calender.dto';

export class UpdateCalenderDto extends PartialType(CreateCalenderDto) {}
