import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { BankDetailsService } from './bank-details.service';
import { CreateBankDetailsDto } from './dto/create-bank-detail.dto';
import { UpdateBankDetailsDto } from './dto/update-bank-detail.dto';

@Controller('bank-details')
export class BankDetailsController {
  constructor(private readonly bankDetailsService: BankDetailsService) {}

  @Post()
  create(@Body() dto: CreateBankDetailsDto) {
    return this.bankDetailsService.create(dto);
  }

  @Get()
  findAll() {
    return this.bankDetailsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bankDetailsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBankDetailsDto) {
    return this.bankDetailsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bankDetailsService.remove(id);
  }
}
