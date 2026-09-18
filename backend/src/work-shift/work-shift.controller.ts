import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { WorkShiftService } from './work-shift.service';
import { CreateWorkShiftDto } from './dto/create-work-shift.dto';
import { UpdateWorkShiftDto } from './dto/update-work-shift.dto';

@Controller('work-shift')
export class WorkShiftController {
  constructor(private readonly workShiftService: WorkShiftService) {}

  @Post()
  create(@Body() createWorkShiftDto: CreateWorkShiftDto) {
    return this.workShiftService.create(createWorkShiftDto);
  }

  @Get()
  findAll(@Query('companyID') companyID?: string) {
    const parsed = Number(companyID);
    const scopedId =
      Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    return this.workShiftService.findAll(scopedId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workShiftService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateWorkShiftDto: UpdateWorkShiftDto) {
    return this.workShiftService.update(+id, updateWorkShiftDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.workShiftService.remove(+id);
  }
}