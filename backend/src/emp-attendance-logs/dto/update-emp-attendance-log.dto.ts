import { PartialType } from '@nestjs/mapped-types';
import { CreateEmpAttendanceLogDto } from './create-emp-attendance-log.dto';

export class UpdateEmpAttendanceLogDto extends PartialType(CreateEmpAttendanceLogDto) {}
