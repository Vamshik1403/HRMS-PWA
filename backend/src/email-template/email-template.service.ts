import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Single template used for ALL email types (leave, reimbursement, etc.). */
export const SINGLE_TEMPLATE_EVENT = 'ALL';
export const DEFAULT_SINGLE_TEMPLATE = {
  eventType: SINGLE_TEMPLATE_EVENT,
  subject: '{{companyName}} – {{eventLabel}} – {{employeeName}}',
  bodyHtml:
    '<p>Dear {{employeeName}},</p>' +
    '<p>This is an update regarding your <strong>{{eventLabel}}</strong>.</p>' +
    '<p>{{subject}} {{purpose}} {{description}} {{details}}</p>' +
    '<p>{{fromDate}} {{toDate}} {{amount}}</p>' +
    '<p>Status: <strong>{{status}}</strong></p>',
};

export const DEFAULT_EMAIL_TEMPLATES = [
  {
    eventType: 'LEAVE_APPLICATION',
    subject: 'Leave application – {{employeeName}}',
    bodyHtml:
      '<p>Dear {{employeeName}},</p><p>Your leave application from {{fromDate}} to {{toDate}} is now <strong>{{status}}</strong>.</p><p>{{purpose}}</p>',
  },
  {
    eventType: 'REIMBURSEMENT',
    subject: 'Reimbursement update – {{employeeName}}',
    bodyHtml:
      '<p>Dear {{employeeName}},</p><p>Your reimbursement claim ({{amount}}) status: <strong>{{status}}</strong>.</p>',
  },
  {
    eventType: 'OFFBOARDING',
    subject: 'Offboarding – {{employeeName}}',
    bodyHtml:
      '<p>Dear {{employeeName}},</p><p>Your offboarding process has been updated. Status: <strong>{{status}}</strong>.</p><p>{{details}}</p>',
  },
  {
    eventType: 'NOTICE_BOARD',
    subject: 'Notice: {{subject}}',
    bodyHtml:
      '<p>Dear {{employeeName}},</p><p><strong>{{subject}}</strong></p><p>{{description}}</p>',
  },
  {
    eventType: 'WARNING',
    subject: 'Warning notice – {{subject}}',
    bodyHtml:
      '<p>Dear {{employeeName}},</p><p><strong>{{subject}}</strong></p><p>{{description}}</p>',
  },
] as const;

@Injectable()
export class EmailTemplateService implements OnModuleInit {
  private readonly logger = new Logger(EmailTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.migrateLegacyProductNameInTemplates();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'P2021') {
        this.logger.warn(
          'EmailTemplate table missing — run prisma migrate deploy. Skipping template migration.',
        );
        return;
      }
      this.logger.error('Email template startup migration failed', err);
    }
  }

  /** Replace static OpenHRM branding in stored templates with {{companyName}}. */
  private async migrateLegacyProductNameInTemplates() {
    const rows = await this.prisma.emailTemplate.findMany();
    for (const row of rows) {
      const subject = row.subject.replace(/\bOpenHRM\b/gi, '{{companyName}}');
      const bodyHtml = row.bodyHtml.replace(/\bOpenHRM\b/gi, '{{companyName}}');
      if (subject !== row.subject || bodyHtml !== row.bodyHtml) {
        await this.prisma.emailTemplate.update({
          where: { id: row.id },
          data: { subject, bodyHtml },
        });
        this.logger.log(`Updated email template #${row.id} to use {{companyName}}`);
      }
    }
  }

  findAll(companyID?: number) {
    if (companyID != null) {
      return this.prisma.emailTemplate.findMany({
        where: { OR: [{ companyID }, { companyID: null }] },
        orderBy: [{ companyID: 'desc' }, { eventType: 'asc' }],
      });
    }
    return this.prisma.emailTemplate.findMany({
      orderBy: [{ companyID: 'asc' }, { eventType: 'asc' }],
    });
  }

  private async upsertByCompanyAndEvent(
    companyID: number | null,
    eventType: string,
    data: { subject: string; bodyHtml: string; enabled?: boolean },
  ) {
    const existing = await this.prisma.emailTemplate.findFirst({
      where: { companyID, eventType },
    });
    if (existing) {
      return this.prisma.emailTemplate.update({
        where: { id: existing.id },
        data: {
          subject: data.subject,
          bodyHtml: data.bodyHtml,
          enabled: data.enabled ?? true,
        },
      });
    }
    return this.prisma.emailTemplate.create({
      data: {
        companyID,
        eventType,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        enabled: data.enabled ?? true,
      },
    });
  }

  async upsert(data: {
    id?: number;
    companyID?: number | null;
    eventType: string;
    subject: string;
    bodyHtml: string;
    enabled?: boolean;
  }) {
    if (data.id) {
      const existing = await this.prisma.emailTemplate.findUnique({
        where: { id: data.id },
      });
      if (!existing) throw new NotFoundException('Template not found');
      return this.prisma.emailTemplate.update({
        where: { id: data.id },
        data: {
          subject: data.subject,
          bodyHtml: data.bodyHtml,
          enabled: data.enabled ?? true,
        },
      });
    }
    return this.upsertByCompanyAndEvent(data.companyID ?? null, data.eventType, {
      subject: data.subject,
      bodyHtml: data.bodyHtml,
      enabled: data.enabled,
    });
  }

  async seedDefaults(companyID?: number | null) {
    const cid = companyID ?? null;
    // Seed the single unified template used for all email types.
    await this.upsertByCompanyAndEvent(cid, DEFAULT_SINGLE_TEMPLATE.eventType, {
      subject: DEFAULT_SINGLE_TEMPLATE.subject,
      bodyHtml: DEFAULT_SINGLE_TEMPLATE.bodyHtml,
      enabled: true,
    });
    return this.findAll(companyID ?? undefined);
  }

  /**
   * Resolve the template to send. A single "ALL" template (if configured)
   * applies to every event type; otherwise we fall back to an event-specific
   * template for backward compatibility, then to null (built-in default).
   */
  async getTemplateForSend(eventType: string, companyID?: number | null) {
    const lookup = async (et: string) => {
      if (companyID != null) {
        const companyTpl = await this.prisma.emailTemplate.findFirst({
          where: { companyID, eventType: et, enabled: true },
        });
        if (companyTpl) return companyTpl;
      }
      return this.prisma.emailTemplate.findFirst({
        where: { companyID: null, eventType: et, enabled: true },
      });
    };

    // Unified single template takes precedence.
    const single = await lookup(SINGLE_TEMPLATE_EVENT);
    if (single) return single;
    return lookup(eventType);
  }
}
