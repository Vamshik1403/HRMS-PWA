import { PartialType } from '@nestjs/mapped-types';
import { CreateFactualRosterDto } from './create-factual-roster.dto';

export class UpdateFactualRosterDto extends PartialType(CreateFactualRosterDto) {}
