import { Module } from '@nestjs/common';
import { EmpAttendanceRegulariseService } from './emp-attendance-regularise.service';
import { EmpAttendanceRegulariseController } from './emp-attendance-regularise.controller';

@Module({
  controllers: [EmpAttendanceRegulariseController],
  providers: [EmpAttendanceRegulariseService],
})
export class EmpAttendanceRegulariseModule {}
