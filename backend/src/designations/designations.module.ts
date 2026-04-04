import { Module } from '@nestjs/common';
import { DesignationsService } from './designations.service';
import { DesignationsController } from './designations.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [DesignationsController],
  providers: [DesignationsService, PrismaService],
})
export class DesignationsModule {}
