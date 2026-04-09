import { Module } from '@nestjs/common';
import { EmpPromotionService } from './emp-promotion.service';
import { EmpPromotionController } from './emp-promotion.controller';

@Module({
  controllers: [EmpPromotionController],
  providers: [EmpPromotionService],
})
export class EmpPromotionModule {}
