import { PartialType } from '@nestjs/mapped-types';
import { CreateEmpFieldSiteAttendanceDto } from './create-emp-field-site-attendance.dto';

export class UpdateEmpFieldSiteAttendanceDto extends PartialType(CreateEmpFieldSiteAttendanceDto) {}
