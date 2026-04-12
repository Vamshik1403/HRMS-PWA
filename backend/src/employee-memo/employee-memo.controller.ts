import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { EmployeeMemoService } from './employee-memo.service';
import { CreateEmployeeMemoDto } from './dto/create-employee-memo.dto';
import { UpdateEmployeeMemoDto } from './dto/update-employee-memo.dto';

@Controller('employee-memo')
export class EmployeeMemoController {
  constructor(private readonly service: EmployeeMemoService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateEmployeeMemoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeeMemoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
