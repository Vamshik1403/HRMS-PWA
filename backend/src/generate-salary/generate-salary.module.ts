import { Module } from '@nestjs/common';
import { GenerateSalaryService } from './generate-salary.service';
import { GenerateSalaryController } from './generate-salary.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [GenerateSalaryController],
  providers: [GenerateSalaryService,PrismaService],
})
export class GenerateSalaryModule {}
