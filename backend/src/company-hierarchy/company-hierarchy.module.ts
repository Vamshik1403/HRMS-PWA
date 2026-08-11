import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CompanyHierarchyService } from './company-hierarchy.service';
import { CompanyHierarchyController } from './company-hierarchy.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CompanyHierarchyController],
  providers: [CompanyHierarchyService],
  exports: [CompanyHierarchyService],
})
export class CompanyHierarchyModule {}
