import { Module } from '@nestjs/common';
import { EmpCurrentPositionController } from './emp-current-position.controller';
import { EmpCurrentPositionService } from './emp-current-position.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [EmpCurrentPositionController],
  providers: [EmpCurrentPositionService,PrismaService]
})
export class EmpCurrentPositionModule {}
