import { PartialType } from '@nestjs/mapped-types';
import { CreateEmployeeMemoDto } from './create-employee-memo.dto';

export class UpdateEmployeeMemoDto extends PartialType(CreateEmployeeMemoDto) {}
