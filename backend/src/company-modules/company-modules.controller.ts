import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CompanyModulesService } from './company-modules.service';
import { CreateCompanyModuleDto } from './dto/create-company-module.dto';
import { UpdateCompanyModuleDto } from './dto/update-company-module.dto';
import { UpdateCompanyModuleStatusDto } from './dto/update-company-module-status.dto';

@Controller('company-modules')
export class CompanyModulesController {
  constructor(
    private readonly companyModulesService: CompanyModulesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createCompanyModuleDto: CreateCompanyModuleDto) {
    return this.companyModulesService.create(createCompanyModuleDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(
    @Query('moduleStatus', new ParseBoolPipe({ optional: true }))
    moduleStatus?: boolean,

    @Query('search')
    search?: string,
  ) {
    return this.companyModulesService.findAll(moduleStatus, search);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companyModulesService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCompanyModuleDto: UpdateCompanyModuleDto,
  ) {
    return this.companyModulesService.update(
      id,
      updateCompanyModuleDto,
    );
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateCompanyModuleStatusDto,
  ) {
    return this.companyModulesService.updateStatus(
      id,
      updateStatusDto.moduleStatus,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.companyModulesService.remove(id);
  }
}