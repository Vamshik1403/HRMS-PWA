import { PartialType } from '@nestjs/mapped-types';
import { CreatePrivilegedLeaveDto } from './create-privileged-leave.dto';

export class UpdatePrivilegedLeaveDto extends PartialType(CreatePrivilegedLeaveDto) {}
