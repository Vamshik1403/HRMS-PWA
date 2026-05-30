import { IsString, MinLength } from 'class-validator';

export class MarkAbsentDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
