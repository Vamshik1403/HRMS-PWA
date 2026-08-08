import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmpLocationAttendanceModule } from '../emp-location-attendance/emp-location-attendance.module';
import { EmpManagerScopeController } from './emp-manager-scope.controller';
import { EmpManagerScopeService } from './emp-manager-scope.service';
import { MailModule } from '../mail/mail.module';

@Global()
@Module({
  imports: [PrismaModule, EmpLocationAttendanceModule, MailModule],
  controllers: [EmpManagerScopeController],
  providers: [EmpManagerScopeService],
  exports: [EmpManagerScopeService],
})
export class EmpManagerScopeModule {}
