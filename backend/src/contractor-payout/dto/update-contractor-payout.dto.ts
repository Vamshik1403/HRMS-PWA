import { PartialType } from '@nestjs/mapped-types';
import { CreateContractorPayoutDto } from './create-contractor-payout.dto';

export class UpdateContractorPayoutDto extends PartialType(CreateContractorPayoutDto) {}
