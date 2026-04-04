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
import { EmployeeHolidayOverrideService } from './employee-holiday-override.service';
import { CreateEmployeeHolidayOverrideDto } from './dto/create-employee-holiday-override.dto';
import { UpdateEmployeeHolidayOverrideDto } from './dto/update-employee-holiday-override.dto';

@Controller('employee-holiday-override')
export class EmployeeHolidayOverrideController {
  constructor(private readonly service: EmployeeHolidayOverrideService) {}

  @Post()
  create(@Body() dto: CreateEmployeeHolidayOverrideDto) {
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
    @Body() dto: UpdateEmployeeHolidayOverrideDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
