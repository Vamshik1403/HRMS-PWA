import { Module } from '@nestjs/common';
import { BankDetailsService } from './bank-details.service';
import { BankDetailsController } from './bank-details.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [BankDetailsController],
  providers: [BankDetailsService, PrismaService],
})
export class BankDetailsModule {}
