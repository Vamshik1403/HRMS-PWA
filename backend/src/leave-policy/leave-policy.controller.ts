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
import { LeavePolicyService } from './leave-policy.service';
import { CreateLeavePolicyDto } from './dto/create-leave-policy.dto';
import { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto';

@Controller('leave-policy')
export class LeavePolicyController {
  constructor(private readonly leavePolicyService: LeavePolicyService) {}

  @Post()
  create(@Body() createLeavePolicyDto: CreateLeavePolicyDto) {
    return this.leavePolicyService.create(createLeavePolicyDto);
  }

  @Get()
  findAll() {
    return this.leavePolicyService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.leavePolicyService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLeavePolicyDto: UpdateLeavePolicyDto,
  ) {
    return this.leavePolicyService.update(id, updateLeavePolicyDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.leavePolicyService.remove(id);
  }
}
