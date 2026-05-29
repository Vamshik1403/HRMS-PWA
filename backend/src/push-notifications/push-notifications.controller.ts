import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Logger,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { PushSubscription } from 'web-push';
import {
  isValidPushSubscription,
  PushNotificationsService,
} from './push-notifications.service';

@Controller('push-notifications')
export class PushNotificationsController {
  private readonly logger = new Logger(PushNotificationsController.name);

  constructor(
    private readonly service: PushNotificationsService,
    private readonly jwt: JwtService,
  ) {}

  private resolveEmployeeId(
    bodyEmployeeId: number | string | undefined,
    authHeader?: string,
  ): number {
    let fromToken: number | null = null;

    const bearer = authHeader?.replace(/^Bearer\s+/i, '').trim();
    if (bearer) {
      try {
        const payload = this.jwt.verify(bearer) as {
          sub?: number;
          employeeId?: number;
          type?: string;
          role?: string;
        };
        const isEmployee =
          payload?.type === 'employee' || payload?.role === 'EMPLOYEE';
        if (isEmployee) {
          const raw = payload.employeeId ?? payload.sub;
          const id = Number(raw);
          if (Number.isFinite(id) && id > 0) fromToken = id;
        }
      } catch {
        /* invalid token — fall through to body */
      }
    }

    const fromBody = Number(bodyEmployeeId);
    const bodyOk = Number.isFinite(fromBody) && fromBody > 0;

    if (fromToken != null) {
      if (bodyOk && fromBody !== fromToken) {
        this.logger.warn(
          `Push subscribe employeeID mismatch: body=${fromBody} token=${fromToken}, using token`,
        );
      }
      return fromToken;
    }

    if (bodyOk) return fromBody;

    throw new BadRequestException(
      'employeeID is required (log in as employee or send a valid Bearer token)',
    );
  }

  @Get('vapid-public-key')
  getVapidPublicKey() {
    const publicKey = this.service.getVapidPublicKey();
    if (!publicKey) {
      this.logger.warn('VAPID public key requested but not configured');
    }
    return { publicKey };
  }

  @Get('status/:employeeID')
  getStatus(@Param('employeeID') employeeID: string) {
    const id = Number(employeeID);
    if (!Number.isFinite(id) || id <= 0) {
      throw new BadRequestException('Invalid employeeID');
    }
    return { employeeID: id, subscribed: this.service.hasSubscription(id) };
  }

  @Post('register-failed')
  registerFailed(
    @Body() body: { employeeID?: number | string | null; reason?: string },
    @Headers('authorization') authHeader?: string,
  ) {
    let employeeID: number | null = null;
    try {
      employeeID = this.resolveEmployeeId(body?.employeeID ?? undefined, authHeader);
    } catch {
      const n = Number(body?.employeeID);
      employeeID = Number.isFinite(n) && n > 0 ? n : null;
    }
    this.logger.warn(
      `Push registration failed for employee ${employeeID ?? 'unknown'}: ${body?.reason ?? 'no reason'}`,
    );
    return { logged: true };
  }

  @Post('subscribe')
  subscribe(
    @Body()
    body: {
      employeeID?: number | string;
      subscription?: PushSubscription;
    },
    @Headers('authorization') authHeader?: string,
  ) {
    const employeeID = this.resolveEmployeeId(body?.employeeID, authHeader);
    const subscription = body?.subscription;

    if (!isValidPushSubscription(subscription)) {
      throw new BadRequestException(
        'Invalid push subscription payload (endpoint or encryption keys)',
      );
    }

    this.logger.log(`Push subscribe request for employee ${employeeID}`);
    this.service.saveSubscription(employeeID, subscription!);
    return { success: true, employeeID };
  }

  @Post('test')
  async testPush(@Headers('authorization') authHeader?: string) {
    const employeeID = this.resolveEmployeeId(undefined, authHeader);
    if (!authHeader) {
      throw new UnauthorizedException('Bearer token required');
    }
    await this.service.sendToEmployee(
      employeeID,
      'OpenHRM Test',
      'Push notifications are working.',
      { url: '/empdashboard' },
    );
    return { success: true, employeeID };
  }
}
