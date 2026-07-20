import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class RejectApprovalRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  remark: string;
}