import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CompanyModuleAccessController } from './company-module-access.controller';
import { CompanyModuleAccessInterceptor } from './company-module-access.interceptor';
import { CompanyModuleAccessService } from './company-module-access.service';

@Global()
@Module({
  controllers: [CompanyModuleAccessController],
  providers: [
    CompanyModuleAccessService,
    { provide: APP_INTERCEPTOR, useClass: CompanyModuleAccessInterceptor },
  ],
  exports: [CompanyModuleAccessService],
})
export class CompanyModuleAccessModule {}
