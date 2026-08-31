import { IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTaskAssigneeLinksDto {
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  linkedCompanyIDs: number[];
}
