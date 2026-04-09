import { Module } from '@nestjs/common';
import { CanteenService } from './canteen.service';
import { CanteenController } from './canteen.controller';

@Module({
  controllers: [CanteenController],
  providers: [CanteenService],
})
export class CanteenModule {}
