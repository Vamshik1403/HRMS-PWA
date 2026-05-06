import { PartialType } from '@nestjs/mapped-types';
import { CreateFactualWorkShiftDto } from './create-factual-work-shift.dto';

export class UpdateFactualWorkShiftDto extends PartialType(CreateFactualWorkShiftDto) {}
