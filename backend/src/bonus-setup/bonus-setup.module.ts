import { Module } from '@nestjs/common';
import { BonusSetupService } from './bonus-setup.service';
import { BonusSetupController } from './bonus-setup.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [BonusSetupController],
  providers: [BonusSetupService,PrismaService],
})
export class BonusSetupModule {}
