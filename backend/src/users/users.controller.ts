import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  assertCompanyDirectory,
  assertSelfOrSuperadmin,
  assertSuperadmin,
} from '../common/role-access';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: { user?: { role?: string } }, @Body() createUserDto: CreateUserDto) {
    assertSuperadmin(req.user);
    return this.usersService.create(createUserDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Req() req: { user?: { role?: string; isCompanyOwner?: boolean } }) {
    assertCompanyDirectory(req.user);
    return this.usersService.findAll();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Req() req: { user?: { role?: string; sub?: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    assertSelfOrSuperadmin(req.user, id);
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Req() req: { user?: { role?: string; sub?: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    assertSelfOrSuperadmin(req.user, id);
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Req() req: { user?: { role?: string } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    assertSuperadmin(req.user);
    return this.usersService.remove(id);
  }

  @Get(':id/profile')
  @HttpCode(HttpStatus.OK)
  async getProfile(
    @Req() req: { user?: { role?: string; sub?: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    assertSelfOrSuperadmin(req.user, id);
    return this.usersService.getProfile(id);
  }

  @Patch(':id/profile')
  @HttpCode(HttpStatus.OK)
  async upsertProfile(
    @Req() req: { user?: { role?: string; sub?: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { fullName?: string; email?: string; mobileNo?: string; address?: string; city?: string; state?: string; pincode?: string },
  ) {
    assertSelfOrSuperadmin(req.user, id);
    return this.usersService.upsertProfile(id, body);
  }
}