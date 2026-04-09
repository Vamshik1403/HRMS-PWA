import { Module } from '@nestjs/common';
import { TerminationService } from './termination.service';
import { TerminationController } from './termination.controller';

@Module({
  controllers: [TerminationController],
  providers: [TerminationService],
})
export class TerminationModule {}
