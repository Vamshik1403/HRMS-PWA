import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ManageEmployeeService } from './manage-employee.service';
import { ManageEmployeeController } from './manage-employee.controller';
import { JoiningFormService } from './joining-form.service';

@Module({
  imports: [AuthModule],
  controllers: [ManageEmployeeController],
  providers: [ManageEmployeeService, JoiningFormService],
})
export class ManageEmployeeModule {}
