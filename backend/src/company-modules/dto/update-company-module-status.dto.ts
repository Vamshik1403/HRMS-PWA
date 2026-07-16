import { IsBoolean } from 'class-validator';

export class UpdateCompanyModuleStatusDto {
  @IsBoolean()
  moduleStatus: boolean;
}