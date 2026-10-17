import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ServiceProviderService } from './service-provider.service';
import { CreateServiceProviderDto } from './dto/create-service-provider.dto';
import { UpdateServiceProviderDto } from './dto/update-service-provider.dto';
import { assertCompanyDirectory, assertSuperadmin } from '../common/role-access';

@Controller('service-provider')
@UseGuards(AuthGuard('jwt'))
export class ServiceProviderController {
  constructor(private readonly serviceProviderService: ServiceProviderService) {}

  @Post()
  create(@Req() req: { user?: { role?: string } }, @Body() dto: CreateServiceProviderDto) {
    assertSuperadmin(req.user);
    return this.serviceProviderService.create(dto);
  }

  @Get()
  findAll(@Req() req: { user?: { role?: string; isCompanyOwner?: boolean } }) {
    assertCompanyDirectory(req.user);
    return this.serviceProviderService.findAll();
  }

  @Get(':id')
  findOne(
    @Req() req: { user?: { role?: string; isCompanyOwner?: boolean } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    assertCompanyDirectory(req.user);
    return this.serviceProviderService.findOne(id);
  }

  @Patch(':id')
  update(
    @Req() req: { user?: { role?: string } },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceProviderDto,
  ) {
    assertSuperadmin(req.user);
    return this.serviceProviderService.update(id, dto);
  }

  @Delete(':id')
  remove(@Req() req: { user?: { role?: string } }, @Param('id', ParseIntPipe) id: number) {
    assertSuperadmin(req.user);
    return this.serviceProviderService.remove(id);
  }
}
