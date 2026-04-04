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
import { LeaveApplicationService } from './leave-application.service';
import { CreateLeaveApplicationDto } from './dto/create-leave-application.dto';
import { UpdateLeaveApplicationDto } from './dto/update-leave-application.dto';

@Controller('leave-application')
export class LeaveApplicationController {
  constructor(private readonly leaveApplicationService: LeaveApplicationService) {}


  @Post()
  create(@Body() createLeaveApplicationDto: CreateLeaveApplicationDto) {
    return this.leaveApplicationService.create(createLeaveApplicationDto);
  }

  
    @Get('employee/:empId')
  findByEmployee(@Param('empId', ParseIntPipe) empId: number) {
    return this.leaveApplicationService.findByEmployee(empId);
  }

  
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.leaveApplicationService.findOne(id);
  }

  @Get()
  findAll() {
    return this.leaveApplicationService.findAll();
  }

  

  @Patch('revoke/:id')
  async revokeLeave(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { revokedReason?: string },
  ) {
    return this.leaveApplicationService.revokeLeave(id, body.revokedReason);
  }


  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLeaveApplicationDto: UpdateLeaveApplicationDto,
  ) {
    return this.leaveApplicationService.update(id, updateLeaveApplicationDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.leaveApplicationService.remove(id);
  }
}
