import { PartialType } from '@nestjs/mapped-types';
import { CreateSalaryCycleDto } from './create-salary-cycle.dto';

export class UpdateSalaryCycleDto extends PartialType(CreateSalaryCycleDto) {}
