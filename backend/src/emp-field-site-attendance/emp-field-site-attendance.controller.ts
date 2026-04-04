import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { EmpFieldSiteAttendanceService } from './emp-field-site-attendance.service';
import { CreateEmpFieldSiteAttendanceDto } from './dto/create-emp-field-site-attendance.dto';
import { UpdateEmpFieldSiteAttendanceDto } from './dto/update-emp-field-site-attendance.dto';

@Controller('emp-field-site-attendance')
export class EmpFieldSiteAttendanceController {
  constructor(private readonly empFieldSiteAttendanceService: EmpFieldSiteAttendanceService) {}

  @Post()
  create(@Body() createEmpFieldSiteAttendanceDto: CreateEmpFieldSiteAttendanceDto) {
    return this.empFieldSiteAttendanceService.create(createEmpFieldSiteAttendanceDto);
  }

  @Get()
  findAll() {
    return this.empFieldSiteAttendanceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.empFieldSiteAttendanceService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateEmpFieldSiteAttendanceDto: UpdateEmpFieldSiteAttendanceDto) {
    return this.empFieldSiteAttendanceService.update(id, updateEmpFieldSiteAttendanceDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.empFieldSiteAttendanceService.remove(id);
  }
}
