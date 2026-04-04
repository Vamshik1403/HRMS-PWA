import { PartialType } from '@nestjs/mapped-types';
import { CreateBonusSetupDto } from './create-bonus-setup.dto';

export class UpdateBonusSetupDto extends PartialType(CreateBonusSetupDto) {}
