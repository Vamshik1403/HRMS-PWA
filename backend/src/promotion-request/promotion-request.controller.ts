import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { PromotionRequestService } from './promotion-request.service';
import { CreatePromotionRequestDto } from './dto/create-promotion-request.dto';
import { UpdatePromotionRequestDto } from './dto/update-promotion-request.dto';

@Controller('promotion-request')
export class PromotionRequestController {
  constructor(private readonly service: PromotionRequestService) {}

 
  @Get()
  findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('manageEmployeeID') manageEmployeeID?: number,
    @Query('status') status?: string,
  ) {
    return this.service.findAll({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      manageEmployeeID: manageEmployeeID ? Number(manageEmployeeID) : undefined,
      status: status || undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePromotionRequestDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
