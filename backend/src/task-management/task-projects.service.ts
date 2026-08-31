import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmpManagerScopeService } from '../common/emp-manager-scope.service';
import { MailService } from '../mail/mail.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import {
  CreateTaskProjectDto,
  CreateTaskChatDto,
  CreateTaskRemarkDto,
  TaskPriorityChangeDto,
  TaskStatusChangeDto,
  UpdateTaskProjectDto,
} from './dto/create-task-project.dto';
import { canManageTaskModule, parseViewer, TaskViewerContext } from './task-context';
import { nextTaskCode } from './task-code.util';
import { EmployeeMemoService } from '../employee-memo/employee-memo.service';
import { EnplSyncService } from '../enpl-sync/enpl-sync.service';
import { loadEmployeePermissions } from '../common/employee-permission.util';
import { hasModuleAction } from '../common/company-module-permissions';
import { getMutuallyLinkedCompanyIds } from '../company/federal-domain.util';

export function normalizeTaskStatus(status?: string | null): string | undefined {
  if (!status) return undefined;
  const value = String(status).trim();
  if (!value) return undefined;
  if (value === 'WIP') return 'Work in Progress';
  if (value === 'Closed') return 'Completed';
  return value;
}

const TASK_NESTED_INCLUDE = {
  contacts: true,
  workscopeDetails: { include: { category: true } },
  schedules: true,
  images: true,
  notes: true,
  inventories: { include: { product: true } },
  purchase: { include: { products: true, attachments: true } },
  engineerAssignments: true,
};

function taskListInclude(viewer: TaskViewerContext) {
  return {
    department: { select: { id: true, departmentName: true } },
    customer: { select: { id: true, customerCode: true, customerName: true } },
    site: { select: { id: true, branchName: true, city: true } },
    createdByEmployee: {
      select: { id: true, employeeFirstName: true, employeeLastName: true, employeeID: true },
    },
    assignments: {
      include: {
        manageEmployee: {
          select: { id: true, employeeFirstName: true, employeeLastName: true, employeeID: true },
        },
      },
    },
    chats: {
      orderBy: { createdAt: 'asc' as const },
      take: 80,
      select: {
        id: true,
        message: true,
        createdAt: true,
        employeeID: true,
        userID: true,
        recipientEmployeeID: true,
        senderName: true,
        attachmentUrl: true,
      },
    },
    _count: { select: { remarks: true, chats: true, activities: true } },
    ...TASK_NESTED_INCLUDE,
  };
}

type TaskChatRow = {
  employeeID: number | null;
  userID: number | null;
  recipientEmployeeID?: number | null;
  message?: string | null;
};

const SITE_PUNCH_IN_RE = /site\s*mark\s*in\b/i;
const SITE_PUNCH_OUT_RE = /site\s*mark\s*out\b/i;
const SITE_PUNCH_ANY_RE =
  /\b(mark(?:ed)?\s*(in|out)|check(?:ed)?\s*(in|out)|site\s*(?:mark\s*)?(?:in|out))\b/i;

function isSitePunchText(text?: string | null): boolean {
  return SITE_PUNCH_ANY_RE.test((text || '').trim());
}

function parseSitePunchKind(text?: string | null): 'in' | 'out' | null {
  const msg = (text || '').trim();
  if (!msg) return null;
  if (SITE_PUNCH_OUT_RE.test(msg)) return 'out';
  if (SITE_PUNCH_IN_RE.test(msg)) return 'in';
  return null;
}

function lastSitePunchKindFromMessages(messages: { message?: string | null; createdAt?: Date | string }[]): 'in' | 'out' | null {
  const ordered = [...messages].sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
  );
  let last: 'in' | 'out' | null = null;
  for (const row of ordered) {
    const kind = parseSitePunchKind(row.message);
    if (kind) last = kind;
  }
  return last;
}

/** Employees see their own messages and admin messages (broadcast or addressed to them).
 *  Site check-in/out posts are visible to everyone with task access so the assigner can see punch times. */
function filterChatsForEmployeeViewer(
  chats: TaskChatRow[],
  viewer: TaskViewerContext,
): TaskChatRow[] {
  if (canManageTaskModule(viewer) || !viewer.employeeId) return chats;
  const me = viewer.employeeId;
  return chats.filter((c) => {
    if (isSitePunchText(c.message)) return true;
    if (c.employeeID != null && c.employeeID === me) return true;
    if (c.employeeID != null && c.employeeID !== me) return false;
    // Admin / manager message (userID set, no employeeID)
    if (c.userID != null) {
      return c.recipientEmployeeID == null || c.recipientEmployeeID === me;
    }
    return false;
  });
}

@Injectable()
export class TaskProjectsService {
  constructor(
    private prisma: PrismaService,
    private pushService: PushNotificationsService,
    private mailService: MailService,
    private managerScope: EmpManagerScopeService,
    private employeeMemoService: EmployeeMemoService,
    private enplSync: EnplSyncService,
  ) {}

  private async resolveViewer(query: Record<string, string | undefined>): Promise<TaskViewerContext> {
    const viewer = parseViewer(query);
    if (canManageTaskModule(viewer) || !viewer.employeeId) return viewer;
    const emp = await this.prisma.manageEmployee.findFirst({
      where: { id: viewer.employeeId, isDeleted: false },
      select: { isCompanyOwner: true, companyID: true },
    });
    if (!emp) return viewer;
    if (emp.isCompanyOwner) {
      viewer.isCompanyOwner = true;
      if (!viewer.companyID && emp.companyID) viewer.companyID = emp.companyID;
      return viewer;
    }
    const perms = await loadEmployeePermissions(this.prisma, viewer.employeeId, emp.companyID, false);
    viewer.canManageTasks =
      hasModuleAction(perms, false, 'TASKS', 'view') ||
      hasModuleAction(perms, false, 'TASKS', 'create') ||
      hasModuleAction(perms, false, 'TASKS', 'edit');
    return viewer;
  }

