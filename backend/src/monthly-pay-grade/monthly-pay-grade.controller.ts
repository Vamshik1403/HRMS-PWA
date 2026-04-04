import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { MonthlyPayGradeService } from './monthly-pay-grade.service';
import { CreateMonthlyPayGradeDto } from './dto/create-monthly-pay-grade.dto';
import { UpdateMonthlyPayGradeDto } from './dto/update-monthly-pay-grade.dto';

@Controller('monthly-pay-grade')
export class MonthlyPayGradeController {
  constructor(private readonly service: MonthlyPayGradeService) {}

  @Post()
  create(@Body() dto: CreateMonthlyPayGradeDto) {
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
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMonthlyPayGradeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
