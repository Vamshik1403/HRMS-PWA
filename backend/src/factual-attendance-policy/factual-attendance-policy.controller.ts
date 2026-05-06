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
import { FactualAttendancePolicyService } from './factual-attendance-policy.service';
import { CreateFactualAttendancePolicyDto } from './dto/create-factual-attendance-policy.dto';
import { UpdateFactualAttendancePolicyDto } from './dto/update-factual-attendance-policy.dto';

@Controller('factual-attendance-policy')
export class FactualAttendancePolicyController {
  constructor(private readonly service: FactualAttendancePolicyService) {}

  @Post()
  create(@Body() dto: CreateFactualAttendancePolicyDto) {
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
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFactualAttendancePolicyDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
