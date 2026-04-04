import { Module } from '@nestjs/common';
import { ReimbursementService } from './reimbursement.service';
import { ReimbursementController } from './reimbursement.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ReimbursementController],
  providers: [ReimbursementService,PrismaService],
})
export class ReimbursementModule {}
