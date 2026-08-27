import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CompanyPolicyType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyPolicyDto } from './dto/create-company-policy.dto';

@Injectable()
export class CompanyPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  assertSuperAdmin(user: any) {
    if (String(user?.role || '').toUpperCase() !== 'SUPERADMIN') {
      throw new ForbiddenException('Only SuperAdmin can manage company policies');
    }
  }

  findAll() {
    return this.ensureDefaults().then(() =>
      this.prisma.companyPolicy.findMany({
        orderBy: [{ type: 'asc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      }),
    );
  }

  private async ensureDefaults() {
    const defaults: Array<{
      type: CompanyPolicyType;
      policyName: string;
      versionName: string;
      bodyHtml: string;
    }> = [
      {
        type: CompanyPolicyType.TERMS_OF_USE,
        policyName: 'Terms of Use',
        versionName: 'v1.0',
        bodyHtml:
          '<h2>Terms of Use</h2><p>These Terms of Use govern access to and use of OpenHRM. Update this version to publish the latest company terms.</p>',
      },
      {
        type: CompanyPolicyType.PRIVACY_POLICY,
        policyName: 'Privacy Policy',
        versionName: 'v1.0',
        bodyHtml:
          '<h2>Privacy Policy</h2><p>This Privacy Policy describes how OpenHRM collects, uses and protects personal data. Update this version to publish the latest privacy terms.</p>',
      },
      {
        type: CompanyPolicyType.SLA,
        policyName: 'Service Level Agreement',
        versionName: 'v1.0',
        bodyHtml:
          '<h2>Service Level Agreement</h2><p>This Service Level Agreement describes availability and support commitments for OpenHRM. Update this version to publish the latest SLA.</p>',
      },
    ];

    for (const item of defaults) {
      const existing = await this.prisma.companyPolicy.findFirst({
        where: { type: item.type },
        select: { id: true },
      });
      if (existing) continue;
      await this.prisma.companyPolicy.create({
        data: {
          type: item.type,
          policyName: item.policyName,
          versionName: item.versionName,
          effectiveFrom: new Date(),
          bodyHtml: item.bodyHtml,
        },
      });
    }
  }

  async create(dto: CreateCompanyPolicyDto) {
    return this.prisma.companyPolicy.create({
      data: {
        type: dto.type,
        policyName: dto.policyName.trim(),
        versionName: dto.versionName.trim(),
        effectiveFrom: new Date(dto.effectiveFrom),
        bodyHtml: this.sanitizeHtml(dto.bodyHtml),
      },
    });
  }

  async remove(_id: number) {
    throw new ForbiddenException(
      'Policy versions cannot be deleted. Revise them to keep history.',
    );
  }

  async getLatestPublic(typeParam: string) {
    await this.ensureDefaults();
    const type = this.parseType(typeParam);
    const now = new Date();

    const current = await this.prisma.companyPolicy.findFirst({
      where: { type, effectiveFrom: { lte: now } },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
    if (current) return current;

    return this.prisma.companyPolicy.findFirst({
      where: { type },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  private parseType(value: string): CompanyPolicyType {
    const normalized = String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[-\s]+/g, '_');
    const map: Record<string, CompanyPolicyType> = {
      TERMS_OF_USE: CompanyPolicyType.TERMS_OF_USE,
      TERMS: CompanyPolicyType.TERMS_OF_USE,
      PRIVACY_POLICY: CompanyPolicyType.PRIVACY_POLICY,
      PRIVACY: CompanyPolicyType.PRIVACY_POLICY,
      SLA: CompanyPolicyType.SLA,
    };
    const type = map[normalized];
    if (!type) {
      throw new BadRequestException('Unknown policy type');
    }
    return type;
  }

  private sanitizeHtml(html: string): string {
    return String(html || '')
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/\son\w+='[^']*'/gi, '')
      .replace(/javascript:/gi, '');
  }
}
