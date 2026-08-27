import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Put,
  Query,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanyModulesDto } from './dto/update-company-modules.dto';
import { CreateCompanyOwnerDto, SaveOwnerPermissionsDto } from './dto/create-company-owner.dto';

@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companyService.create(dto);
  }

  // ✅ fixed/static routes first
  @Get('modules/all')
  getAllModules() {
    return this.companyService.getAllModules();
  }

  @Post('modules/seed-default')
  seedDefaultModules() {
    return this.companyService.seedDefaultModules();
  }

  @Get('owners/username-available')
  usernameAvailable(
    @Query('username') username?: string,
    @Query('excludeOwnerId') excludeOwnerId?: string,
  ) {
    return this.companyService.isUsernameAvailable(
      username,
      excludeOwnerId ? Number(excludeOwnerId) : undefined,
    );
  }

  @Get('owners')
  listOwners(@Query('companyID') companyID?: string) {
    return this.companyService.listOwners(
      companyID ? Number(companyID) : undefined,
    );
  }

  @Post('migrate-admin/:userId')
  migrateAdmin(@Param('userId', ParseIntPipe) userId: number) {
    return this.companyService.migrateCompanyAdminToOwner(userId);
  }

  @Get()
  findAll() {
    return this.companyService.findAll();
  }

  @Get(':id/modules')
  getCompanyModules(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.getCompanyModules(id);
  }

  @Put(':id/modules')
  updateCompanyModules(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyModulesDto,
  ) {
    return this.companyService.updateCompanyModules(id, dto.modules);
  }

  @Post(':id/owner')
  createOwner(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCompanyOwnerDto,
  ) {
    return this.companyService.createOwner(id, dto);
  }

  @Patch(':id/owner/:ownerId')
  updateOwner(
    @Param('id', ParseIntPipe) id: number,
    @Param('ownerId', ParseIntPipe) ownerId: number,
    @Body() dto: CreateCompanyOwnerDto,
  ) {
    return this.companyService.updateOwner(id, ownerId, dto);
  }

  @Get(':id/owner/:ownerId/permissions')
  getOwnerPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Param('ownerId', ParseIntPipe) ownerId: number,
  ) {
    return this.companyService.getOwnerPermissions(id, ownerId);
  }

  @Put(':id/owner/:ownerId/permissions')
  saveOwnerPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Param('ownerId', ParseIntPipe) ownerId: number,
    @Body() dto: SaveOwnerPermissionsDto,
  ) {
    return this.companyService.saveOwnerPermissions(id, ownerId, dto.permissions);
  }

  @Delete(':id/owner/:ownerId')
  deactivateOwner(
    @Param('id', ParseIntPipe) id: number,
    @Param('ownerId', ParseIntPipe) ownerId: number,
  ) {
    return this.companyService.deactivateOwner(id, ownerId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companyService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.remove(id);
  }
}