import { Module } from '@nestjs/common';
import { EmployeeMemoService } from './employee-memo.service';
import { EmployeeMemoController } from './employee-memo.controller';

@Module({
  controllers: [EmployeeMemoController],
  providers: [EmployeeMemoService],
})
export class EmployeeMemoModule {}
