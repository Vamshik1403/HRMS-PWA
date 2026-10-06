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
import { EmpManagerScopeService } from '../common/emp-manager-scope.service';
import {
  COMPANY_BROADCAST_PREFIX,
  isCompanyBroadcastSubject,
  isPersonalHrBroadcastDescription,
  personalHrDescriptionNamesViewer,
} from './system-broadcast.util';

@Injectable()
export class EmployeeMemoService {
  private readonly logger = new Logger(EmployeeMemoService.name);

  constructor(
    private prisma: PrismaService,
    private pushService: PushNotificationsService,
    private mailService: MailService,
    private managerScope: EmpManagerScopeService,
  ) {}

  async findAll(employeeID?: number) {
    const identityIds =
      employeeID != null ? await this.resolveMessagingIdentityIds(employeeID) : null;

    const where =
      identityIds != null
        ? {
            OR: [
              { employeeID: { in: identityIds } },
              ...identityIds.map((id) => ({ employeeIDs: { has: id } })),
              { senderEmployeeId: { in: identityIds } },
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

    const visible =
      identityIds != null
        ? await this.filterSystemBroadcastsForViewer(identityIds[0], rows)
        : rows;
    return this.attachRecipients(visible);
  }

  /**
   * Include inactive duplicate employee rows (same company + same name) so messages
   * sent to an EXITED duplicate still appear for the ACTIVE login identity.
   */
  private async resolveMessagingIdentityIds(employeeID: number): Promise<number[]> {
    const self = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeID },
      select: {
        id: true,
        companyID: true,
        employeeFirstName: true,
        employeeLastName: true,
      },
    });
    if (!self) return [employeeID];

    const first = self.employeeFirstName?.trim();
    const last = self.employeeLastName?.trim();
    if (!self.companyID || !first || !last) return [employeeID];

    const aliases = await this.prisma.manageEmployee.findMany({
      where: {
        id: { not: employeeID },
        companyID: self.companyID,
        employeeFirstName: { equals: first, mode: 'insensitive' },
        employeeLastName: { equals: last, mode: 'insensitive' },
        isDeleted: false,
        lifecycleStatus: { not: 'ACTIVE' },
      },
      select: { id: true },
    });

