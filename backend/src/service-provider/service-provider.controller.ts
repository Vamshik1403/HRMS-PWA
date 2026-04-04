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
import { ServiceProviderService } from './service-provider.service';
import { CreateServiceProviderDto } from './dto/create-service-provider.dto';
import { UpdateServiceProviderDto } from './dto/update-service-provider.dto';

@Controller('service-provider')
export class ServiceProviderController {
  constructor(private readonly serviceProviderService: ServiceProviderService) {}

  @Post()
  create(@Body() dto: CreateServiceProviderDto) {
    return this.serviceProviderService.create(dto);
  }

  @Get()
  findAll() {
    return this.serviceProviderService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.serviceProviderService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceProviderDto,
  ) {
    return this.serviceProviderService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.serviceProviderService.remove(id);
  }
}
