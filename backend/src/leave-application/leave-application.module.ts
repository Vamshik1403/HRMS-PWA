import { Module } from '@nestjs/common';
import { LeaveApplicationService } from './leave-application.service';
import { LeaveApplicationController } from './leave-application.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LeaveApplicationController],
  providers: [LeaveApplicationService],
})
export class LeaveApplicationModule {}
