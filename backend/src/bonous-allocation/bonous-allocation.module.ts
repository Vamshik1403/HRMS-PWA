import { Module } from '@nestjs/common';
import { BonusAllocationService } from './bonous-allocation.service';
import { BonousAllocationController } from './bonous-allocation.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [BonousAllocationController],
  providers: [BonusAllocationService,PrismaService],
})
export class BonousAllocationModule {}
