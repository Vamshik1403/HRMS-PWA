import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { EmpAttendanceRegulariseService } from './emp-attendance-regularise.service';
import { CreateEmpAttendanceRegulariseDto } from './dto/create-emp-attendance-regularise.dto';
import { UpdateEmpAttendanceRegulariseDto } from './dto/update-emp-attendance-regularise.dto';

@Controller('emp-attendance-regularise')
export class EmpAttendanceRegulariseController {
  constructor(private readonly empAttendanceRegulariseService: EmpAttendanceRegulariseService) {}

  @Post()
  create(@Body() createEmpAttendanceRegulariseDto: CreateEmpAttendanceRegulariseDto) {
    return this.empAttendanceRegulariseService.create(createEmpAttendanceRegulariseDto);
  }

  @Get()
  findAll() {
    return this.empAttendanceRegulariseService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.empAttendanceRegulariseService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateEmpAttendanceRegulariseDto: UpdateEmpAttendanceRegulariseDto) {
    return this.empAttendanceRegulariseService.update(id, updateEmpAttendanceRegulariseDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.empAttendanceRegulariseService.remove(id);
  }
}
