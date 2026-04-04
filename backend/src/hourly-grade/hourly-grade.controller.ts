import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { CreateHourlyPayGradeDto } from './dto/create-hourly-grade.dto';
import { UpdateHourlyPayGradeDto } from './dto/update-hourly-grade.dto';
import { HourlyPayGradeService } from './hourly-grade.service';


@Controller('hourly-pay-grade')
export class HourlyPayGradeController {
  constructor(private readonly service: HourlyPayGradeService) {}

  @Post()
  create(@Body() dto: CreateHourlyPayGradeDto) {
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
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHourlyPayGradeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
