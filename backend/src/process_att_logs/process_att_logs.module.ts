import { Module } from '@nestjs/common';
import { ProcessAttLogsService } from './process_att_logs.service';
import { ProcessAttLogsController } from './process_att_logs.controller';

@Module({
  controllers: [ProcessAttLogsController],
  providers: [ProcessAttLogsService],
})
export class ProcessAttLogsModule {}
