import { PartialType } from '@nestjs/mapped-types';
import { CreateLeaveApplicationRequestDto } from './create-leave-application-request.dto';

export class UpdateLeaveApplicationRequestDto extends PartialType(CreateLeaveApplicationRequestDto) {}
