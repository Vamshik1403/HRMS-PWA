import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { SalaryAllowanceService } from './salary-allowance.service';
import { CreateSalaryAllowanceDto } from './dto/create-salary-allowance.dto';
import { UpdateSalaryAllowanceDto } from './dto/update-salary-allowance.dto';

@Controller('salary-allowance')
export class SalaryAllowanceController {
  constructor(private readonly service: SalaryAllowanceService) {}

  @Post()
  create(@Body() dto: CreateSalaryAllowanceDto) {
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
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSalaryAllowanceDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
