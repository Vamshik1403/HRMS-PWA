import { PartialType } from '@nestjs/mapped-types';
import { CreateFactualAttendancePolicyDto } from './create-factual-attendance-policy.dto';

export class UpdateFactualAttendancePolicyDto extends PartialType(CreateFactualAttendancePolicyDto) {}
