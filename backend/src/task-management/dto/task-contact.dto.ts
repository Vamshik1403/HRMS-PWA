import { IsOptional, IsString } from 'class-validator';

export class TaskContactDto {
  @IsString() contactPerson!: string;
  @IsString() contactNumber!: string;
  @IsOptional() @IsString() designation?: string;
  @IsOptional() @IsString() email?: string;
}
