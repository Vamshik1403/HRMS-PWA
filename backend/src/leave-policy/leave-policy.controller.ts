import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
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
  findAll(@Query('companyID') companyID?: string) {
    const parsed = Number(companyID);
    const scopedId =
      Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    return this.leavePolicyService.findAll(scopedId);
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
