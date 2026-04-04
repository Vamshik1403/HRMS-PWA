import { PartialType } from '@nestjs/mapped-types';
import { CreateSalaryAllowanceDto } from './create-salary-allowance.dto';

export class UpdateSalaryAllowanceDto extends PartialType(CreateSalaryAllowanceDto) {}
