import { Module } from '@nestjs/common';
import { BonusAllocationService } from './bonous-allocation.service';
import { BonousAllocationController } from './bonous-allocation.controller';

@Module({
  controllers: [BonousAllocationController],
  providers: [BonusAllocationService],
})
export class BonousAllocationModule {}
