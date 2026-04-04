import { Module } from '@nestjs/common';
import { EmpPromotionService } from './emp-promotion.service';
import { EmpPromotionController } from './emp-promotion.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [EmpPromotionController],
  providers: [EmpPromotionService,PrismaService],
})
export class EmpPromotionModule {}
