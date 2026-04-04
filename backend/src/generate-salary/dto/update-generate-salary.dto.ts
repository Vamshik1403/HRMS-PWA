// src/generate-salary/dto/update-generate-salary.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateGenerateSalaryDto } from './create-generate-salary.dto';

export class UpdateGenerateSalaryDto extends PartialType(CreateGenerateSalaryDto) {}
