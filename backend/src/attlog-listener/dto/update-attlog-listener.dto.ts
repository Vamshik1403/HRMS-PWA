import { PartialType } from '@nestjs/mapped-types';
import { CreateAttlogListenerDto } from './create-attlog-listener.dto';

export class UpdateAttlogListenerDto extends PartialType(CreateAttlogListenerDto) {}
