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
import { FactualRosterService } from './factual-roster.service';
import { CreateFactualRosterDto } from './dto/create-factual-roster.dto';
import { UpdateFactualRosterDto } from './dto/update-factual-roster.dto';

@Controller('factual-rosters')
export class FactualRosterController {
  constructor(private readonly service: FactualRosterService) {}

  @Post()
  create(@Body() dto: CreateFactualRosterDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('serviceProviderID') serviceProviderID?: number,
    @Query('companyID') companyID?: number,
    @Query('branchesID') branchesID?: number,
    @Query('departmentID') departmentID?: number,
  ) {
    return this.service.findAll({ serviceProviderID, companyID, branchesID, departmentID });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFactualRosterDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: string) {
    return this.service.updateStatus(id, status);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
