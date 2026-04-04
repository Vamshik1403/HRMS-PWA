// src/process-att-logs/dto/update-process_att_log.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateProcessAttLogDto } from './create-process_att_log.dto';

export class UpdateProcessAttLogDto extends PartialType(CreateProcessAttLogDto) {}