import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { EmpCurrentPositionService } from './emp-current-position.service';
import { CreateEmpCurrentPositionDto } from './dto/create-emp-current-position.dto';
import { UpdateEmpCurrentPositionDto } from './dto/update-emp-current-position.dto';

@Controller('emp-current-position')
export class EmpCurrentPositionController {
  constructor(private readonly service: EmpCurrentPositionService) {}

  @Post()
  create(@Body() dto: CreateEmpCurrentPositionDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('manageEmployeeID') manageEmployeeID?: number,
  ) {
    return this.service.findAll({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      manageEmployeeID: manageEmployeeID ? Number(manageEmployeeID) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmpCurrentPositionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
