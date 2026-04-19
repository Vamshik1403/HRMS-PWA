import { Module } from '@nestjs/common';
import { ContractorPayoutService } from './contractor-payout.service';
import { ContractorPayoutController } from './contractor-payout.controller';

@Module({
  controllers: [ContractorPayoutController],
  providers: [ContractorPayoutService],
})
export class ContractorPayoutModule {}
