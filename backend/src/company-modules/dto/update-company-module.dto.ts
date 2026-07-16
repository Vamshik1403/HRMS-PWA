import { PartialType } from '@nestjs/mapped-types';
import { CreateCompanyModuleDto } from './create-company-module.dto';

export class UpdateCompanyModuleDto extends PartialType(
  CreateCompanyModuleDto,
) {}