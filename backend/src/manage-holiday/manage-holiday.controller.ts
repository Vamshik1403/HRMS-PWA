import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ManageHolidayService } from './manage-holiday.service';
import { CreateManageHolidayDto } from './dto/create-manage-holiday.dto';
import { UpdateManageHolidayDto } from './dto/update-manage-holiday.dto';

@Controller('manage-holiday')
export class ManageHolidayController {
  constructor(private readonly manageHolidayService: ManageHolidayService) {}

  @Post()
  create(@Body() createManageHolidayDto: CreateManageHolidayDto) {
    return this.manageHolidayService.create(createManageHolidayDto);
  }

@Get()
async findAll(
  @Query('serviceProviderID') serviceProviderID?: string,
  @Query('companyID') companyID?: string,
  @Query('branchesID') branchesID?: string,
) {
  return this.manageHolidayService.findAllByIds({
    serviceProviderID: serviceProviderID ? Number(serviceProviderID) : undefined,
    companyID: companyID ? Number(companyID) : undefined,
    branchesID: branchesID ? Number(branchesID) : undefined,
  });
}

  

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.manageHolidayService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateManageHolidayDto: UpdateManageHolidayDto) {
    return this.manageHolidayService.update(+id, updateManageHolidayDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.manageHolidayService.remove(+id);
  }
}
