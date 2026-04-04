import { PartialType } from '@nestjs/mapped-types';
import { CreateEmpAttendanceSyncDto } from './create-emp-attendance-sync.dto';

export class UpdateEmpAttendanceSyncDto extends PartialType(CreateEmpAttendanceSyncDto) {}
