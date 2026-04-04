import { PartialType } from '@nestjs/mapped-types';
import { CreateEmpAttendanceRegulariseDto } from './create-emp-attendance-regularise.dto';

export class UpdateEmpAttendanceRegulariseDto extends PartialType(CreateEmpAttendanceRegulariseDto) {}
