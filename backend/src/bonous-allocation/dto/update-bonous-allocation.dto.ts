import { PartialType } from '@nestjs/mapped-types';
import { CreateBonusAllocationDto } from './create-bonous-allocation.dto';

export class UpdateBonusAllocationDto extends PartialType(CreateBonusAllocationDto) {}
