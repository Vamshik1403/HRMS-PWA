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

  async findAll(employeeID?: number) {
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

    const rows = await this.prisma.employeeMemo.findMany({
      where,
      include: {
        manageEmployee: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return this.attachRecipients(rows);
  }

  private async attachRecipients<T extends { employeeID?: number | null; employeeIDs?: number[] }>(
    rows: T[],
  ): Promise<(T & { recipients?: { id: number; employeeFirstName: string | null; employeeLastName: string | null; employeeID: string | null }[] })[]> {
    const idSet = new Set<number>();
    for (const row of rows) {
      if (row.employeeIDs?.length) {
        row.employeeIDs.forEach((id) => idSet.add(id));
      } else if (row.employeeID) {
        idSet.add(row.employeeID);
      }
    }
    if (idSet.size === 0) return rows;

    const employees = await this.prisma.manageEmployee.findMany({
      where: { id: { in: [...idSet] } },
      select: {
        id: true,
        employeeFirstName: true,
        employeeLastName: true,
        employeeID: true,
      },
    });
    const byId = new Map(employees.map((e) => [e.id, e]));

    return rows.map((row) => {
      const ids =
        row.employeeIDs && row.employeeIDs.length > 0
          ? row.employeeIDs
          : row.employeeID
            ? [row.employeeID]
            : [];
      const recipients = ids
        .map((id) => byId.get(id))
        .filter((e): e is NonNullable<typeof e> => e != null);
      return { ...row, recipients };
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

    const memo = await this.prisma.employeeMemo.create({
      data: {
        serviceProviderID: dto.serviceProviderID,
        companyID: dto.companyID,
        branchesID: dto.branchesID,
        employeeID: employeeIDs[0],
        employeeIDs: employeeIDs,
        memoType: dto.memoType,
        subject: dto.subject,
        description: dto.description,
        issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : null,
        issuedBy: dto.issuedBy,
        senderEmployeeId: dto.senderEmployeeId ?? null,
        attachmentPath: dto.attachmentPath ?? null,
      },
    });
    const memos = [memo];

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

    const notifyEmployeeIds = [...new Set(employeeIDs)];
    await Promise.all(
      notifyEmployeeIds.map(async (empId) => {
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

    const [withRecipients] = await this.attachRecipients(memos);
    return withRecipients ?? memo;
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
    if (!memo.parentMemoId) {
      throw new BadRequestException('Only chat messages can be undone');
    }
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

    const reply = await this.prisma.employeeMemo.create({
      data: {
        serviceProviderID: parent.serviceProviderID,
        companyID: parent.companyID,
        branchesID: parent.branchesID,
        employeeID: dto.senderEmployeeId ?? parent.employeeID,
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

    const recipientIds =
      parent.employeeIDs && parent.employeeIDs.length > 0
        ? parent.employeeIDs
        : parent.employeeID
          ? [parent.employeeID]
          : [];

    const senderName = dto.issuedBy?.trim() || 'Someone';
    const threadSubject = parent.subject?.trim() || 'Internal Message';
    const pushTitle = `IM: ${threadSubject}`;
    const pushBody =
      dto.message.trim().slice(0, 180) ||
      `${senderName} sent a new message`;
    const isEmployeeReply = dto.senderEmployeeId != null;
    const pushTargets = new Set(recipientIds);

    for (const empId of pushTargets) {
      if (isEmployeeReply && empId === dto.senderEmployeeId) continue;
      try {
        await this.pushService.sendToEmployee(empId, pushTitle, pushBody, {
          url: '/empNoticeboard',
          kind: 'memo',
          memoId: parentId,
          tag: `memo-reply-${reply.id}`,
        });
      } catch (err: unknown) {
        this.logger.warn(
          `Memo reply push failed for employee ${empId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return reply;
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
