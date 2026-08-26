import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
    return this.prisma.companyPolicy.findMany({
      orderBy: [{ type: 'asc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
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

  async remove(id: number) {
    const existing = await this.prisma.companyPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Policy not found');
    await this.prisma.companyPolicy.delete({ where: { id } });
    return { ok: true };
  }

  async getLatestPublic(typeParam: string) {
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
