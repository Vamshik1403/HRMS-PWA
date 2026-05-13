import { Module } from '@nestjs/common';
import { EmpLeaveBalanceService } from './emp-leave-balance.service';
import { EmpLeaveBalanceController } from './emp-leave-balance.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [EmpLeaveBalanceService],
  controllers: [EmpLeaveBalanceController],
  exports: [EmpLeaveBalanceService],
})
export class EmpLeaveBalanceModule {}
