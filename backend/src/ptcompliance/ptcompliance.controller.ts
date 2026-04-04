import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CreatePTComplianceDto } from './dto/create-ptcompliance.dto';
import { UpdatePTComplianceDto } from './dto/update-ptcompliance.dto';
import { PTComplianceService } from './ptcompliance.service';

@Controller('pt-compliance')
export class PTComplianceController {
  constructor(private service: PTComplianceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePTComplianceDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('company/:companyID')
  findByCompany(@Param('companyID', ParseIntPipe) companyID: number) {
    return this.service.findByCompany(companyID);
  }

  @Get('branch/:branchID')
  findByBranch(@Param('branchID', ParseIntPipe) branchID: number) {
    return this.service.findByBranch(branchID);
  }

  @Get(':companyID/:branchID')
  findOne(
    @Param('companyID', ParseIntPipe) companyID: number,
    @Param('branchID', ParseIntPipe) branchID: number,
  ) {
    return this.service.findByCompanyAndBranch(companyID, branchID);
  }

  @Patch(':companyID/:branchID')
  update(
    @Param('companyID', ParseIntPipe) companyID: number,
    @Param('branchID', ParseIntPipe) branchID: number,
    @Body() dto: UpdatePTComplianceDto,
  ) {
    return this.service.update(companyID, branchID, dto);
  }

  @Delete(':companyID/:branchID')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('companyID', ParseIntPipe) companyID: number,
    @Param('branchID', ParseIntPipe) branchID: number,
  ) {
    await this.service.remove(companyID, branchID);
  }
}