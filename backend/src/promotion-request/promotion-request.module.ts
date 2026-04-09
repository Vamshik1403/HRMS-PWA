import { Module } from '@nestjs/common';
import { PromotionRequestController } from './promotion-request.controller';
import { PromotionRequestService } from './promotion-request.service';

@Module({
  controllers: [PromotionRequestController],
  providers: [PromotionRequestService]
})
export class PromotionRequestModule {}
