import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { EmailTemplateService } from '../email-template/email-template.service';

export type MailEventType =
  | 'LEAVE_APPLICATION'
  | 'REIMBURSEMENT'
  | 'OFFBOARDING'
  | 'NOTICE_BOARD'
  | 'WARNING'
  | 'TASK_ASSIGNED'
  | 'TASK_MESSAGE'
  | 'PAYSLIP'
  | 'GENERAL';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailTemplateService: EmailTemplateService,
  ) {}

  private smtpConfig() {
    const host =
      this.config.get<string>('SMTP_HOST') || process.env.SMTP_HOST || '';
    const user =
      this.config.get<string>('SMTP_USER') || process.env.SMTP_USER || '';
    const pass =
      this.config.get<string>('SMTP_PASS') || process.env.SMTP_PASS || '';
    const port = Number(
      this.config.get<string>('SMTP_PORT') || process.env.SMTP_PORT || '587',
    );
    const from =
      this.config.get<string>('SMTP_FROM') ||
      process.env.SMTP_FROM ||
      user ||
      'noreply@openhrm.local';
    return { host, user, pass, port, from };
  }

  private getTransporter() {
    const { host, user, pass, port } = this.smtpConfig();
    if (!host || !user || !pass) return null;
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      ...(port === 587
        ? { requireTLS: true, tls: { minVersion: 'TLSv1.2' as const } }
        : {}),
    });
  }

  isConfigured(): boolean {
    const { host, user, pass } = this.smtpConfig();
    return !!(host && user && pass);
  }

  private render(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
  }

  /** Legacy templates may still contain the static product name — swap at send time. */
  private applyCompanyBranding(template: string, companyName: string): string {
    if (!companyName.trim()) return template;
    return template.replace(/\bOpenHRM\b/g, companyName.trim());
  }

  private formatFromAddress(companyName: string, smtpFrom: string): string {
    const raw = smtpFrom.trim();
    const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
    const email = (match ? match[2] : raw).trim();
    const display = companyName.trim() || (match ? match[1].replace(/^["']|["']$/g, '').trim() : 'HR');
    return `"${display.replace(/"/g, '')}" <${email}>`;
  }

  private async resolveCompanyName(companyID?: number | null): Promise<string> {
    if (companyID == null) return '';
    const company = await this.prisma.company.findUnique({
      where: { id: companyID },
      select: { companyName: true },
    });
    return company?.companyName?.trim() || '';
  }

  /** Simple notification email (same delivery path as leave/reimbursement). */
  async sendNotificationEmail(params: {
    employeeId: number;
    subject: string;
    bodyText: string;
    eventType?: MailEventType;
    companyID?: number | null;
    extraVars?: Record<string, string>;
  }): Promise<boolean> {
    return this.sendToEmployeeWithManagerCc({
      employeeId: params.employeeId,
      companyID: params.companyID,
      eventType: params.eventType ?? 'GENERAL',
      vars: {
        subject: params.subject,
        description: params.bodyText,
        details: params.bodyText,
        ...params.extraVars,
      },
      fallbackSubject: params.subject,
      fallbackHtml: `<p>${params.bodyText.replace(/\n/g, '<br/>')}</p>`,
    });
  }

  async sendToEmployeeWithManagerCc(params: {
    employeeId: number;
    eventType: MailEventType;
    vars: Record<string, string>;
    companyID?: number | null;
    fallbackSubject?: string;
    fallbackHtml?: string;
  }): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.warn('SMTP not configured; skipping email');
      return false;
    }

    const emp = await this.prisma.manageEmployee.findUnique({
      where: { id: params.employeeId },
      include: {
        company: { select: { companyName: true } },
        employeeLinks: {
          include: {
            linkedEmployee: {
              select: {
                businessEmail: true,
                personalEmail: true,
                employeeFirstName: true,
                employeeLastName: true,
              },
            },
          },
        },
      },
    });
    if (!emp) {
      this.logger.warn(`Email skipped: employee ${params.employeeId} not found`);
      return false;
    }

    const to =
      emp.businessEmail?.trim() ||
      emp.personalEmail?.trim() ||
      '';
    if (!to) {
      this.logger.warn(
        `Email skipped: no address for employee ${params.employeeId} (${emp.employeeID})`,
      );
      return false;
    }

    const cc = [
      ...new Set(
        emp.employeeLinks
          .map(
            (l) =>
              l.linkedEmployee.businessEmail?.trim() ||
              l.linkedEmployee.personalEmail?.trim() ||
              '',
          )
          .filter(Boolean),
      ),
    ];

    const companyID = params.companyID ?? emp.companyID;
    const companyName =
      emp.company?.companyName?.trim() ||
      (await this.resolveCompanyName(companyID)) ||
      'HR';

    const tpl = await this.emailTemplateService.getTemplateForSend(
      params.eventType,
      companyID,
    );
    const employeeName =
      `${emp.employeeFirstName ?? ''} ${emp.employeeLastName ?? ''}`.trim() ||
      emp.employeeID ||
      String(emp.id);

    const EVENT_LABELS: Record<string, string> = {
      LEAVE_APPLICATION: 'leave application',
      REIMBURSEMENT: 'reimbursement',
      OFFBOARDING: 'offboarding',
      NOTICE_BOARD: 'notice',
      WARNING: 'warning notice',
      TASK_ASSIGNED: 'task assignment',
      TASK_MESSAGE: 'task message',
      PAYSLIP: 'payslip',
      GENERAL: 'notification',
    };

    const vars: Record<string, string> = {
      employeeName,
      companyName,
      eventLabel: EVENT_LABELS[params.eventType] || params.eventType.replace(/_/g, ' ').toLowerCase(),
      ...params.vars,
    };

    const subject = tpl
      ? this.render(this.applyCompanyBranding(tpl.subject, companyName), vars)
      : params.fallbackSubject ||
        `[${companyName}] ${params.eventType.replace(/_/g, ' ')}`;
    const html = tpl
      ? this.render(this.applyCompanyBranding(tpl.bodyHtml, companyName), vars)
      : params.fallbackHtml ||
        `<p>${Object.entries(vars).map(([k, v]) => `<strong>${k}</strong>: ${v}`).join('<br/>')}</p>`;

    const { from: smtpFrom } = this.smtpConfig();
    const from = this.formatFromAddress(companyName, smtpFrom);

    try {
      await transporter.sendMail({
        from,
        to,
        cc: cc.length ? cc : undefined,
        subject,
        html,
      });
      this.logger.log(`Email sent (${params.eventType}) to ${to}`);
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to send ${params.eventType} email to ${to}: ${String(err)}`,
      );
      return false;
    }
  }
}
