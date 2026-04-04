import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { SalaryAdvanceRepaymentService } from './salary-advance-repayment.service';
import { CreateSalaryAdvanceRepaymentDto } from './dto/create-salary-advance-repayment.dto';
import { UpdateSalaryAdvanceRepaymentDto } from './dto/update-salary-advance-repayment.dto';

@Controller('salary-advance-repayment')
export class SalaryAdvanceRepaymentController {
  constructor(private readonly service: SalaryAdvanceRepaymentService) {}

  @Post()
  create(@Body() dto: CreateSalaryAdvanceRepaymentDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('advance/:salaryAdvanceID')
  findByAdvance(@Param('salaryAdvanceID', ParseIntPipe) salaryAdvanceID: number) {
    return this.service.findByAdvance(salaryAdvanceID);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSalaryAdvanceRepaymentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

}
  