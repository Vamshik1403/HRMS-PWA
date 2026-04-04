import { Module } from '@nestjs/common';
import { ServiceProviderService } from './service-provider.service';
import { ServiceProviderController } from './service-provider.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ServiceProviderController],
  providers: [ServiceProviderService, PrismaService],
})
export class ServiceProviderModule {}
