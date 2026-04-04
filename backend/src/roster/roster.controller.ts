import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { RosterService } from './roster.service';
import { CreateRosterDto } from './dto/create-roster.dto';
import { UpdateRosterDto } from './dto/update-roster.dto';

@Controller('rosters')
export class RosterController {
  constructor(private readonly service: RosterService) {}

  @Post()
  create(@Body() dto: CreateRosterDto, @Req() req) {
    return this.service.create(dto, req.user.id);
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
  update(@Param('id') id: string, @Body() dto: UpdateRosterDto) {
    return this.service.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
