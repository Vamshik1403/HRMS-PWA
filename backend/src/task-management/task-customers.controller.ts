import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { TaskCustomersService } from './task-customers.service';
import { CreateTaskCustomerDto } from './dto/create-task-customer.dto';
import { UpdateTaskCustomerDto } from './dto/update-task-customer.dto';

@Controller('task-customers')
export class TaskCustomersController {
  constructor(private readonly service: TaskCustomersService) {}

  @Get()
  findAll(@Query() query: Record<string, string>) {
    return this.service.findAll(query);
  }

  @Get('dropdown')
  dropdown(@Query() query: Record<string, string>) {
    return this.service.dropdown(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Query() query: Record<string, string>) {
    return this.service.findOne(id, query);
  }

  @Post()
  create(@Body() dto: CreateTaskCustomerDto, @Query() query: Record<string, string>) {
    return this.service.create(dto, query);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskCustomerDto,
    @Query() query: Record<string, string>,
  ) {
    return this.service.update(id, dto, query);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Query() query: Record<string, string>) {
    return this.service.remove(id, query);
  }
}
