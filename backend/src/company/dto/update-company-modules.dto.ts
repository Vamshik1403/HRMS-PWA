import { IsArray, IsBoolean, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CompanyModuleSelectionDto {
  @Type(() => Number)
  @IsInt()
  moduleID: number;

  @IsBoolean()
  isEnabled: boolean;
}

export class UpdateCompanyModulesDto {
  @IsArray()
  modules: CompanyModuleSelectionDto[];
}