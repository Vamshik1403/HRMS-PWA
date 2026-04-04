import { PartialType } from '@nestjs/mapped-types';
import { CreateSalaryAdvanceRepaymentDto } from './create-salary-advance-repayment.dto';

export class UpdateSalaryAdvanceRepaymentDto extends PartialType(CreateSalaryAdvanceRepaymentDto) {}
