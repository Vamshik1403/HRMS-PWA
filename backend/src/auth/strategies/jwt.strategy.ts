import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

function jwtFromAccessTokenCookie(req: Request): string | null {
  const raw = req?.headers?.cookie;
  if (!raw) return null;
  const match = raw.match(/(?:^|;\s*)accessToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const SUBSCRIPTION_EXEMPT_ROLES = ['SUPERADMIN', 'SERVICE_PROVIDER'];

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        jwtFromAccessTokenCookie,
      ]),
      secretOrKey: process.env.JWT_SECRET || 'secret123',
    });
  }

  async validate(payload: any) {
    const role = payload?.role;
    const companyID = payload?.companyID;

    if (!SUBSCRIPTION_EXEMPT_ROLES.includes(role) && companyID) {
      const latest = await this.prisma.companySubscription.findFirst({
        where: { companyID },
        orderBy: { endDate: 'desc' },
      });

      if (latest) {
        const expired =
          latest.status === SubscriptionStatus.EXPIRED ||
          latest.status === SubscriptionStatus.CANCELLED ||
          new Date(latest.endDate).getTime() < Date.now();

        if (expired) {
          throw new UnauthorizedException('SUBSCRIPTION_EXPIRED');
        }
      }
    }

    return payload; // { sub, username, role }
  }
}
