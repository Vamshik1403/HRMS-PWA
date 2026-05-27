import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { TaskCustomerSitesService } from './task-customer-sites.service';
import { CreateTaskCustomerSiteDto } from './dto/create-task-customer-site.dto';
import { UpdateTaskCustomerSiteDto } from './dto/update-task-customer-site.dto';

@Controller('task-customer-sites')
export class TaskCustomerSitesController {
  constructor(private readonly service: TaskCustomerSitesService) {}

  @Get()
  findAll(@Query() query: Record<string, string>) {
    return this.service.findAll(query);
  }

  @Get('dropdown')
  dropdown(@Query() query: Record<string, string>) {
    return this.service.dropdown(query);
  }

  @Get('by-customer/:customerId')
  findByCustomer(@Param('customerId', ParseIntPipe) customerId: number, @Query() query: Record<string, string>) {
    return this.service.findByCustomer(customerId, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Query() query: Record<string, string>) {
    return this.service.findOne(id, query);
  }

  @Post()
  create(@Body() dto: CreateTaskCustomerSiteDto, @Query() query: Record<string, string>) {
    return this.service.create(dto, query);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskCustomerSiteDto,
    @Query() query: Record<string, string>,
  ) {
    return this.service.update(id, dto, query);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Query() query: Record<string, string>) {
    return this.service.remove(id, query);
  }
}
