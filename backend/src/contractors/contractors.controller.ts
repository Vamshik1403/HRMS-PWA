import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ContractorsService } from './contractors.service';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { UpdateContractorDto } from './dto/update-contractor.dto';

@Controller('contractors')
export class ContractorsController {
  constructor(private readonly contractorsService: ContractorsService) {}

  @Post()
  create(@Body() createContractorDto: CreateContractorDto) {
    return this.contractorsService.create(createContractorDto);
  }

  @Get()
  findAll() {
    return this.contractorsService.findAll();
  }
  
@Get('rate-cards')
findAllRateCards() {
  return this.contractorsService.findAllRateCards();
}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contractorsService.findOne(+id);
  }

 

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateContractorDto: UpdateContractorDto) {
    return this.contractorsService.update(+id, updateContractorDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contractorsService.remove(+id);
  }

  @Get(':id/rate-cards')
  findRateCards(@Param('id') id: string) {
    return this.contractorsService.findRateCards(+id);
  }

  @Post(':id/rate-cards')
  saveRateCards(
    @Param('id') id: string,
    @Body() body: { rateCards: { contractorName?: string; rateCardName?: string; branchName?: string; departmentName?: string; designation?: string; workShiftName?: string; payoutType?: string; perMinuteRate?: number; perHourRate?: number; perDayRate?: number; perMonthRate?: number; dailyRateMinute?: number; dailyRateHour?: number; monthlyRateMinute?: number; monthlyRateHours?: number; otType?: string; otPerMinuteRate?: number; otPerHourRate?: number; otRateMultiplier?: number; commissionType?: string; commissionBasedOn?: string; commissionValue?: number }[] },
  ) {
    return this.contractorsService.saveRateCards(+id, body.rateCards);
  }
}
