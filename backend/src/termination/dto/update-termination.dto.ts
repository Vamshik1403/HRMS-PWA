import { PartialType } from '@nestjs/mapped-types';
import { CreateTerminationDto } from './create-termination.dto';

export class UpdateTerminationDto extends PartialType(CreateTerminationDto) {}
