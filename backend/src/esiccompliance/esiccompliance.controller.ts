import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ESICComplianceService } from './esiccompliance.service';
import { CreateESICComplianceDto } from './dto/create-esiccompliance.dto';
import { UpdateESICComplianceDto } from './dto/update-esiccompliance.dto';

@Controller('esic-compliance')
export class ESICComplianceController {
  constructor(private service: ESICComplianceService) {}

  @Post()
  create(@Body() dto: CreateESICComplianceDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':companyID')
  findOne(@Param('companyID', ParseIntPipe) companyID: number) {
    return this.service.findByCompany(companyID);
  }

  @Patch(':companyID')
  update(
    @Param('companyID', ParseIntPipe) companyID: number,
    @Body() dto: UpdateESICComplianceDto,
  ) {
    return this.service.update(companyID, dto);
  }

  @Delete(':companyID')
  remove(@Param('companyID', ParseIntPipe) companyID: number) {
    return this.service.remove(companyID);
  }
}