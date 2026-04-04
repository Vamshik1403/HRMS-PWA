// src/generate-salary/generate-salary.controller.ts
import {
  Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe,
} from '@nestjs/common';
import { GenerateSalaryService } from './generate-salary.service';
import { CreateGenerateSalaryDto } from './dto/create-generate-salary.dto';
import { UpdateGenerateSalaryDto } from './dto/update-generate-salary.dto';

@Controller('generate-salary')
export class GenerateSalaryController {
  constructor(private readonly service: GenerateSalaryService) {}

  @Post()
  create(@Body() dto: CreateGenerateSalaryDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGenerateSalaryDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
