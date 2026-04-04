import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { EmployeeWeeklyOffService } from './employee-weekly-off.service';
import { CreateEmployeeWeeklyOffDto } from './dto/create-employee-weekly-off.dto';
import { UpdateEmployeeWeeklyOffDto } from './dto/update-employee-weekly-off.dto';

@Controller('employee-weekly-off')
export class EmployeeWeeklyOffController {
  constructor(private readonly service: EmployeeWeeklyOffService) {}

  @Post()
  create(@Body() dto: CreateEmployeeWeeklyOffDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get('employee/:employeeId')
  findByEmployee(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return this.service.findByEmployee(employeeId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeWeeklyOffDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
