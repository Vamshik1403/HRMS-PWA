import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyPolicyService } from './company-policy.service';
import { CreateCompanyPolicyDto } from './dto/create-company-policy.dto';

@Controller('company-policies')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class CompanyPolicyController {
  constructor(private readonly service: CompanyPolicyService) {}

  @Get('public/:type')
  getPublic(@Param('type') type: string) {
    return this.service.getLatestPublic(type);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll(@Req() req: { user?: { role?: string } }) {
    this.service.assertSuperAdmin(req.user);
    return this.service.findAll();
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(
    @Req() req: { user?: { role?: string } },
    @Body() dto: CreateCompanyPolicyDto,
  ) {
    this.service.assertSuperAdmin(req.user);
    return this.service.create(dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(
    @Req() req: { user?: { role?: string } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.service.assertSuperAdmin(req.user);
    return this.service.remove(id);
  }
}
