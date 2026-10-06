import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { CompanyModuleAccessService } from '../../common/company-module-access.service';

function jwtFromAccessTokenCookie(req: Request): string | null {
  const raw = req?.headers?.cookie;
  if (!raw) return null;
  const match = raw.match(/(?:^|;\s*)accessToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly moduleAccess: CompanyModuleAccessService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        jwtFromAccessTokenCookie,
      ]),
      secretOrKey: process.env.JWT_SECRET || 'secret123',
    });
  }

  async validate(payload: any) {
    try {
      await this.moduleAccess.assertSessionAllowed(payload?.companyID, payload?.role);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('SUBSCRIPTION_EXPIRED');
    }
    return payload;
  }
}
