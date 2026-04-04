import { Module } from '@nestjs/common';
import { TestListenerController } from '../test-listener/test-listener.controller';
import { TestListenerService } from '../test-listener/test-listener.service';
import { RawPingController } from './raw-ping.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
    imports:[PrismaModule],
  controllers: [
    RawPingController,         
    TestListenerController,   
  ],
  providers: [TestListenerService],
})
export class RawListenerModule {}
