import { PartialType } from '@nestjs/mapped-types';
import { CreateESICComplianceDto } from './create-esiccompliance.dto';

export class UpdateESICComplianceDto extends PartialType(CreateESICComplianceDto) {}