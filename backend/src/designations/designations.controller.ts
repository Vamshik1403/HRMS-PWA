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
import { DesignationsService } from './designations.service';
import { CreateDesignationsDto } from './dto/create-designation.dto';
import { UpdateDesignationsDto } from './dto/update-designation.dto';

@Controller('designations')
export class DesignationsController {
  constructor(private readonly designationsService: DesignationsService) {}

  @Post()
  create(@Body() dto: CreateDesignationsDto) {
    return this.designationsService.create(dto);
  }

  @Get()
  findAll() {
    return this.designationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.designationsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDesignationsDto,
  ) {
    return this.designationsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.designationsService.remove(id);
  }
}
