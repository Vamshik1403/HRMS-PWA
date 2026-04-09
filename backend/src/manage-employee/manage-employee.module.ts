import { Module } from '@nestjs/common';
import { ManageEmployeeService } from './manage-employee.service';
import { ManageEmployeeController } from './manage-employee.controller';

@Module({
  controllers: [ManageEmployeeController],
  providers: [ManageEmployeeService],
})
export class ManageEmployeeModule {}
