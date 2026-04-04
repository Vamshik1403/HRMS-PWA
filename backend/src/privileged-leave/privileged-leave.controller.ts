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
import { PrivilegedLeaveService } from './privileged-leave.service';
import { CreatePrivilegedLeaveDto } from './dto/create-privileged-leave.dto';
import { UpdatePrivilegedLeaveDto } from './dto/update-privileged-leave.dto';

@Controller('privileged-leave')
export class PrivilegedLeaveController {
  constructor(private readonly service: PrivilegedLeaveService) {}

  @Post()
  create(@Body() dto: CreatePrivilegedLeaveDto) {
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

  @Get('balance/:employeeId')
  getBalance(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return this.service.getBalance(employeeId);
  }

  @Post('credit')
  creditPL(@Body() body: { employeeID: number; leavePolicyID: number }) {
    return this.service.creditPL(body.employeeID, body.leavePolicyID);
  }

  @Post('lapse')
  processLapse(@Body() body: { employeeID: number; leavePolicyID: number }) {
    return this.service.processLapse(body.employeeID, body.leavePolicyID);
  }

  @Get('lapse-history/:employeeId')
  getLapseHistory(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return this.service.getLapseHistory(employeeId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePrivilegedLeaveDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
