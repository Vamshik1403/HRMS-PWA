import { PartialType } from '@nestjs/mapped-types';
import { CreateEmpCurrentPositionDto } from './create-emp-current-position.dto';

export class UpdateEmpCurrentPositionDto extends PartialType(CreateEmpCurrentPositionDto) {}
