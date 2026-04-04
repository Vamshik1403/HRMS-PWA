import { PartialType } from '@nestjs/mapped-types';
import { CreatePTComplianceDto } from './create-ptcompliance.dto';

export class UpdatePTComplianceDto extends PartialType(CreatePTComplianceDto) {}