    return [employeeID, ...aliases.map((row) => row.id)];
  }

  /** Prefer ACTIVE employee when a recipient id points at an EXITED duplicate. */
  private async resolveActiveRecipientIds(employeeIDs: number[]): Promise<number[]> {
    if (employeeIDs.length === 0) return employeeIDs;

    const employees = await this.prisma.manageEmployee.findMany({
      where: { id: { in: employeeIDs } },
      select: {
        id: true,
        companyID: true,
        employeeFirstName: true,
        employeeLastName: true,
        lifecycleStatus: true,
      },
    });

    const resolved: number[] = [];
    for (const emp of employees) {
      if (emp.lifecycleStatus === 'ACTIVE' || !emp.companyID) {
        resolved.push(emp.id);
        continue;
      }

      const first = emp.employeeFirstName?.trim();
      const last = emp.employeeLastName?.trim();
      if (!first || !last) {
        resolved.push(emp.id);
        continue;
      }

      const active = await this.prisma.manageEmployee.findFirst({
        where: {
          id: { not: emp.id },
          companyID: emp.companyID,
          employeeFirstName: { equals: first, mode: 'insensitive' },
          employeeLastName: { equals: last, mode: 'insensitive' },
          isDeleted: false,
          lifecycleStatus: 'ACTIVE',
        },
        select: { id: true },
        orderBy: { id: 'desc' },
      });

      resolved.push(active?.id ?? emp.id);
    }

    return [...new Set(resolved)];
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

  private isCompanyBroadcastSubject(subject?: string | null): boolean {
    return isCompanyBroadcastSubject(subject);
  }

  /**
   * Holidays and other company-wide notices. Personal HR events must use
   * createSystemStaffBroadcast so they are not posted to every employee.
   */
  async createSystemCompanyBroadcast(opts: {
    companyID: number;
    description: string;
    branchesID?: number | null;
    serviceProviderID?: number | null;
  }): Promise<void> {
    const companyID = Number(opts.companyID);
    if (!Number.isFinite(companyID) || companyID <= 0) return;
    const employees = await this.prisma.manageEmployee.findMany({
      where: {
        companyID,
        isDeleted: false,
        lifecycleStatus: 'ACTIVE',
      },
      select: { id: true },
    });
    await this.persistSystemBroadcast({
      companyID,
      description: opts.description,
      branchesID: opts.branchesID,
      serviceProviderID: opts.serviceProviderID,
      employeeIDs: employees.map((e) => e.id),
    });
  }

  /** Leave, payroll, and named task assignment — subject + managers + owners. */
  async createSystemStaffBroadcast(opts: {
    companyID: number;
    description: string;
    subjectEmployeeIDs: number[];
    branchesID?: number | null;
    serviceProviderID?: number | null;
  }): Promise<void> {
    const companyID = Number(opts.companyID);
    if (!Number.isFinite(companyID) || companyID <= 0) return;

    const subjectIds = [
      ...new Set(
        (opts.subjectEmployeeIDs || [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];
    const recipientIds = new Set<number>(subjectIds);
    for (const id of subjectIds) {
      const managers = await this.managerScope.getManagerIdsForEmployee(id);
      for (const managerId of managers) {
        if (Number.isFinite(managerId) && managerId > 0) recipientIds.add(managerId);
      }
    }
    const owners = await this.prisma.manageEmployee.findMany({
      where: {
        companyID,
        isCompanyOwner: true,
        isDeleted: false,
        lifecycleStatus: 'ACTIVE',
      },
      select: { id: true },
    });
    for (const owner of owners) recipientIds.add(owner.id);

    await this.persistSystemBroadcast({
      companyID,
      description: opts.description,
      branchesID: opts.branchesID,
      serviceProviderID: opts.serviceProviderID,
      employeeIDs: [...recipientIds],
    });
  }

  async filterSystemBroadcastsForViewer<
    T extends { subject?: string | null; description?: string | null },
  >(viewerEmployeeId: number, memos: T[]): Promise<T[]> {
    const personal = memos.filter(
      (m) =>
        isCompanyBroadcastSubject(m.subject) &&
        isPersonalHrBroadcastDescription(m.description),
    );
    if (personal.length === 0) return memos;

    const viewer = await this.prisma.manageEmployee.findUnique({
      where: { id: viewerEmployeeId },
      select: {
        id: true,
        isCompanyOwner: true,
        employeeFirstName: true,
        employeeLastName: true,
        employeeID: true,
      },
    });
    if (viewer?.isCompanyOwner) return memos;

    const reporteeIds = await this.managerScope.getDirectReporteeIds(viewerEmployeeId);
    const reportees =
      reporteeIds.length > 0
        ? await this.prisma.manageEmployee.findMany({
            where: { id: { in: reporteeIds } },
            select: {
              employeeFirstName: true,
              employeeLastName: true,
              employeeID: true,
            },
          })
        : [];

    return memos.filter((memo) => {
      if (!isCompanyBroadcastSubject(memo.subject)) return true;
      if (!isPersonalHrBroadcastDescription(memo.description)) return true;
      if (viewer && personalHrDescriptionNamesViewer(memo.description, viewer)) {
        return true;
      }
      return reportees.some((r) => personalHrDescriptionNamesViewer(memo.description, r));
    });
  }

  private async persistSystemBroadcast(opts: {
    companyID: number;
    description?: string | null;
    branchesID?: number | null;
    serviceProviderID?: number | null;
    employeeIDs: number[];
  }): Promise<void> {
    const companyID = opts.companyID;
    const description = opts.description?.trim();
    if (!description) return;
    const employeeIDs = [...new Set(opts.employeeIDs.filter((id) => Number.isFinite(id) && id > 0))];
    if (employeeIDs.length === 0) return;

    try {
      const company = await this.prisma.company.findUnique({
        where: { id: companyID },
        select: { companyName: true },
      });
      const companyName = company?.companyName?.trim() || 'Company';

      await this.prisma.employeeMemo.create({
        data: {
          companyID,
          branchesID: opts.branchesID ?? null,
          serviceProviderID: opts.serviceProviderID ?? null,
          employeeID: employeeIDs[0],
          employeeIDs,
          memoType: 'General',
          subject: `${COMPANY_BROADCAST_PREFIX}${companyID}::${companyName}`,
          description,
          issuedDate: new Date(),
          issuedBy: 'System',
          senderEmployeeId: null,
        },
      });
    } catch (err: unknown) {
      this.logger.warn(
        `Company broadcast failed for company ${companyID}: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  async create(dto: CreateEmployeeMemoDto) {
    if (this.isCompanyBroadcastSubject(dto.subject)) {
      throw new ForbiddenException(
        'Company channel is view-only. Notifications are posted by the system.',
      );
    }

    const requestedIds =
      dto.employeeIDs && dto.employeeIDs.length > 0
        ? dto.employeeIDs
        : dto.employeeID
          ? [dto.employeeID]
          : [];

    const employeeIDs = await this.resolveActiveRecipientIds(requestedIds);

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
        if (isWarning) {
          void this.mailService
            .sendToEmployeeWithManagerCc({
              employeeId: empId,
              companyID: dto.companyID,
              eventType: 'WARNING',
              vars: {
                subject: dto.subject ?? '',
                description: dto.description ?? '',
              },
            })
            .catch((err) => {
              this.logger.warn(`Memo email skipped for employee ${empId}: ${err?.message || err}`);
            });
        }

        try {
          await this.pushService.sendToEmployee(empId, pushTitle, pushBody, {
            url: '/empProfile?tab=messaging',
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
    if (this.isCompanyBroadcastSubject(parent.subject)) {
      throw new ForbiddenException(
        'Company channel is view-only. Replies are not allowed.',
      );
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
          url: '/empProfile?tab=messaging',
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
