import { Module } from '@nestjs/common';
import { TestListenerService } from './test-listener.service';
import { TestListenerController } from './test-listener.controller';

@Module({
  controllers: [TestListenerController],
  providers: [TestListenerService],
})
export class RawListenerModule {}