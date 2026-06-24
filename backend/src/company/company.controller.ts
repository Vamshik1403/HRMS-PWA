import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanyModulesDto } from './dto/update-company-modules.dto';

@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companyService.create(dto);
  }

  // ✅ dynamic routes after fixed routes
  @Get(':id/modules')
  getCompanyModules(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.getCompanyModules(id);
  }

  @Get()
  findAll() {
    return this.companyService.findAll();
  }

  // ✅ fixed/static routes first
  @Get('modules/all')
  getAllModules() {
    return this.companyService.getAllModules();
  }

  @Post('modules/seed-default')
  seedDefaultModules() {
    return this.companyService.seedDefaultModules();
  }

  

   @Put(':id/modules')
  updateCompanyModules(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyModulesDto,
  ) {
    return this.companyService.updateCompanyModules(id, dto.modules);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companyService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.remove(id);
  }
}