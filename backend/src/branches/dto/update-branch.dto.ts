import { PartialType } from '@nestjs/mapped-types';
import { CreateBranchesDto, BankDetailCreateDto } from './create-branch.dto';
import { IsArray, IsInt, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BankDetailUpdateDto extends BankDetailCreateDto {
  @IsOptional() @IsInt() id?: number; // present when updating existing bank row
}

export class UpdateBranchesDto extends PartialType(CreateBranchesDto) {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankDetailUpdateDto)
  bankDetails?: BankDetailUpdateDto[];

  // optional: ids the UI removed
  @IsOptional()
  @IsArray()
  idsToDelete?: number[];
}
