import { Module } from '@nestjs/common';
import { ProcessAttLogsService } from './process_att_logs.service';
import { ProcessAttLogsController } from './process_att_logs.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ProcessAttLogsController],
  providers: [ProcessAttLogsService,PrismaService],
})
export class ProcessAttLogsModule {}
