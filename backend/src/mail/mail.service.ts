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
  | 'WARNING';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailTemplateService: EmailTemplateService,
  ) {}

  private getTransporter() {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (!host || !user || !pass) return null;
    const port = Number(this.config.get<string>('SMTP_PORT') || '587');
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  private render(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
  }

  async sendToEmployeeWithManagerCc(params: {
    employeeId: number;
    eventType: MailEventType;
    vars: Record<string, string>;
    companyID?: number | null;
  }): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.debug('SMTP not configured; skipping email');
      return;
    }

    const emp = await this.prisma.manageEmployee.findUnique({
      where: { id: params.employeeId },
      include: {
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
    if (!emp) return;

    const to =
      emp.businessEmail?.trim() ||
      emp.personalEmail?.trim() ||
      '';
    if (!to) return;

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

    const tpl = await this.emailTemplateService.getTemplateForSend(
      params.eventType,
      params.companyID ?? emp.companyID,
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
    };

    const vars: Record<string, string> = {
      employeeName,
      eventLabel: EVENT_LABELS[params.eventType] || params.eventType.replace(/_/g, ' ').toLowerCase(),
      ...params.vars,
    };

    const subject = tpl
      ? this.render(tpl.subject, vars)
      : `[OpenHRM] ${params.eventType.replace(/_/g, ' ')}`;
    const html = tpl
      ? this.render(tpl.bodyHtml, vars)
      : `<p>${Object.entries(vars).map(([k, v]) => `<strong>${k}</strong>: ${v}`).join('<br/>')}</p>`;

    const from =
      this.config.get<string>('SMTP_FROM') ||
      this.config.get<string>('SMTP_USER') ||
      'noreply@openhrm.local';

    try {
      await transporter.sendMail({
        from,
        to,
        cc: cc.length ? cc : undefined,
        subject,
        html,
      });
    } catch (err) {
      this.logger.warn(`Failed to send ${params.eventType} email: ${String(err)}`);
    }
  }
}
