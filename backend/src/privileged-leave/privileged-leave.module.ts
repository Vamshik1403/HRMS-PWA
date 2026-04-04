import { Module } from '@nestjs/common';
import { PrivilegedLeaveService } from './privileged-leave.service';
import { PrivilegedLeaveController } from './privileged-leave.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PrivilegedLeaveController],
  providers: [PrivilegedLeaveService],
})
export class PrivilegedLeaveModule {}
