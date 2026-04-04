import { Module } from '@nestjs/common';
import { CanteenService } from './canteen.service';
import { CanteenController } from './canteen.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [CanteenController],
  providers: [CanteenService, PrismaService],
})
export class CanteenModule {}
