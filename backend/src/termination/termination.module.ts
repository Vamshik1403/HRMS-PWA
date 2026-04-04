import { Module } from '@nestjs/common';
import { TerminationService } from './termination.service';
import { TerminationController } from './termination.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [TerminationController],
  providers: [TerminationService,PrismaService],
})
export class TerminationModule {}
