import { Module } from '@nestjs/common';
import { ContractorsService } from './contractors.service';
import { ContractorsController } from './contractors.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ContractorsController],
  providers: [ContractorsService,PrismaService],
})
export class ContractorsModule {}
