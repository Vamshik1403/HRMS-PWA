import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateReimbursementDto } from './create-reimbursement.dto';

export class UpdateReimbursementDto extends PartialType(CreateReimbursementDto) {
  @IsOptional() @IsString() actorRole?: string;
}
