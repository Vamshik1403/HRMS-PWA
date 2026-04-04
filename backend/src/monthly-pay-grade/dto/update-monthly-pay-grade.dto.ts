import { PartialType } from '@nestjs/mapped-types';
import { CreateMonthlyPayGradeDto } from './create-monthly-pay-grade.dto';

export class UpdateMonthlyPayGradeDto extends PartialType(CreateMonthlyPayGradeDto) {}
