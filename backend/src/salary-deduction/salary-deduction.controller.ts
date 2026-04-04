import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { SalaryDeductionService } from './salary-deduction.service';
import { CreateSalaryDeductionDto } from './dto/create-salary-deduction.dto';
import { UpdateSalaryDeductionDto } from './dto/update-salary-deduction.dto';

@Controller('salary-deduction')
export class SalaryDeductionController {
  constructor(private readonly service: SalaryDeductionService) {}

  @Post()
  create(@Body() dto: CreateSalaryDeductionDto) {
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
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSalaryDeductionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
