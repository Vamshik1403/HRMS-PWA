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
import { PFComplianceService } from './pfcompliance.service';
import { CreatePFComplianceDto } from './dto/create-pfcompliance.dto';
import { UpdatePFComplianceDto } from './dto/update-pfcompliance.dto';

@Controller('pf-compliance')
export class PFComplianceController {
  constructor(private service: PFComplianceService) {}

  @Post()
  create(@Body() dto: CreatePFComplianceDto) {
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
    @Body() dto: UpdatePFComplianceDto,
  ) {
    return this.service.update(companyID, dto);
  }

  @Delete(':companyID')
  remove(@Param('companyID', ParseIntPipe) companyID: number) {
    return this.service.remove(companyID);
  }
}
