import { Module } from '@nestjs/common';
import { EsslRawProcessorService } from './essl-raw-processor.service';
import { EsslRawProcessorController } from './essl-raw-processor.controller';

@Module({
  controllers: [EsslRawProcessorController],
  providers: [EsslRawProcessorService],
  exports: [EsslRawProcessorService],
})
export class EsslRawProcessorModule {}
