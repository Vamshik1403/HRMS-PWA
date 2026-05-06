import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { FactualWorkShiftService } from './factual-work-shift.service';
import { CreateFactualWorkShiftDto } from './dto/create-factual-work-shift.dto';
import { UpdateFactualWorkShiftDto } from './dto/update-factual-work-shift.dto';

@Controller('factual-work-shift')
export class FactualWorkShiftController {
  constructor(private readonly service: FactualWorkShiftService) {}

  @Post()
  create(@Body() dto: CreateFactualWorkShiftDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('serviceProviderID') serviceProviderID?: number,
    @Query('companyID') companyID?: number,
    @Query('branchesID') branchesID?: number,
  ) {
    return this.service.findAll({ serviceProviderID, companyID, branchesID });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFactualWorkShiftDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