  private async visibilityWhere(
    viewer: TaskViewerContext,
    companyID?: number,
  ): Promise<Record<string, unknown>> {
    const companyFilter: Record<string, unknown> = {};
    if (companyID) companyFilter.companyID = companyID;
    else if (viewer.companyID && viewer.role !== 'SUPERADMIN') {
      companyFilter.companyID = viewer.companyID;
    }

    if (canManageTaskModule(viewer)) {
      return { isDeleted: false, ...companyFilter };
    }

    const or: Record<string, unknown>[] = [];
    if (viewer.employeeId) {
      const scopeIds = await this.managerScope.getReporteeIds(viewer.employeeId);
      or.push({
        AND: [{ ...companyFilter }, { createdByEmployeeID: { in: scopeIds } }],
      });
      or.push({ assignments: { some: { manageEmployeeID: { in: scopeIds } } } });
      or.push({ engineerAssignments: { some: { manageEmployeeID: { in: scopeIds } } } });
    }
    if (viewer.userId) {
      or.push({ AND: [{ ...companyFilter }, { createdByUserID: viewer.userId }] });
    }
    if (!or.length) throw new ForbiddenException('Access denied');
    return { isDeleted: false, OR: or };
  }

  private async assertTaskAccess(taskId: number, viewer: TaskViewerContext) {
    const task = await this.prisma.taskProject.findFirst({
      where: { id: taskId, isDeleted: false },
      include: { assignments: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    if (canManageTaskModule(viewer)) {
      if (
        viewer.role !== 'SUPERADMIN' &&
        viewer.companyID &&
        task.companyID !== viewer.companyID
      ) {
        throw new NotFoundException('Task not found');
      }
      return task;
    }

    const scopeIds = viewer.employeeId
      ? await this.managerScope.getReporteeIds(viewer.employeeId)
      : [];
    const isCreator =
      (viewer.employeeId && task.createdByEmployeeID != null && scopeIds.includes(task.createdByEmployeeID)) ||
      (viewer.userId && task.createdByUserID === viewer.userId);
    const isAssigned = viewer.employeeId
      ? task.assignments.some((a) => scopeIds.includes(a.manageEmployeeID))
      : false;
    if (!isCreator && !isAssigned) throw new ForbiddenException('Access denied');
    return task;
  }

  private async attachSitePunches<T extends { id: number }>(
    items: T[],
  ): Promise<(T & { sitePunches: Array<{
    id: number;
    kind: 'in' | 'out';
    at: Date;
    message: string | null;
    employeeID: number | null;
    senderName: string | null;
    employeeName: string | null;
  }> })[]> {
    const ids = items.map((item) => item.id);
    if (!ids.length) {
      return items.map((item) => ({ ...item, sitePunches: [] }));
    }
    const rows = await this.prisma.taskChat.findMany({
      where: {
        taskID: { in: ids },
        OR: [
          { message: { contains: 'Site Mark IN', mode: 'insensitive' } },
          { message: { contains: 'Site Mark OUT', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        taskID: true,
        message: true,
        createdAt: true,
        employeeID: true,
        senderName: true,
      },
    });
    const byTask = new Map<number, typeof rows>();
    for (const row of rows) {
      const list = byTask.get(row.taskID) || [];
      list.push(row);
      byTask.set(row.taskID, list);
    }
    return items.map((item) => ({
      ...item,
      sitePunches: (byTask.get(item.id) || [])
        .map((row) => {
          const kind = parseSitePunchKind(row.message);
          if (!kind) return null;
          return {
            id: row.id,
            kind,
            at: row.createdAt,
            message: row.message,
            employeeID: row.employeeID,
            senderName: row.senderName,
            employeeName: row.senderName,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p != null),
    }));
  }

  private formatTaskDetailsMessage(task: {
    taskCode: string;
    taskName: string;
    taskType: string;
    status: string;
    priority: string;
    description?: string | null;
    scheduleDateTime?: Date | null;
    dueDateTime?: Date | null;
    department?: { departmentName?: string | null } | null;
    customer?: { customerName?: string } | null;
    site?: { branchName?: string } | null;
    assignments?: {
      manageEmployee?: { employeeFirstName?: string | null; employeeLastName?: string | null } | null;
    }[];
  }): string {
    const assignees = (task.assignments || [])
      .map((a) => [a.manageEmployee?.employeeFirstName, a.manageEmployee?.employeeLastName].filter(Boolean).join(' '))
      .filter(Boolean)
      .join(', ');
    const lines = [
      '📋 Task created',
      '',
      `Code: ${task.taskCode}`,
      `Name: ${task.taskName}`,
      `Type: ${task.taskType}`,
      `Status: ${task.status}`,
      `Priority: ${task.priority}`,
    ];
    if (task.department?.departmentName) lines.push(`Department: ${task.department.departmentName}`);
    if (task.customer?.customerName) lines.push(`Customer: ${task.customer.customerName}`);
    if (task.site?.branchName) lines.push(`Site: ${task.site.branchName}`);
    if (assignees) lines.push(`Assignees: ${assignees}`);
    if (task.scheduleDateTime) {
      lines.push(`Schedule: ${task.scheduleDateTime.toLocaleString('en-IN')}`);
    }
    if (task.dueDateTime) lines.push(`Due: ${task.dueDateTime.toLocaleString('en-IN')}`);
    if (task.description?.trim()) lines.push('', `Description: ${task.description.trim()}`);
    return lines.join('\n');
  }

  private formatStatusChangeMessage(
    oldStatus: string,
    newStatus: string,
    actorName?: string | null,
    remark?: string | null,
  ): string {
    const lines = [
      `Status changed: ${oldStatus} → ${newStatus}`,
      `Updated by: ${actorName?.trim() || 'System'}`,
    ];
    if (remark?.trim()) lines.push(`Remark: ${remark.trim()}`);
    return lines.join('\n');
  }

  private async postSystemChat(
    taskID: number,
    message: string,
    viewer: TaskViewerContext,
    actorName?: string | null,
  ) {
    await this.prisma.taskChat.create({
      data: {
        taskID,
        message,
        userID: viewer.userId ?? null,
        employeeID: null,
        senderName: actorName?.trim() || 'System',
      },
    });
    await this.logActivity(taskID, 'CHAT', {
      userID: viewer.userId,
      employeeID: viewer.employeeId,
      actorName: actorName?.trim() || 'System',
      remark: message.slice(0, 500),
    });
  }

  private async replaceTaskNested(
    taskID: number,
    dto: Partial<CreateTaskProjectDto> & Partial<UpdateTaskProjectDto>,
  ) {
    if (dto.contacts) {
      await this.prisma.taskProjectContact.deleteMany({ where: { taskID } });
      const rows = dto.contacts.filter((c) => c.contactName?.trim() && c.contactNumber?.trim());
      if (rows.length) {
        await this.prisma.taskProjectContact.createMany({
          data: rows.map((c) => ({
            taskID,
            contactName: c.contactName.trim(),
            contactNumber: c.contactNumber.trim(),
            contactEmail: c.contactEmail?.trim() || null,
            designation: c.designation?.trim() || null,
          })),
        });
      }
    }
    if (dto.workscopeDetails) {
      await this.prisma.taskWorkscopeDetail.deleteMany({ where: { taskID } });
      if (dto.workscopeDetails.length) {
        await this.prisma.taskWorkscopeDetail.createMany({
          data: dto.workscopeDetails.map((row) => ({
            taskID,
            workscopeCategoryID: row.workscopeCategoryID ?? null,
            workscopeDetails: row.workscopeDetails ?? null,
            extraNote: row.extraNote ?? null,
          })),
        });
      }
    }
    if (dto.schedules) {
      await this.prisma.taskSchedule.deleteMany({ where: { taskID } });
      if (dto.schedules.length) {
        await this.prisma.taskSchedule.createMany({
          data: dto.schedules.map((row) => ({
            taskID,
            proposedDateTime: row.proposedDateTime ? new Date(row.proposedDateTime) : null,
            priority: row.priority ?? null,
          })),
        });
      }
    }
    if (dto.images) {
      await this.prisma.taskImage.deleteMany({ where: { taskID } });
      if (dto.images.length) {
        await this.prisma.taskImage.createMany({
          data: dto.images.map((row) => ({
            taskID,
            filename: row.filename,
            filepath: row.filepath ?? null,
            fileUrl: row.fileUrl ?? null,
            mimeType: row.mimeType ?? null,
            fileSize: row.fileSize ?? null,
            uploadedBy: row.uploadedBy ?? null,
            uploadedByName: row.uploadedByName ?? null,
          })),
        });
      }
    }
    if (dto.notes) {
      await this.prisma.taskNote.deleteMany({ where: { taskID } });
      if (dto.notes.length) {
        await this.prisma.taskNote.createMany({
          data: dto.notes.map((row) => ({
            taskID,
            filename: row.filename ?? null,
            title: row.title ?? null,
            description: row.description ?? null,
            filepath: row.filepath ?? null,
            fileUrl: row.fileUrl ?? null,
            mimeType: row.mimeType ?? null,
            fileSize: row.fileSize ?? null,
            note: row.note ?? null,
            uploadedBy: row.uploadedBy ?? null,
            uploadedByName: row.uploadedByName ?? null,
          })),
        });
      }
    }
    if (dto.inventories) {
      await this.prisma.taskInventory.deleteMany({ where: { taskID } });
      if (dto.inventories.length) {
        await this.prisma.taskInventory.createMany({
          data: dto.inventories.map((row) => ({
            taskID,
            productTypeId: row.productTypeId ?? null,
            makeModel: row.makeModel ?? null,
            snMac: row.snMac ?? null,
            description: row.description ?? null,
            purchaseDate: row.purchaseDate ? new Date(row.purchaseDate) : null,
            warrantyPeriod: row.warrantyPeriod ?? null,
            warrantyStatus: row.warrantyStatus ?? null,
            thirdPartyPurchase: !!row.thirdPartyPurchase,
          })),
        });
      }
    }
    if (dto.purchase) {
      await this.prisma.taskPurchase.deleteMany({ where: { taskID } });
      await this.prisma.taskPurchase.create({
        data: {
          taskID,
          purchaseType: dto.purchase.purchaseType ?? null,
          customerName: dto.purchase.customerName ?? null,
          address: dto.purchase.address ?? null,
          products: dto.purchase.products?.length
            ? {
                create: dto.purchase.products.map((p) => ({
                  make: p.make ?? null,
                  model: p.model ?? null,
                  description: p.description ?? null,
                  warranty: p.warranty ?? null,
                  rate: p.rate ?? null,
                  vendor: p.vendor ?? null,
                  validity: p.validity ?? null,
                  availability: p.availability ?? null,
                })),
              }
            : undefined,
          attachments: dto.purchase.attachments?.length
            ? {
                create: dto.purchase.attachments.map((a) => ({
                  filename: a.filename,
                  filepath: a.filepath ?? null,
                  fileUrl: a.fileUrl ?? null,
                  mimeType: a.mimeType ?? null,
                  fileSize: a.fileSize ?? null,
                })),
              }
            : undefined,
        },
      });
    }
    if (dto.engineerAssignments) {
      await this.prisma.taskEngineerAssignment.deleteMany({ where: { taskID } });
      if (dto.engineerAssignments.length) {
        await this.prisma.taskEngineerAssignment.createMany({
          data: dto.engineerAssignments.map((row) => ({
            taskID,
            manageEmployeeID: row.manageEmployeeID ?? null,
            engineerName: row.engineerName ?? null,
            engineerEmail: row.engineerEmail ?? null,
            engineerPhone: row.engineerPhone ?? null,
            proposedDateTime: row.proposedDateTime ? new Date(row.proposedDateTime) : null,
            priority: row.priority ?? null,
            status: row.status ?? null,
            notes: row.notes ?? null,
            assignedDate: row.assignedDate ? new Date(row.assignedDate) : null,
          })),
        });
      }
    }
  }

  private async logActivity(
    taskID: number,
    action: string,
    opts: {
      userID?: number;
      employeeID?: number;
      actorName?: string;
      oldValue?: string;
      newValue?: string;
      remark?: string;
    },
  ) {
    return this.prisma.taskActivityLog.create({
      data: { taskID, action, ...opts },
    });
  }

  private normalizeAssigneeIds(employeeIds: number[]): number[] {
    return [
      ...new Set(
        employeeIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];
  }

  private notifyTaskAssigned(
    taskID: number,
    manageEmployeeIDs: number[],
    taskLabel: string,
  ): void {
    for (const manageEmployeeID of manageEmployeeIDs) {
      this.pushService
        .sendToEmployeeAndManagers(
          manageEmployeeID,
          'Task Assigned',
          `You have been assigned: ${taskLabel}`,
          {
            url: '/empMyTasks',
            kind: 'task',
            tag: `task-assign-${taskID}-${manageEmployeeID}`,
          },
        )
        .catch(() => null);
      void this.mailService
        .sendNotificationEmail({
          employeeId: manageEmployeeID,
          eventType: 'TASK_ASSIGNED',
          subject: `Task assigned: ${taskLabel}`,
          bodyText: `You have been assigned to task "${taskLabel}". Open the mobile app or HR portal to view details.`,
          extraVars: { taskName: taskLabel },
        })
        .catch(() => false);
    }
    void this.postTaskCompanyBroadcast(taskID, manageEmployeeIDs, taskLabel).catch(
      () => null,
    );
  }

  private async postTaskCompanyBroadcast(
    taskID: number,
    manageEmployeeIDs: number[],
    taskLabel: string,
  ): Promise<void> {
    const task = await this.prisma.taskProject.findUnique({
      where: { id: taskID },
      select: { companyID: true, serviceProviderID: true },
    });
    if (!task?.companyID) return;

    const assignees = await this.prisma.manageEmployee.findMany({
      where: { id: { in: manageEmployeeIDs } },
      select: { employeeFirstName: true, employeeLastName: true, employeeID: true },
    });
    const names = assignees
      .map((e) => {
        const name = `${e.employeeFirstName ?? ''} ${e.employeeLastName ?? ''}`.trim();
        return name || e.employeeID || '';
      })
      .filter(Boolean)
      .join(', ');

    await this.employeeMemoService.createSystemCompanyBroadcast({
      companyID: task.companyID,
      serviceProviderID: task.serviceProviderID,
      description: names
        ? `Task assigned: ${taskLabel} → ${names}`
        : `Task assigned: ${taskLabel}`,
    });
  }

  /** Push to assignees (or targeted recipient) when someone posts in task chat. */
  private async notifyTaskChatMessage(
    taskID: number,
    viewer: TaskViewerContext,
    opts: {
      chatId: number;
      senderEmployeeId: number | null;
      senderUserId: number | null;
      recipientEmployeeID: number | null;
      senderName?: string | null;
      messagePreview: string;
    },
  ): Promise<void> {
    const task = await this.prisma.taskProject.findUnique({
      where: { id: taskID },
      select: {
        taskName: true,
        taskCode: true,
        createdByEmployeeID: true,
        assignments: { select: { manageEmployeeID: true } },
      },
    });
    if (!task) return;

    const assigneeIds = task.assignments.map((a) => Number(a.manageEmployeeID));
    const targets = new Set<number>();
    const senderIsAdmin = canManageTaskModule(viewer) || (!!opts.senderUserId && !opts.senderEmployeeId);

    if (opts.recipientEmployeeID) {
      targets.add(Number(opts.recipientEmployeeID));
    } else if (senderIsAdmin) {
      for (const id of assigneeIds) targets.add(id);
    } else if (opts.senderEmployeeId) {
      for (const id of assigneeIds) {
        if (id !== opts.senderEmployeeId) targets.add(id);
      }
      if (
        task.createdByEmployeeID &&
        task.createdByEmployeeID !== opts.senderEmployeeId
      ) {
        targets.add(task.createdByEmployeeID);
      }
    }

    if (opts.senderEmployeeId) {
      targets.delete(opts.senderEmployeeId);
    }

    if (targets.size === 0) return;

    const taskLabel = task.taskName || task.taskCode || 'Task';
    const from = (opts.senderName || '').trim() || (senderIsAdmin ? 'Manager' : 'Colleague');
    const preview = opts.messagePreview.trim() || 'New message';
    const body =
      preview.length > 100 ? `${from}: ${preview.slice(0, 97)}…` : `${from}: ${preview}`;

    for (const manageEmployeeID of targets) {
      this.pushService
        .sendToEmployeeAndManagers(
          manageEmployeeID,
          `Task message — ${taskLabel}`,
          body,
          {
            url: '/empMyTasks',
            tag: `task-chat-${taskID}-${manageEmployeeID}`,
            kind: 'task',
            event: 'chat',
            taskId: taskID,
            chatId: opts.chatId,
          },
        )
        .catch(() => null);
    }
  }

  /**
   * @param notify 'added' = only new assignees (task create/update).
   *             'all' = everyone in the saved list (assign modal — iOS users expect this).
   */
  private async syncAssignments(
    taskID: number,
    employeeIds: number[],
    options?: { notify?: 'added' | 'all' },
  ) {
    const normalizedIds = this.normalizeAssigneeIds(employeeIds);
    const existing = await this.prisma.taskAssignment.findMany({ where: { taskID } });
    const existingIds = new Set(existing.map((e) => Number(e.manageEmployeeID)));
    const nextIds = new Set(normalizedIds);
    const toAdd = normalizedIds.filter((id) => !existingIds.has(id));
    const toRemove = existing.filter((e) => !nextIds.has(Number(e.manageEmployeeID)));

    if (toRemove.length) {
      await this.prisma.taskAssignment.deleteMany({
        where: { id: { in: toRemove.map((r) => r.id) } },
      });
    }
    if (toAdd.length) {
      await this.prisma.taskAssignment.createMany({
        data: toAdd.map((manageEmployeeID) => ({ taskID, manageEmployeeID })),
        skipDuplicates: true,
      });
    }

    const notifyIds =
      options?.notify === 'all' ? normalizedIds : toAdd;
    if (notifyIds.length) {
      const task = await this.prisma.taskProject.findUnique({
        where: { id: taskID },
        select: { taskName: true, taskCode: true },
      });
      const label = task?.taskName || task?.taskCode || 'a new task';
      this.notifyTaskAssigned(taskID, notifyIds, label);
    }
  }

  /** Assign employees from the UI modal — notify every selected assignee (fixes iOS missed pushes). */
  async assignEmployees(
    id: number,
    employeeIds: number[],
    query: Record<string, string | undefined>,
  ) {
    const viewer = await this.resolveViewer(query);
    assertCanManage(viewer);
    await this.assertTaskAccess(id, viewer);
    await this.syncAssignments(id, employeeIds, { notify: 'all' });
    return this.findOne(id, query);
  }

  async findAll(query: Record<string, string | undefined>) {
    const viewer = await this.resolveViewer(query);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const search = (query.search || '').trim();
    const status = query.status?.trim();
    const priority = query.priority?.trim();
    const taskType = query.taskType?.trim();
    const where = await this.visibilityWhere(viewer, query.companyID ? Number(query.companyID) : undefined);
    if (status) {
      const normalized = normalizeTaskStatus(status);
      if (normalized !== status) {
        where.status = { in: [status, normalized] };
      } else if (status === 'Work in Progress') {
        where.status = { in: ['Work in Progress', 'WIP'] };
      } else if (status === 'Completed') {
        where.status = { in: ['Completed', 'Closed'] };
      } else {
        where.status = status;
      }
    }
    if (priority) where.priority = priority;
    if (taskType) where.taskType = taskType;
    const andParts: Record<string, unknown>[] = [];
    if (search) {
      andParts.push({
        OR: [
          { taskName: { contains: search, mode: 'insensitive' } },
          { taskCode: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    const assignedToMe =
      query.assignedToMe === '1' ||
      query.assignedToMe === 'true' ||
      query.scope === 'assigned';
    if (assignedToMe) {
      if (viewer.employeeId) {
        andParts.push({
          OR: [
            { assignments: { some: { manageEmployeeID: viewer.employeeId } } },
            { engineerAssignments: { some: { manageEmployeeID: viewer.employeeId } } },
          ],
        });
      } else {
        andParts.push({ id: -1 });
      }
    }
    if (andParts.length) where.AND = andParts;
    const [rawItems, total, grouped] = await Promise.all([
      this.prisma.taskProject.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: taskListInclude(viewer),
      }),
      this.prisma.taskProject.count({ where }),
      this.prisma.taskProject.groupBy({
        by: ['status'],
        where: (() => {
          const countWhere = { ...where };
          delete countWhere.status;
          return countWhere;
        })(),
        _count: { _all: true },
      }),
    ]);
    const items =
      !canManageTaskModule(viewer) && viewer.employeeId
        ? rawItems.map((item) => ({
            ...item,
            chats: filterChatsForEmployeeViewer(item.chats, viewer) as typeof item.chats,
          }))
        : rawItems;
    const withPunches = await this.attachSitePunches(items);
    const statusCounts: Record<string, number> = {};
    for (const row of grouped) {
      statusCounts[row.status] = row._count._all;
    }
    return { items: withPunches, total, page, limit, totalPages: Math.ceil(total / limit), statusCounts };
  }

  async findOne(id: number, query: Record<string, string | undefined>) {
    const viewer = await this.resolveViewer(query);
    await this.assertTaskAccess(id, viewer);
    const task = await this.prisma.taskProject.findFirst({
      where: { id, isDeleted: false },
      include: {
        ...taskListInclude(viewer),
        remarks: { orderBy: { createdAt: 'desc' }, take: 50 },
        chats: { orderBy: { createdAt: 'asc' }, take: 200 },
        activities: { orderBy: { createdAt: 'desc' }, take: 100 },
        ...TASK_NESTED_INCLUDE,
      },
    });
    if (!task) return null;
    if (!canManageTaskModule(viewer) && viewer.employeeId) {
      task.chats = filterChatsForEmployeeViewer(task.chats, viewer) as typeof task.chats;
    }
    const [withPunches] = await this.attachSitePunches([task]);
    return withPunches;
  }

  async create(dto: CreateTaskProjectDto, query: Record<string, string | undefined>) {
    const viewer = await this.resolveViewer(query);
    if (!canManageTaskModule(viewer) && !viewer.employeeId) {
      throw new ForbiddenException('Access denied');
    }
    if (!canManageTaskModule(viewer) && viewer.employeeId) {
      const emp = await this.prisma.manageEmployee.findUnique({
        where: { id: viewer.employeeId },
        select: { allowCreateTaskOnMobile: true },
      });
      if (!emp?.allowCreateTaskOnMobile) {
        throw new ForbiddenException('Task creation is not enabled for your account');
      }
    }
    const companyID = dto.companyID ?? viewer.companyID ?? null;
    let code = await nextTaskCode(this.prisma, companyID);
    for (let i = 0; i < 5; i++) {
      const exists = await this.prisma.taskProject.findUnique({ where: { taskCode: code } });
      if (!exists) break;
      code = await nextTaskCode(this.prisma, companyID);
    }
    const task = await this.prisma.taskProject.create({
      data: {
        taskCode: code,
        serviceProviderID: dto.serviceProviderID ?? viewer.serviceProviderID ?? null,
        companyID,
        departmentID: dto.departmentID ?? null,
        taskType: dto.taskType,
        customerID: dto.customerID ?? null,
        siteID: dto.siteID ?? null,
        taskName: dto.taskName,
        description: dto.description,
        scheduleDateTime: dto.scheduleDateTime ? new Date(dto.scheduleDateTime) : null,
        priority: dto.priority || 'Medium',
        dueDateTime: dto.dueDateTime ? new Date(dto.dueDateTime) : null,
        status: normalizeTaskStatus(dto.status) || 'Open',
        attachment: dto.attachment ?? null,
        createdByName: dto.createdByName ?? (query.actorName as string) ?? null,
        createdByUserID: dto.createdByUserID ?? viewer.userId ?? null,
        createdByEmployeeID: dto.createdByEmployeeID ?? viewer.employeeId ?? null,
      },
    });
    if (dto.assignedEmployeeIds?.length) {
      await this.syncAssignments(task.id, dto.assignedEmployeeIds, { notify: 'added' });
    }
    await this.replaceTaskNested(task.id, dto);
    await this.logActivity(task.id, 'CREATED', {
      userID: viewer.userId,
      employeeID: viewer.employeeId,
      actorName: query.actorName,
      newValue: task.status,
    });
    const createdFull = await this.findOne(task.id, query);
    if (createdFull) {
      await this.postSystemChat(
        task.id,
        this.formatTaskDetailsMessage(createdFull),
        viewer,
        (query.actorName as string) || undefined,
      );
    }
    this.enplSync.notifyHrmsChange('task', task.id);
    return createdFull;
  }

  async update(id: number, dto: UpdateTaskProjectDto, query: Record<string, string | undefined>) {
    const viewer = await this.resolveViewer(query);
    const existing = await this.assertTaskAccess(id, viewer);
    if (!canManageTaskModule(viewer) && existing.createdByEmployeeID !== viewer.employeeId) {
      throw new ForbiddenException('Only task creator or admin can edit task details');
    }
    await this.prisma.taskProject.update({
      where: { id },
      data: {
        departmentID: dto.departmentID,
        taskType: dto.taskType,
        customerID: dto.customerID,
        siteID: dto.siteID,
        taskName: dto.taskName,
        description: dto.description,
        scheduleDateTime: dto.scheduleDateTime ? new Date(dto.scheduleDateTime) : undefined,
        priority: dto.priority,
        dueDateTime: dto.dueDateTime ? new Date(dto.dueDateTime) : undefined,
        status: normalizeTaskStatus(dto.status),
        attachment: dto.attachment,
        createdByName: dto.createdByName,
      },
    });
    if (dto.assignedEmployeeIds) {
      if (!canManageTaskModule(viewer)) throw new ForbiddenException('Only admin can change assignments');
      await this.syncAssignments(id, dto.assignedEmployeeIds);
    }
    await this.replaceTaskNested(id, dto);
    this.enplSync.notifyHrmsChange('task', id);
    return this.findOne(id, query);
  }

  async remove(id: number, query: Record<string, string | undefined>) {
    const viewer = await this.resolveViewer(query);
    assertCanManage(viewer);
    await this.assertTaskAccess(id, viewer);
    const updated = await this.prisma.taskProject.update({ where: { id }, data: { isDeleted: true } });
    this.enplSync.notifyHrmsChange('task', id);
    return updated;
  }

  async changeStatus(id: number, dto: TaskStatusChangeDto, query: Record<string, string | undefined>) {
    const viewer = await this.resolveViewer(query);
    const task = await this.assertTaskAccess(id, viewer);
    if (!canManageTaskModule(viewer)) {
      if (!viewer.employeeId || task.createdByEmployeeID !== viewer.employeeId) {
        throw new ForbiddenException('Only task creator or admin can change task status');
      }
    }
    const updated = await this.prisma.taskProject.update({
      where: { id },
      data: { status: normalizeTaskStatus(dto.status) || dto.status },
    });
    const actorName = dto.actorName ?? (query.actorName as string) ?? undefined;
    await this.logActivity(id, 'STATUS_CHANGE', {
      userID: dto.userID ?? viewer.userId,
      employeeID: dto.employeeID ?? viewer.employeeId,
      actorName,
      oldValue: task.status,
      newValue: dto.status,
      remark: dto.remark,
    });
    await this.postSystemChat(
      id,
      this.formatStatusChangeMessage(task.status, dto.status, actorName, dto.remark),
      viewer,
      actorName,
    );
    if (dto.remark?.trim()) {
      await this.addRemark(id, { remark: dto.remark, userID: dto.userID, employeeID: dto.employeeID, authorName: dto.actorName }, query);
    }
    this.enplSync.notifyHrmsChange('task', id);
    return updated;
  }

  async changePriority(id: number, dto: TaskPriorityChangeDto, query: Record<string, string | undefined>) {
    const viewer = await this.resolveViewer(query);
    if (!canManageTaskModule(viewer)) {
      throw new ForbiddenException('Only administrators can change task priority');
    }
    const task = await this.assertTaskAccess(id, viewer);
    const updated = await this.prisma.taskProject.update({
      where: { id },
      data: { priority: dto.priority },
    });
    await this.logActivity(id, 'PRIORITY_CHANGE', {
      userID: dto.userID ?? viewer.userId,
      employeeID: dto.employeeID ?? viewer.employeeId,
      actorName: dto.actorName,
      oldValue: task.priority,
      newValue: dto.priority,
      remark: dto.remark,
    });
    if (dto.remark?.trim()) {
      await this.addRemark(id, { remark: dto.remark, userID: dto.userID, employeeID: dto.employeeID, authorName: dto.actorName }, query);
    }
    this.enplSync.notifyHrmsChange('task', id);
    return updated;
  }

  async addRemark(id: number, dto: CreateTaskRemarkDto, query: Record<string, string | undefined>) {
    const viewer = await this.resolveViewer(query);
    await this.assertTaskAccess(id, viewer);
    const remark = await this.prisma.taskRemark.create({
      data: {
        taskID: id,
        remark: dto.remark,
        userID: dto.userID ?? viewer.userId ?? null,
        employeeID: dto.employeeID ?? viewer.employeeId ?? null,
        authorName: dto.authorName,
        createdBy: dto.createdBy ?? dto.authorName,
        status: dto.status,
      },
    });
    await this.logActivity(id, 'REMARK', {
      userID: remark.userID ?? undefined,
      employeeID: remark.employeeID ?? undefined,
      actorName: dto.authorName,
      remark: dto.remark,
    });
    if (dto.status) {
      await this.prisma.taskProject.update({
        where: { id },
        data: { status: normalizeTaskStatus(dto.status) || dto.status },
      });
    }
    this.enplSync.notifyHrmsChange('task', id);
    return remark;
  }

  async getRemarks(id: number, query: Record<string, string | undefined>) {
    const viewer = await this.resolveViewer(query);
    await this.assertTaskAccess(id, viewer);
    return this.prisma.taskRemark.findMany({ where: { taskID: id }, orderBy: { createdAt: 'desc' } });
  }

  async addChat(id: number, dto: CreateTaskChatDto, query: Record<string, string | undefined>) {
    const viewer = await this.resolveViewer(query);
    await this.assertTaskAccess(id, viewer);
    const text = (dto.message || '').trim();
    const attachmentUrl = (dto.attachmentUrl || '').trim() || null;
    if (!text && !attachmentUrl) {
      throw new BadRequestException('Message or attachment is required');
    }
    const incomingPunch = parseSitePunchKind(text);
    if (incomingPunch) {
      const previousPunches = await this.prisma.taskChat.findMany({
        where: {
          taskID: id,
          OR: [
            { message: { contains: 'Site Mark IN', mode: 'insensitive' } },
            { message: { contains: 'Site Mark OUT', mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        select: { message: true, createdAt: true },
      });
      const lastKind = lastSitePunchKindFromMessages(previousPunches);
      if (incomingPunch === 'out' && lastKind !== 'in') {
        throw new BadRequestException('Site check out is only allowed after a site check in');
      }
      if (incomingPunch === 'in' && lastKind === 'in') {
        throw new BadRequestException('Already checked in. Site check out first.');
      }
    }
    if (dto.status && !canManageTaskModule(viewer)) {
      throw new ForbiddenException('Only administrators can change task status');
    }
    if (dto.priority && !canManageTaskModule(viewer)) {
      throw new ForbiddenException('Only administrators can change task priority');
    }
    let recipientEmployeeID = dto.recipientEmployeeID ?? null;
    const employeeID = canManageTaskModule(viewer)
      ? dto.employeeID ?? null
      : viewer.employeeId ?? dto.employeeID ?? null;
    const userID = canManageTaskModule(viewer) ? dto.userID ?? viewer.userId ?? null : null;

    if (userID && !recipientEmployeeID) {
      const lastEmployeeChat = await this.prisma.taskChat.findFirst({
        where: { taskID: id, employeeID: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { employeeID: true },
      });
      if (lastEmployeeChat?.employeeID) {
        recipientEmployeeID = lastEmployeeChat.employeeID;
      } else {
        const assignees = await this.prisma.taskAssignment.findMany({
          where: { taskID: id },
          select: { manageEmployeeID: true },
        });
        if (assignees.length === 1) {
          recipientEmployeeID = assignees[0].manageEmployeeID;
        }
        // Multiple assignees: leave null so all assignees see the message
      }
    }

    const chat = await this.prisma.taskChat.create({
      data: {
        taskID: id,
        message: text || (attachmentUrl ? '📷 Photo' : ''),
        attachmentUrl,
        userID,
        employeeID,
        recipientEmployeeID,
        senderName: dto.senderName,
      },
    });
    const activityRemark = text || (attachmentUrl ? 'Image attachment' : '');
    await this.logActivity(id, 'CHAT', {
      userID: chat.userID ?? undefined,
      employeeID: chat.employeeID ?? undefined,
      actorName: dto.senderName,
      remark: activityRemark,
    });
    if (dto.status) {
      await this.changeStatus(id, { status: dto.status, remark: dto.remark, actorName: dto.senderName, userID: dto.userID, employeeID: dto.employeeID }, query);
    }
    if (dto.priority) {
      await this.changePriority(id, { priority: dto.priority, remark: dto.remark, actorName: dto.senderName, userID: dto.userID, employeeID: dto.employeeID }, query);
    } else if (dto.remark?.trim() && !dto.status) {
      await this.addRemark(id, { remark: dto.remark, authorName: dto.senderName, userID: dto.userID, employeeID: dto.employeeID }, query);
    }

    await this.notifyTaskChatMessage(id, viewer, {
      chatId: chat.id,
      senderEmployeeId: employeeID,
      senderUserId: userID,
      recipientEmployeeID,
      senderName: dto.senderName,
      messagePreview: activityRemark,
    });

    return chat;
  }

  async getChats(id: number, query: Record<string, string | undefined>) {
    const viewer = await this.resolveViewer(query);
    await this.assertTaskAccess(id, viewer);
    const chats = await this.prisma.taskChat.findMany({
      where: { taskID: id },
      orderBy: { createdAt: 'asc' },
    });
    return filterChatsForEmployeeViewer(chats, viewer);
  }

  async getActivities(id: number, query: Record<string, string | undefined>) {
    const viewer = await this.resolveViewer(query);
    await this.assertTaskAccess(id, viewer);
    return this.prisma.taskActivityLog.findMany({ where: { taskID: id }, orderBy: { createdAt: 'desc' } });
  }

  async getTaskReport(id: number, query: Record<string, string | undefined>) {
    const viewer = await this.resolveViewer(query);
    await this.assertTaskAccess(id, viewer);
    const task = await this.prisma.taskProject.findFirst({
      where: { id, isDeleted: false },
      include: {
        department: { select: { id: true, departmentName: true } },
        customer: { select: { id: true, customerCode: true, customerName: true } },
        site: {
          select: {
            id: true,
            branchName: true,
            city: true,
            address: true,
            state: true,
            pincode: true,
          },
        },
        createdByEmployee: {
          select: {
            id: true,
            employeeID: true,
            employeeFirstName: true,
            employeeLastName: true,
            personalPhoneNo: true,
            businessEmail: true,
          },
        },
        assignments: {
          include: {
            manageEmployee: {
              select: {
                id: true,
                employeeID: true,
                employeeFirstName: true,
                employeeLastName: true,
                personalPhoneNo: true,
                businessEmail: true,
                departments: { select: { departmentName: true } },
                designations: { select: { designation: true } },
              },
            },
          },
        },
        remarks: { orderBy: { createdAt: 'asc' } },
        chats: { orderBy: { createdAt: 'asc' } },
        activities: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');

    let chats = task.chats;
    if (!canManageTaskModule(viewer) && viewer.employeeId) {
      chats = filterChatsForEmployeeViewer(chats, viewer) as typeof task.chats;
    }

    const isSitePunch = (text?: string | null) =>
      /\b(mark(?:ed)?\s*(in|out)|check(?:ed)?\s*(in|out)|site\s*(?:mark\s*)?(?:in|out))\b/i.test(
        (text || '').trim(),
      );

    const siteCheckEvents = chats
      .filter((c) => isSitePunch(c.message))
      .map((c) => {
        const emp = task.assignments.find((a) => a.manageEmployeeID === c.employeeID)
          ?.manageEmployee;
        const name =
          c.senderName ||
          (emp
            ? `${emp.employeeFirstName || ''} ${emp.employeeLastName || ''}`.trim()
            : 'Unknown');
        return {
          id: c.id,
          at: c.createdAt,
          message: c.message,
          employeeId: c.employeeID,
          employeeName: name,
          employeeCode: emp?.employeeID || null,
        };
      });

    const assigneeSummaries = task.assignments.map((a) => {
      const e = a.manageEmployee;
      const empName = e
        ? `${e.employeeFirstName || ''} ${e.employeeLastName || ''}`.trim()
        : '—';
      const empTaskMessages = chats.filter(
        (c) =>
          c.employeeID === a.manageEmployeeID && !isSitePunch(c.message),
      );
      const empSiteEvents = siteCheckEvents.filter(
        (ev) => ev.employeeId === a.manageEmployeeID,
      );
      const siteIn = empSiteEvents.filter((ev) =>
        /mark\s*in|check\s*in/i.test(ev.message || ''),
      ).length;
      const siteOut = empSiteEvents.filter((ev) =>
        /mark\s*out|check\s*out/i.test(ev.message || ''),
      ).length;
      return {
        employeeId: a.manageEmployeeID,
        employeeCode: e?.employeeID || null,
        name: empName,
        department: e?.departments?.departmentName || null,
        designation: e?.designations?.designation || null,
        phone: e?.personalPhoneNo || null,
        email: e?.businessEmail || null,
        assignedAt: a.assignedAt,
        messageCount: empTaskMessages.length,
        siteCheckInOutCount: empSiteEvents.length,
        siteCheckInCount: siteIn,
        siteCheckOutCount: siteOut,
        siteEvents: empSiteEvents,
      };
    });

    const taskMessages = chats.filter((c) => !isSitePunch(c.message));
    const userRemarks = task.remarks.filter((r) => !isSitePunch(r.remark));
    const keyActivities = task.activities.filter((act) => {
      if (act.action === 'CHAT' || act.action === 'REMARK') {
        return !isSitePunch(act.remark);
      }
      return true;
    });

    return {
      generatedAt: new Date().toISOString(),
      task: {
        id: task.id,
        taskCode: task.taskCode,
        taskName: task.taskName,
        taskType: task.taskType,
        status: task.status,
        priority: task.priority,
        description: task.description,
        scheduleDateTime: task.scheduleDateTime,
        dueDateTime: task.dueDateTime,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        department: task.department,
        customer: task.customer,
        site: task.site,
        createdBy: task.createdByEmployee,
      },
      assignees: assigneeSummaries,
      siteCheckSummary: {
        totalEvents: siteCheckEvents.length,
        events: siteCheckEvents,
      },
      remarks: userRemarks,
      messages: taskMessages.map((c) => ({
        id: c.id,
        at: c.createdAt,
        message: c.message,
        attachmentUrl: c.attachmentUrl,
        senderName: c.senderName,
        employeeID: c.employeeID,
        userID: c.userID,
        recipientEmployeeID: c.recipientEmployeeID,
      })),
      activities: keyActivities,
      stats: {
        assigneeCount: task.assignments.length,
        remarkCount: userRemarks.length,
        messageCount: taskMessages.length,
        activityCount: keyActivities.length,
        siteCheckEventCount: siteCheckEvents.length,
      },
    };
  }

  async getEmployeesByDepartment(departmentID: number, query: Record<string, string | undefined>) {
    const viewer = await this.resolveViewer(query);
    const companyID =
      (query.companyID ? Number(query.companyID) : undefined) || viewer.companyID || undefined;
    if (!companyID || !(departmentID > 0)) return [];

    const taskDept = await this.prisma.departments.findUnique({
      where: { id: departmentID },
      select: { departmentName: true, companyID: true },
    });
    const deptName = (taskDept?.departmentName || '').trim();
    if (!deptName) return [];

    const linkedIds = companyID
      ? await getMutuallyLinkedCompanyIds(this.prisma, companyID)
      : [];
    const companyIds = companyID ? [companyID, ...linkedIds] : linkedIds;
    if (!companyIds.length && viewer.role !== 'SUPERADMIN') return [];

    const matchingDepts = await this.prisma.departments.findMany({
      where: {
        ...(companyIds.length ? { companyID: { in: companyIds } } : {}),
        departmentName: { equals: deptName, mode: 'insensitive' },
      },
      select: { id: true },
    });
    const deptIds = [...new Set([departmentID, ...matchingDepts.map((d) => d.id)])];

    const rows = await this.prisma.manageEmployee.findMany({
      where: {
        lifecycleStatus: 'ACTIVE',
        isDeleted: false,
        ...(companyIds.length ? { companyID: { in: companyIds } } : {}),
        OR: [
          { departmentNameID: { in: deptIds } },
          { empDepartment: { some: { departmentNameID: { in: deptIds } } } },
        ],
      },
      select: {
        id: true,
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        companyID: true,
        company: { select: { companyName: true } },
        departments: { select: { departmentName: true } },
      },
      orderBy: { employeeFirstName: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      employeeID: row.employeeID,
      employeeFirstName: row.employeeFirstName,
      employeeLastName: row.employeeLastName,
      companyID: row.companyID,
      companyName: row.company?.companyName ?? null,
      departments: row.departments,
    }));
  }
}

function assertCanManage(viewer: TaskViewerContext) {
  if (!canManageTaskModule(viewer)) throw new ForbiddenException('Admin access required');
}
