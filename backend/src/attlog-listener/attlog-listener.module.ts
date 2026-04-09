import { Module } from '@nestjs/common';
import { AttlogListenerService } from './attlog-listener.service';
import { AttlogListenerController } from './attlog-listener.controller';

@Module({
  controllers: [AttlogListenerController],
  providers: [AttlogListenerService],
})
export class AttlogListenerModule {}
