import { PartialType } from '@nestjs/mapped-types';
import { CreateBankDetailsDto } from './create-bank-detail.dto';

export class UpdateBankDetailsDto extends PartialType(CreateBankDetailsDto) {}
