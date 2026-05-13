import { Controller, Post, Body, Get } from '@nestjs/common';
import { PushNotificationsService } from './push-notifications.service';

@Controller('push-notifications')
export class PushNotificationsController {
  constructor(private readonly service: PushNotificationsService) {}

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return { publicKey: this.service.getVapidPublicKey() };
  }

  @Post('subscribe')
  subscribe(@Body() body: { employeeID: number; subscription: any }) {
    this.service.saveSubscription(body.employeeID, body.subscription);
    return { success: true };
  }
}
