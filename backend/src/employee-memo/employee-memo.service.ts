import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeMemoDto } from './dto/create-employee-memo.dto';
import { UpdateEmployeeMemoDto } from './dto/update-employee-memo.dto';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { MailService } from '../mail/mail.service';
import {
  memoPushTitle,
  senderLabelFromRole,
} from '../common/notification-sender.util';

@Injectable()
export class EmployeeMemoService {
  private readonly logger = new Logger(EmployeeMemoService.name);

  constructor(
    private prisma: PrismaService,
    private pushService: PushNotificationsService,
    private mailService: MailService,
  ) {}

  findAll(employeeID?: number) {
    return this.prisma.employeeMemo.findMany({
      where: employeeID != null ? { employeeID } : undefined,
      include: { manageEmployee: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.employeeMemo.findUnique({
      where: { id },
      include: { manageEmployee: true },
    });
  }

  async create(dto: CreateEmployeeMemoDto) {
    const employeeIDs =
      dto.employeeIDs && dto.employeeIDs.length > 0
        ? dto.employeeIDs
        : dto.employeeID
          ? [dto.employeeID]
          : [];

    if (employeeIDs.length === 0) {
      throw new BadRequestException('At least one employee is required');
    }

    const memos = await Promise.all(
      employeeIDs.map((empId) =>
        this.prisma.employeeMemo.create({
          data: {
            serviceProviderID: dto.serviceProviderID,
            companyID: dto.companyID,
            branchesID: dto.branchesID,
            employeeID: empId,
            employeeIDs: employeeIDs,
            memoType: dto.memoType,
            subject: dto.subject,
            description: dto.description,
            issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : null,
            issuedBy: dto.issuedBy,
          },
        }),
      ),
    );

    const memoTypeLc = (dto.memoType ?? '').toLowerCase();
    const isWarning =
      memoTypeLc.includes('warn') || memoTypeLc === 'warning';
    const senderLabel = senderLabelFromRole(dto.issuedByRole);
    const issuer = dto.issuedBy?.trim() || senderLabel;
    const subject = dto.subject?.trim() || (isWarning ? 'Warning' : 'Notice');
    const pushTitle = memoPushTitle(isWarning, senderLabel);
    const pushBody =
      dto.description?.trim()?.slice(0, 180) ||
      `${issuer}: ${subject}`;

    await Promise.all(
      memos.map(async (memo) => {
        const empId = memo.employeeID;
        if (!empId) return;

        void this.mailService
          .sendToEmployeeWithManagerCc({
            employeeId: empId,
            companyID: dto.companyID,
            eventType: isWarning ? 'WARNING' : 'NOTICE_BOARD',
            vars: {
              subject: dto.subject ?? '',
              description: dto.description ?? '',
            },
          })
          .catch((err) => {
            this.logger.warn(`Memo email skipped for employee ${empId}: ${err?.message || err}`);
          });

        try {
          await this.pushService.sendToEmployee(empId, pushTitle, pushBody, {
            url: '/empNoticeboard',
            kind: 'memo',
            memoId: memo.id,
            tag: `memo-${memo.id}`,
          });
        } catch (err: unknown) {
          this.logger.warn(
            `Memo push failed for employee ${empId}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }),
    );

    return memos.length === 1 ? memos[0] : memos;
  }

  update(id: number, dto: UpdateEmployeeMemoDto) {
    return this.prisma.employeeMemo.update({
      where: { id },
      data: {
        ...dto,
        issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : undefined,
      },
    });
  }

  remove(id: number) {
    return this.prisma.employeeMemo.delete({ where: { id } });
  }
}
