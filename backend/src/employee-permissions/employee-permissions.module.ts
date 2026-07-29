import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EmployeePermissionsController } from './employee-permissions.controller';
import { EmployeePermissionsService } from './employee-permissions.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret123',
    }),
  ],
  controllers: [EmployeePermissionsController],
  providers: [EmployeePermissionsService],
  exports: [EmployeePermissionsService],
})
export class EmployeePermissionsModule {}
