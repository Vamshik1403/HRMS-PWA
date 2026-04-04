import { PartialType } from '@nestjs/mapped-types';
import { CreateHourlyPayGradeDto } from './create-hourly-grade.dto';

export class UpdateHourlyPayGradeDto extends PartialType(CreateHourlyPayGradeDto) {}
