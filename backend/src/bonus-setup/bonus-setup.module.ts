import { Module } from '@nestjs/common';
import { BonusSetupService } from './bonus-setup.service';
import { BonusSetupController } from './bonus-setup.controller';

@Module({
  controllers: [BonusSetupController],
  providers: [BonusSetupService],
})
export class BonusSetupModule {}
