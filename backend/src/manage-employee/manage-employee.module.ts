import { Module } from '@nestjs/common';
import { ManageEmployeeService } from './manage-employee.service';
import { ManageEmployeeController } from './manage-employee.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ManageEmployeeController],
  providers: [ManageEmployeeService,PrismaService],
})
export class ManageEmployeeModule {}
