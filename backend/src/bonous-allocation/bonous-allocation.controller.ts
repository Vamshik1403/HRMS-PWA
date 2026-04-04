import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BonusAllocationService } from './bonous-allocation.service';
import { CreateBonusAllocationDto } from './dto/create-bonous-allocation.dto';
import { UpdateBonusAllocationDto } from './dto/update-bonous-allocation.dto';


@Controller('bonus-allocation')
export class BonousAllocationController {
  constructor(private readonly bonousAllocationService: BonusAllocationService) {}

  @Post()
  create(@Body() createBonousAllocationDto: CreateBonusAllocationDto) {
    return this.bonousAllocationService.create(createBonousAllocationDto);
  }

  @Get()
  findAll() {
    return this.bonousAllocationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bonousAllocationService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBonousAllocationDto: UpdateBonusAllocationDto) {
    return this.bonousAllocationService.update(+id, updateBonousAllocationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bonousAllocationService.remove(+id);
  }
}
