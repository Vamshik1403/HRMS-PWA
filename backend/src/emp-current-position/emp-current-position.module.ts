import { Module } from '@nestjs/common';
import { EmpCurrentPositionController } from './emp-current-position.controller';
import { EmpCurrentPositionService } from './emp-current-position.service';

@Module({
  controllers: [EmpCurrentPositionController],
  providers: [EmpCurrentPositionService]
})
export class EmpCurrentPositionModule {}
