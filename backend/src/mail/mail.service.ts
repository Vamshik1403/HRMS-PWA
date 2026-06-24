import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
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

  private static readonly PRODUCT_NAME_RE = /\bopenhrm\b/gi;

  /** Legacy templates / SMTP defaults may still say OpenHRM — always use company name. */
  private applyCompanyBranding(text: string, companyName: string): string {
    const name = companyName.trim();
    if (!name) return text;
    return text.replace(MailService.PRODUCT_NAME_RE, name);
  }

  private extractSmtpEmail(smtpFrom: string): string {
    const raw = smtpFrom.trim();
    const match = raw.match(/<([^>]+)>/);
    return (match ? match[1] : raw).trim();
  }

  private async resolveCompanyName(companyID?: number | null): Promise<string> {
    if (companyID == null) return '';
    const company = await this.prisma.company.findUnique({
      where: { id: companyID },
      select: { companyName: true },
    });
    return company?.companyName?.trim() || '';
  }

  private async resolveCompanyNameForEmployee(
    emp: {
      companyID: number | null;
      company?: { companyName: string | null } | null;
      branchesID?: number | null;
    },
    explicitCompanyID?: number | null,
  ): Promise<string> {
    const fromEmp = emp.company?.companyName?.trim();
    if (fromEmp) return fromEmp;

    const companyID = explicitCompanyID ?? emp.companyID;
    const fromId = await this.resolveCompanyName(companyID);
    if (fromId) return fromId;

    if (emp.branchesID != null) {
      const branch = await this.prisma.branches.findUnique({
        where: { id: emp.branchesID },
        include: { company: { select: { companyName: true } } },
      });
      const fromBranch = branch?.company?.companyName?.trim();
      if (fromBranch) return fromBranch;
    }

    return '';
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
        branches: { include: { company: { select: { companyName: true } } } },
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
      (await this.resolveCompanyNameForEmployee(emp, companyID)) ||
      emp.branches?.company?.companyName?.trim() ||
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
      ...params.vars,
      employeeName,
      eventLabel:
        EVENT_LABELS[params.eventType] ||
        params.eventType.replace(/_/g, ' ').toLowerCase(),
      companyName,
    };

    const subject = this.applyCompanyBranding(
      tpl
        ? this.render(this.applyCompanyBranding(tpl.subject, companyName), vars)
        : params.fallbackSubject ||
          `[${companyName}] ${params.eventType.replace(/_/g, ' ')}`,
      companyName,
    );
    const html = this.applyCompanyBranding(
      tpl
        ? this.render(this.applyCompanyBranding(tpl.bodyHtml, companyName), vars)
        : params.fallbackHtml ||
          `<p>${Object.entries(vars).map(([k, v]) => `<strong>${k}</strong>: ${v}`).join('<br/>')}</p>`,
      companyName,
    );

    const { from: smtpFrom } = this.smtpConfig();
    const fromAddress = this.extractSmtpEmail(smtpFrom);

    try {
      await transporter.sendMail({
        from: { name: companyName, address: fromAddress },
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

  /** Email daily backup ZIP (all sectional SQL files) to the configured admin address. */
  async sendDailyBackupEmail(params: {
    dateLabel: string;
    dayDir: string;
    zipPath?: string;
    zipFileName?: string;
    files: Array<{ key: string; label: string; fileName: string; sizeBytes: number }>;
  }): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.warn('SMTP not configured; skipping backup email');
      return false;
    }

    const to =
      this.config.get<string>('BACKUP_EMAIL') ||
      process.env.BACKUP_EMAIL ||
      this.smtpConfig().user;
    if (!to) {
      this.logger.warn('BACKUP_EMAIL / SMTP_USER not set; skipping backup email');
      return false;
    }

    const { from: smtpFrom } = this.smtpConfig();
    const fromAddress = this.extractSmtpEmail(smtpFrom);
    const maxAttachBytes = Number(process.env.BACKUP_EMAIL_MAX_BYTES || 20 * 1024 * 1024);
    const fileList = params.files
      .map(
        (f) =>
          `• ${f.label}: ${f.fileName} (${(f.sizeBytes / 1024).toFixed(1)} KB)`,
      )
      .join('\n');

    let attachPath: string;
    let attachName: string;
    let note = '';

    if (params.zipPath && params.zipFileName && fs.existsSync(params.zipPath)) {
      const zipSize = fs.statSync(params.zipPath).size;
      attachPath = params.zipPath;
      attachName = params.zipFileName;
      if (zipSize > maxAttachBytes) {
        const attendance = params.files.find((f) => f.key === 'attendance');
        if (!attendance) {
          this.logger.warn('Backup ZIP too large for email and no fallback file');
          return false;
        }
        attachPath = path.join(params.dayDir, attendance.fileName);
        attachName = attendance.fileName;
        note = `ZIP (${(zipSize / (1024 * 1024)).toFixed(1)} MB) stored on server. Attached attendance SQL only.\n\n`;
      }
    } else {
      const fullDb = params.files.find((f) => f.key === 'full-database');
      const attendance = params.files.find((f) => f.key === 'attendance');
      const fallback =
        fullDb ||
        attendance ||
        [...params.files].sort((a, b) => b.sizeBytes - a.sizeBytes)[0];
      if (!fallback) return false;
      attachPath = path.join(params.dayDir, fallback.fileName);
      attachName = fallback.fileName;
      note = 'ZIP unavailable — attached full database SQL from server backup.\n\n';
    }

    const subject = `OpenHRM daily backup — ${params.dateLabel}`;
    const text =
      `${note}` +
      `Automated backup completed for ${params.dateLabel}.\n\n` +
      `Files on server:\n${fileList}\n\n` +
      `Attached: ${attachName}\n`;

    try {
      await transporter.sendMail({
        from: { name: 'OpenHRM Backup', address: fromAddress },
        to,
        subject,
        text,
        attachments: [
          {
            filename: `${params.dateLabel}-${attachName}`,
            path: attachPath,
          },
        ],
      });
      this.logger.log(`Backup email sent to ${to} (${attachName})`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to send backup email: ${String(err)}`);
      return false;
    }
  }
}
