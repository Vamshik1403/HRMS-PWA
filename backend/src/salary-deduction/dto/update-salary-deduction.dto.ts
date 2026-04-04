import { PartialType } from '@nestjs/mapped-types';
import { CreateSalaryDeductionDto } from './create-salary-deduction.dto';

export class UpdateSalaryDeductionDto extends PartialType(CreateSalaryDeductionDto) {}
