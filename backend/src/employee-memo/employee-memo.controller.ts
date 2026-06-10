import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { EmployeeMemoService } from './employee-memo.service';
import { CreateEmployeeMemoDto } from './dto/create-employee-memo.dto';
import { UpdateEmployeeMemoDto } from './dto/update-employee-memo.dto';
import { ReplyEmployeeMemoDto } from './dto/reply-employee-memo.dto';

@Controller('employee-memo')
export class EmployeeMemoController {
  constructor(private readonly service: EmployeeMemoService) {}

  @Get()
  findAll(@Query('employeeID') employeeID?: string) {
    const id = employeeID != null && employeeID !== '' ? Number(employeeID) : undefined;
    return this.service.findAll(Number.isFinite(id) && id! > 0 ? id : undefined);
  }

  @Post(':id/undo')
  undo(
    @Param('id', ParseIntPipe) id: number,
    @Query('senderEmployeeId') senderEmployeeId?: string,
  ) {
    const actor =
      senderEmployeeId != null && senderEmployeeId !== ''
        ? Number(senderEmployeeId)
        : undefined;
    return this.service.undo(id, Number.isFinite(actor) ? actor : undefined);
  }

  @Post(':id/reply')
  reply(@Param('id', ParseIntPipe) id: number, @Body() dto: ReplyEmployeeMemoDto) {
    return this.service.reply(id, dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateEmployeeMemoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeeMemoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('senderEmployeeId') senderEmployeeId?: string,
  ) {
    const actor =
      senderEmployeeId != null && senderEmployeeId !== ''
        ? Number(senderEmployeeId)
        : undefined;
    return this.service.remove(id, Number.isFinite(actor) ? actor : undefined);
  }
}
