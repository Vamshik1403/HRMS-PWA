import { IsInt, IsOptional, IsString } from 'class-validator';

export class ReplyEmployeeMemoDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  issuedBy?: string;

  @IsOptional()
  @IsString()
  issuedByRole?: string;

  @IsOptional()
  @IsInt()
  senderEmployeeId?: number;
}
