import { PartialType } from '@nestjs/mapped-types';
import { CreatePFComplianceDto } from './create-pfcompliance.dto';

export class UpdatePFComplianceDto extends PartialType(CreatePFComplianceDto) {}
