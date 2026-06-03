import { Module } from '@nestjs/common';
import { ManageEmployeeService } from './manage-employee.service';
import { ManageEmployeeController } from './manage-employee.controller';
import { JoiningFormService } from './joining-form.service';

@Module({
  controllers: [ManageEmployeeController],
  providers: [ManageEmployeeService, JoiningFormService],
})
export class ManageEmployeeModule {}
