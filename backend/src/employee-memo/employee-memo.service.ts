import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
    const where =
      employeeID != null
        ? {
            OR: [
              { employeeID },
              { employeeIDs: { has: employeeID } },
              { senderEmployeeId: employeeID },
            ],
            parentMemoId: null,
            undoneAt: null,
          }
        : { parentMemoId: null, undoneAt: null };

    return this.prisma.employeeMemo.findMany({
      where,
      include: {
        manageEmployee: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const memo = await this.prisma.employeeMemo.findUnique({
      where: { id },
      include: {
        manageEmployee: true,
      },
    });
    if (!memo) throw new NotFoundException('Message not found');

    const replies = await this.prisma.employeeMemo.findMany({
      where: { parentMemoId: id, undoneAt: null },
      orderBy: { createdAt: 'asc' },
    });

    return { ...memo, replies };
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
            senderEmployeeId: dto.senderEmployeeId ?? null,
            attachmentPath: dto.attachmentPath ?? null,
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

  async undo(id: number, actorEmployeeId?: number) {
    const memo = await this.prisma.employeeMemo.findUnique({ where: { id } });
    if (!memo) throw new NotFoundException('Message not found');
    if (memo.undoneAt) throw new BadRequestException('Already undone');

    const ageMs = Date.now() - new Date(memo.createdAt).getTime();
    if (ageMs > 30 * 60 * 1000) {
      throw new BadRequestException('Undo is only available within 30 minutes');
    }

    if (
      actorEmployeeId != null &&
      memo.senderEmployeeId != null &&
      memo.senderEmployeeId !== actorEmployeeId
    ) {
      throw new ForbiddenException('Only the sender can undo this message');
    }

    return this.prisma.employeeMemo.update({
      where: { id },
      data: { undoneAt: new Date() },
    });
  }

  async reply(
    parentId: number,
    dto: {
      message: string;
      issuedBy?: string;
      issuedByRole?: string;
      senderEmployeeId?: number;
    },
  ) {
    const parent = await this.prisma.employeeMemo.findUnique({
      where: { id: parentId },
    });
    if (!parent || parent.undoneAt) {
      throw new NotFoundException('Parent message not found');
    }

    return this.prisma.employeeMemo.create({
      data: {
        serviceProviderID: parent.serviceProviderID,
        companyID: parent.companyID,
        branchesID: parent.branchesID,
        employeeID: parent.employeeID,
        employeeIDs: parent.employeeIDs,
        memoType: parent.memoType,
        subject: parent.subject ? `Re: ${parent.subject}` : 'Re:',
        description: dto.message,
        issuedDate: new Date(),
        issuedBy: dto.issuedBy,
        senderEmployeeId: dto.senderEmployeeId ?? null,
        parentMemoId: parentId,
      },
    });
  }

  async remove(id: number, actorEmployeeId?: number) {
    const memo = await this.prisma.employeeMemo.findUnique({ where: { id } });
    if (!memo) throw new NotFoundException('Message not found');
    if (
      actorEmployeeId != null &&
      memo.senderEmployeeId != null &&
      memo.senderEmployeeId !== actorEmployeeId
    ) {
      throw new ForbiddenException('Only the owner can delete this message');
    }
    await this.prisma.employeeMemo.deleteMany({ where: { parentMemoId: id } });
    return this.prisma.employeeMemo.delete({ where: { id } });
  }
}
