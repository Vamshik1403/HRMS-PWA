import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ComplianceRulesService } from './compliance-rules.service';
import { CreateComplianceRuleDto } from './dto/create-compliance-rule.dto';
import { UpdateComplianceRuleDto } from './dto/update-compliance-rule.dto';

@Controller('compliance-rules')
export class ComplianceRulesController {
  constructor(private readonly service: ComplianceRulesService) {}

  @Post()
  create(@Body() dto: CreateComplianceRuleDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query('companyID') companyID?: string) {
    return this.service.findAll(companyID ? Number(companyID) : undefined);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateComplianceRuleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
