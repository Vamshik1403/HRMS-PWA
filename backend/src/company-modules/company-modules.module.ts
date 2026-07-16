import { Module } from '@nestjs/common';
import { CompanyModulesController } from './company-modules.controller';
import { CompanyModulesService } from './company-modules.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CompanyModulesController],
  providers: [CompanyModulesService],
  exports: [CompanyModulesService],
})
export class CompanyModulesModule {}