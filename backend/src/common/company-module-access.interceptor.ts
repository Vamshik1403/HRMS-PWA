import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CompanyModuleAccessService } from './company-module-access.service';

@Injectable()
export class CompanyModuleAccessInterceptor implements NestInterceptor {
  constructor(private readonly access: CompanyModuleAccessService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const url = String(req?.originalUrl || req?.url || '');
    if (
      url.includes('/auth/') ||
      url.endsWith('/auth') ||
      url.includes('/company-access')
    ) {
      return next.handle();
    }
    await this.access.assertRequestAllowed(req?.user, url, req?.method);
    return next.handle();
  }
}
