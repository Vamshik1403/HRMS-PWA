import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { PushNotificationsController } from './push-notifications.controller';
import { PushNotificationsService } from './push-notifications.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret123',
    }),
  ],
  controllers: [PushNotificationsController],
  providers: [PushNotificationsService],
  exports: [PushNotificationsService],
})
export class PushNotificationsModule {}
