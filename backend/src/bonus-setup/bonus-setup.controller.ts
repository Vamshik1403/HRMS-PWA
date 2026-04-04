import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { BonusSetupService } from './bonus-setup.service';
import { CreateBonusSetupDto } from './dto/create-bonus-setup.dto';
import { UpdateBonusSetupDto } from './dto/update-bonus-setup.dto';

@Controller('bonus-setup')
export class BonusSetupController {
  constructor(private readonly service: BonusSetupService) {}

  @Post()
  create(@Body() dto: CreateBonusSetupDto) {
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

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBonusSetupDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
