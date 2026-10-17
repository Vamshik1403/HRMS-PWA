import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { assertSuperadmin } from '../common/role-access';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { CreateCompanySubscriptionDto } from './dto/create-company-subscription.dto';
import { UpdateCompanySubscriptionDto } from './dto/update-company-subscription.dto';

@Controller('subscription')
@UseGuards(AuthGuard('jwt'))
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  private allow(req: { user?: { role?: string } }) {
    assertSuperadmin(req.user);
  }

  @Post('plans')
  @HttpCode(HttpStatus.CREATED)
  createPlan(@Req() req: { user?: { role?: string } }, @Body() dto: CreateSubscriptionDto) {
    this.allow(req);
    return this.subscriptionService.createPlan(dto);
  }

  @Get('plans')
  findAllPlans(@Req() req: { user?: { role?: string } }) {
    this.allow(req);
    return this.subscriptionService.findAllPlans();
  }

  @Get('plans/:id')
  findOnePlan(@Req() req: { user?: { role?: string } }, @Param('id', ParseIntPipe) id: number) {
    this.allow(req);
    return this.subscriptionService.findOnePlan(id);
  }

  @Patch('plans/:id')
  updatePlan(
    @Req() req: { user?: { role?: string } },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    this.allow(req);
    return this.subscriptionService.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  removePlan(@Req() req: { user?: { role?: string } }, @Param('id', ParseIntPipe) id: number) {
    this.allow(req);
    return this.subscriptionService.removePlan(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  assignPlan(@Req() req: { user?: { role?: string } }, @Body() dto: CreateCompanySubscriptionDto) {
    this.allow(req);
    return this.subscriptionService.assignPlan(dto);
  }

  @Get()
  findAllSubscriptions(@Req() req: { user?: { role?: string } }) {
    this.allow(req);
    return this.subscriptionService.findAllSubscriptions();
  }

  @Get(':id')
  findOneSubscription(@Req() req: { user?: { role?: string } }, @Param('id', ParseIntPipe) id: number) {
    this.allow(req);
    return this.subscriptionService.findOneSubscription(id);
  }

  @Patch(':id')
  updateSubscription(
    @Req() req: { user?: { role?: string } },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanySubscriptionDto,
  ) {
    this.allow(req);
    return this.subscriptionService.updateSubscription(id, dto);
  }

  @Patch(':id/deactivate')
  deactivateSubscription(
    @Req() req: { user?: { role?: string } },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { deactivationWef: string; reason?: string },
  ) {
    this.allow(req);
    return this.subscriptionService.deactivateSubscription(id, body);
  }

  @Post(':id/renew')
  renewSubscription(
    @Req() req: { user?: { role?: string } },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCompanySubscriptionDto,
  ) {
    this.allow(req);
    return this.subscriptionService.renewSubscription(id, dto);
  }
}