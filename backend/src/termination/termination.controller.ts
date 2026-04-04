import { Controller, Post, Put, Param, Body, ParseIntPipe, Get } from '@nestjs/common';
import { TerminationService } from './termination.service';
import { CreateTerminationDto } from './dto/create-termination.dto';
import { ApproveTerminationDto } from './dto/approve-termination.dto';

@Controller('termination')
export class TerminationController {
  constructor(private readonly service: TerminationService) {}

  @Post()
  create(@Body() dto: CreateTerminationDto) {
    return this.service.create(dto);
  }

  @Put(':id/approve')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveTerminationDto,
  ) {
    return this.service.approve(id, dto);
  }

  @Put(':id/final-settle')
  finalSettle(@Param('id', ParseIntPipe) id: number) {
    return this.service.finalSettle(id);
  }

  @Put(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.service.cancel(id);
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id); 
  }

  @Get()
  
  getAll() {
    return this.service.findAll();
  }
}
