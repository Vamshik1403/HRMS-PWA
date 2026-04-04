import { PartialType } from '@nestjs/mapped-types';
import { CreateReimbursementDto } from './create-reimbursement.dto';

export class UpdateReimbursementDto extends PartialType(CreateReimbursementDto) {}
