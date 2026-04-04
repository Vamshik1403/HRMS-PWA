import { PartialType } from '@nestjs/mapped-types';
import { CreateDesignationsDto } from './create-designation.dto';

export class UpdateDesignationsDto extends PartialType(CreateDesignationsDto) {}
