import { Module } from '@nestjs/common';
import { TestListenerService } from './test-listener.service';
import { TestListenerController } from './test-listener.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [TestListenerController],
  providers: [TestListenerService, PrismaService],
})
export class RawListenerModule {}