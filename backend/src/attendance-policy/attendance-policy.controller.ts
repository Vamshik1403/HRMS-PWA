import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AttendancePolicyService } from './attendance-policy.service';
import { CreateAttendancePolicyDto } from './dto/create-attendance-policy.dto';
import { UpdateAttendancePolicyDto } from './dto/update-attendance-policy.dto';

@Controller('attendance-policy')
export class AttendancePolicyController {
  constructor(private readonly attendancePolicyService: AttendancePolicyService) {}

  @Post()
  create(@Body() createAttendancePolicyDto: CreateAttendancePolicyDto) {
    return this.attendancePolicyService.create(createAttendancePolicyDto);
  }

  @Get()
  findAll() {
    return this.attendancePolicyService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.attendancePolicyService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAttendancePolicyDto: UpdateAttendancePolicyDto) {
    return this.attendancePolicyService.update(+id, updateAttendancePolicyDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.attendancePolicyService.remove(+id);
  }
}
