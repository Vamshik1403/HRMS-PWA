import { IsIn, IsString, MinLength } from 'class-validator';

export class MarkAbsentDto {
  @IsString()
  @MinLength(3)
  reason!: string;

  @IsIn(['LoP', 'Sick', 'Casual'])
  leaveType!: string;
}
