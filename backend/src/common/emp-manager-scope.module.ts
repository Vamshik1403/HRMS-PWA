import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmpManagerScopeController } from './emp-manager-scope.controller';
import { EmpManagerScopeService } from './emp-manager-scope.service';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [EmpManagerScopeController],
  providers: [EmpManagerScopeService],
  exports: [EmpManagerScopeService],
})
export class EmpManagerScopeModule {}
