import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PublicHolidayService } from './public-holiday.service';
import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto';
import { UpdatePublicHolidayDto } from './dto/update-public-holiday.dto';

@Controller('public-holiday')
export class PublicHolidayController {
  constructor(private readonly publicHolidayService: PublicHolidayService) {}

  @Post()
  create(@Body() createPublicHolidayDto: CreatePublicHolidayDto) {
    return this.publicHolidayService.create(createPublicHolidayDto);
  }

  @Get()
  findAll() {
    return this.publicHolidayService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.publicHolidayService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePublicHolidayDto: UpdatePublicHolidayDto) {
    return this.publicHolidayService.update(+id, updatePublicHolidayDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.publicHolidayService.remove(+id);
  }
}
