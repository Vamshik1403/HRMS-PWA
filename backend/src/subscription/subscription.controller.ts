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
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { CreateCompanySubscriptionDto } from './dto/create-company-subscription.dto';
import { UpdateCompanySubscriptionDto } from './dto/update-company-subscription.dto';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('plans')
  @HttpCode(HttpStatus.CREATED)
  createPlan(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptionService.createPlan(dto);
  }

  @Get('plans')
  findAllPlans() {
    return this.subscriptionService.findAllPlans();
  }

  @Get('plans/:id')
  findOnePlan(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionService.findOnePlan(id);
  }

  @Patch('plans/:id')
  updatePlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionService.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  removePlan(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionService.removePlan(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  assignPlan(@Body() dto: CreateCompanySubscriptionDto) {
    return this.subscriptionService.assignPlan(dto);
  }

  @Get()
  findAllSubscriptions() {
    return this.subscriptionService.findAllSubscriptions();
  }

  @Get(':id')
  findOneSubscription(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionService.findOneSubscription(id);
  }

  @Patch(':id')
  updateSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanySubscriptionDto,
  ) {
    return this.subscriptionService.updateSubscription(id, dto);
  }

  @Patch(':id/deactivate')
  deactivateSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { deactivationWef: string; reason?: string },
  ) {
    return this.subscriptionService.deactivateSubscription(id, body);
  }

  @Post(':id/renew')
  renewSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCompanySubscriptionDto,
  ) {
    return this.subscriptionService.renewSubscription(id, dto);
  }
}