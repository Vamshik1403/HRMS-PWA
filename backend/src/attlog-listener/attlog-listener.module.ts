import { Module } from '@nestjs/common';
import { AttlogListenerService } from './attlog-listener.service';
import { AttlogListenerController } from './attlog-listener.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [AttlogListenerController],
  providers: [AttlogListenerService,PrismaService],
})
export class AttlogListenerModule {}
