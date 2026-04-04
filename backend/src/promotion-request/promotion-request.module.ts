import { Module } from '@nestjs/common';
import { PromotionRequestController } from './promotion-request.controller';
import { PromotionRequestService } from './promotion-request.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [PromotionRequestController],
  providers: [PromotionRequestService,PrismaService]
})
export class PromotionRequestModule {}
