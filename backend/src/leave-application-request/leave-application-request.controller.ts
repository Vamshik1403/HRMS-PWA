import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { LeaveApplicationRequestService } from './leave-application-request.service';
import { CreateLeaveApplicationRequestDto } from './dto/create-leave-application-request.dto';
import { UpdateLeaveApplicationRequestDto } from './dto/update-leave-application-request.dto';

@Controller('leave-application-request')
export class LeaveApplicationRequestController {
  constructor(private readonly service: LeaveApplicationRequestService) {}

  @Post()
  create(@Body() createDto: CreateLeaveApplicationRequestDto) {
    return this.service.create(createDto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateLeaveApplicationRequestDto) {
    return this.service.update(+id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
