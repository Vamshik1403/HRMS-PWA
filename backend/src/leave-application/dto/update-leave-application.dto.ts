import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateLeaveApplicationDto } from './create-leave-application.dto';

export class UpdateLeaveApplicationDto extends PartialType(CreateLeaveApplicationDto) {
  /** Actor role for push title (SUPERADMIN, COMPANY_ADMIN, MANAGER, …). */
  @IsOptional() @IsString() actorRole?: string;
}
