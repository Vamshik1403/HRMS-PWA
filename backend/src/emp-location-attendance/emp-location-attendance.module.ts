import { Module } from '@nestjs/common';
import { EmpLocationAttendanceController } from './emp-location-attendance.controller';
import { EmpLocationAttendanceService } from './emp-location-attendance.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret123',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [EmpLocationAttendanceController],
  providers: [EmpLocationAttendanceService, JwtStrategy],
})
export class EmpLocationAttendanceModule {}
