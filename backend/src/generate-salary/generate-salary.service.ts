// src/generate-salary/generate-salary.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGenerateSalaryDto } from './dto/create-generate-salary.dto';
import { UpdateGenerateSalaryDto } from './dto/update-generate-salary.dto';
import { empPayoutHrefForPeriod } from '../common/payslip-period.util';
import { MailService } from '../mail/mail.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';

@Injectable()
export class GenerateSalaryService {
  constructor(
    private prisma: PrismaService,
    private readonly pushService: PushNotificationsService,
    private readonly mailService: MailService,
  ) {}

  private async notifyPayslipGenerated(record: {
    employeeID: number;
    monthPeriod: string;
  }) {
    await this.pushService
      .sendToEmployee(
        record.employeeID,
        'Payslip generated',
        `Your payslip for ${record.monthPeriod} is ready. Review it in Payout and raise a query if needed.`,
        {
          url: empPayoutHrefForPeriod(record.monthPeriod),
          kind: 'payslip',
          event: 'generated',
        },
      )
      .catch(() => null);
  }

  private async notifyPayslipEmail(record: {
    employeeID: number;
    monthPeriod: string;
    companyID?: number | null;
  }) {
    await this.mailService.sendNotificationEmail({
      employeeId: record.employeeID,
      companyID: record.companyID,
      eventType: 'PAYSLIP',
      subject: `Payslip ready — ${record.monthPeriod}`,
      bodyText: `Your payslip for ${record.monthPeriod} has been generated. Please review it in the Payout section.`,
      extraVars: { status: 'Generated', amount: record.monthPeriod },
    });
  }

  private async notifyPayslipPaidEmail(record: {
    employeeID: number;
    monthPeriod: string;
    companyID?: number | null;
  }) {
    await this.mailService.sendNotificationEmail({
      employeeId: record.employeeID,
      companyID: record.companyID,
      eventType: 'PAYSLIP',
      subject: `Salary paid — ${record.monthPeriod}`,
      bodyText: `Your salary for ${record.monthPeriod} has been marked as paid.`,
      extraVars: { status: 'Paid' },
    });
  }

  private async notifyPayslipPaid(record: {
    employeeID: number;
    monthPeriod: string;
  }) {
    await this.pushService
      .sendToEmployee(
        record.employeeID,
        'Salary paid',
        `Your salary for ${record.monthPeriod} has been marked as paid.`,
        {
          url: empPayoutHrefForPeriod(record.monthPeriod),
          kind: 'payslip',
          event: 'paid',
        },
      )
      .catch(() => null);
  }

  async create(dto: CreateGenerateSalaryDto) {
    const {
      serviceProviderID,
      companyID,
      branchesID,
      employeeID,
      monthPeriod,
      paymentMode,
      paymentType,
      paymentDate,
      paymentRemark,
      paymentProof,
    } = dto;

    const created = await this.prisma.generateSalary.create({
      data: {
        serviceProviderID: serviceProviderID ?? null,
        companyID: companyID ?? null,
        branchesID: branchesID ?? null,
        employeeID,
        monthPeriod: monthPeriod,
        paymentMode: paymentMode ? `${paymentMode}` : null,
        paymentType: paymentType ? `${paymentType}` : null,
        paymentDate: paymentDate ? `${paymentDate}` : null,
        paymentRemark: paymentRemark ? `${paymentRemark}` : null,
        paymentProof: paymentProof ? `${paymentProof}` : null,
        status: 'Pending',
      },
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });

    void this.notifyPayslipGenerated(created).catch(() => null);
    void this.notifyPayslipEmail(created).catch(() => null);
    return created;
  }

  findAll() {
    return this.prisma.generateSalary.findMany({
      orderBy: { id: 'desc' },
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.generateSalary.findUnique({
      where: { id },
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

  async update(id: number, dto: UpdateGenerateSalaryDto) {
    const existing = await this.prisma.generateSalary.findUnique({
      where: { id },
    });

    const {
      serviceProviderID,
      companyID,
      branchesID,
      employeeID,
      monthPeriod,
      paymentMode,
      paymentType,
      paymentDate,
      paymentRemark,
      paymentProof,
      status,
    } = dto;

    const newStatus =
      status ??
      (paymentMode && paymentDate ? 'Paid' : undefined);

    const updateData: Record<string, unknown> = {};

    if (serviceProviderID !== undefined) updateData.serviceProviderID = serviceProviderID;
    if (companyID !== undefined) updateData.companyID = companyID;
    if (branchesID !== undefined) updateData.branchesID = branchesID;
    if (employeeID !== undefined) updateData.employeeID = employeeID;
    if (monthPeriod !== undefined) updateData.monthPeriod = monthPeriod;

    if (paymentMode !== undefined) updateData.paymentMode = paymentMode;
    if (paymentType !== undefined) updateData.paymentType = paymentType;
    if (paymentDate !== undefined) updateData.paymentDate = paymentDate;
    if (paymentRemark !== undefined) updateData.paymentRemark = paymentRemark;
    if (paymentProof !== undefined) updateData.paymentProof = paymentProof;

    if (newStatus) updateData.status = newStatus;

    const updated = await this.prisma.generateSalary.update({
      where: { id },
      data: updateData,
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });

    if (existing?.status !== 'Paid' && updated.status === 'Paid') {
      void this.notifyPayslipPaid(updated).catch(() => null);
      void this.notifyPayslipPaidEmail(updated).catch(() => null);
    }

    return updated;
  }

  remove(id: number) {
    return this.prisma.generateSalary.delete({ where: { id } });
  }
}
