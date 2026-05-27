import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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

const TASK_INCLUDE = {
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
  chats: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { createdAt: true } },
  _count: { select: { remarks: true, chats: true, activities: true } },
};

@Injectable()
export class TaskProjectsService {
  constructor(private prisma: PrismaService) {}

  private visibilityWhere(viewer: TaskViewerContext, companyID?: number) {
    const base: any = { isDeleted: false };
    if (companyID) base.companyID = companyID;
    else if (viewer.companyID && viewer.role !== 'SUPERADMIN') base.companyID = viewer.companyID;

    if (canManageTaskModule(viewer)) return base;

    const or: any[] = [];
    if (viewer.employeeId) {
      or.push({ createdByEmployeeID: viewer.employeeId });
      or.push({ assignments: { some: { manageEmployeeID: viewer.employeeId } } });
    }
    if (viewer.userId) {
      or.push({ createdByUserID: viewer.userId });
    }
    if (!or.length) throw new ForbiddenException('Access denied');
    return { ...base, OR: or };
  }

  private async assertTaskAccess(taskId: number, viewer: TaskViewerContext) {
    const task = await this.prisma.taskProject.findFirst({
      where: { id: taskId, isDeleted: false },
      include: { assignments: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    if (canManageTaskModule(viewer)) {
      if (viewer.role === 'COMPANY_ADMIN' && viewer.companyID && task.companyID !== viewer.companyID) {
        throw new NotFoundException('Task not found');
      }
      return task;
    }

    const isCreator =
      (viewer.employeeId && task.createdByEmployeeID === viewer.employeeId) ||
      (viewer.userId && task.createdByUserID === viewer.userId);
    const isAssigned = viewer.employeeId
      ? task.assignments.some((a) => a.manageEmployeeID === viewer.employeeId)
      : false;
    if (!isCreator && !isAssigned) throw new ForbiddenException('Access denied');
    return task;
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

  private async syncAssignments(taskID: number, employeeIds: number[]) {
    const existing = await this.prisma.taskAssignment.findMany({ where: { taskID } });
    const existingIds = new Set(existing.map((e) => e.manageEmployeeID));
    const nextIds = new Set(employeeIds);
    const toAdd = employeeIds.filter((id) => !existingIds.has(id));
    const toRemove = existing.filter((e) => !nextIds.has(e.manageEmployeeID));
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
  }

  async findAll(query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const search = (query.search || '').trim();
    const status = query.status?.trim();
    const priority = query.priority?.trim();
    const taskType = query.taskType?.trim();
    const where = this.visibilityWhere(viewer, query.companyID ? Number(query.companyID) : undefined);
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (taskType) where.taskType = taskType;
    if (search) {
      where.AND = [
        {
          OR: [
            { taskName: { contains: search, mode: 'insensitive' } },
            { taskCode: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.taskProject.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: TASK_INCLUDE,
      }),
      this.prisma.taskProject.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: number, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    await this.assertTaskAccess(id, viewer);
    return this.prisma.taskProject.findFirst({
      where: { id, isDeleted: false },
      include: {
        ...TASK_INCLUDE,
        remarks: { orderBy: { createdAt: 'desc' }, take: 50 },
        chats: { orderBy: { createdAt: 'asc' }, take: 100 },
        activities: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
  }

  async create(dto: CreateTaskProjectDto, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    if (!canManageTaskModule(viewer) && !viewer.employeeId) {
      throw new ForbiddenException('Access denied');
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
        status: dto.status || 'Open',
        createdByUserID: dto.createdByUserID ?? viewer.userId ?? null,
        createdByEmployeeID: dto.createdByEmployeeID ?? viewer.employeeId ?? null,
      },
    });
    if (dto.assignedEmployeeIds?.length) {
      await this.syncAssignments(task.id, dto.assignedEmployeeIds);
    }
    await this.logActivity(task.id, 'CREATED', {
      userID: viewer.userId,
      employeeID: viewer.employeeId,
      actorName: query.actorName,
      newValue: task.status,
    });
    return this.findOne(task.id, query);
  }

  async update(id: number, dto: UpdateTaskProjectDto, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
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
        status: dto.status,
      },
    });
    if (dto.assignedEmployeeIds) {
      if (!canManageTaskModule(viewer)) throw new ForbiddenException('Only admin can change assignments');
      await this.syncAssignments(id, dto.assignedEmployeeIds);
    }
    return this.findOne(id, query);
  }

  async remove(id: number, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    assertCanManage(viewer);
    await this.assertTaskAccess(id, viewer);
    return this.prisma.taskProject.update({ where: { id }, data: { isDeleted: true } });
  }

  async changeStatus(id: number, dto: TaskStatusChangeDto, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    if (!canManageTaskModule(viewer)) {
      throw new ForbiddenException('Only administrators can change task status');
    }
    const task = await this.assertTaskAccess(id, viewer);
    const updated = await this.prisma.taskProject.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.logActivity(id, 'STATUS_CHANGE', {
      userID: dto.userID ?? viewer.userId,
      employeeID: dto.employeeID ?? viewer.employeeId,
      actorName: dto.actorName,
      oldValue: task.status,
      newValue: dto.status,
      remark: dto.remark,
    });
    if (dto.remark?.trim()) {
      await this.addRemark(id, { remark: dto.remark, userID: dto.userID, employeeID: dto.employeeID, authorName: dto.actorName }, query);
    }
    return updated;
  }

  async changePriority(id: number, dto: TaskPriorityChangeDto, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
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
    return updated;
  }

  async addRemark(id: number, dto: CreateTaskRemarkDto, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    await this.assertTaskAccess(id, viewer);
    const remark = await this.prisma.taskRemark.create({
      data: {
        taskID: id,
        remark: dto.remark,
        userID: dto.userID ?? viewer.userId ?? null,
        employeeID: dto.employeeID ?? viewer.employeeId ?? null,
        authorName: dto.authorName,
      },
    });
    await this.logActivity(id, 'REMARK', {
      userID: remark.userID ?? undefined,
      employeeID: remark.employeeID ?? undefined,
      actorName: dto.authorName,
      remark: dto.remark,
    });
    return remark;
  }

  async getRemarks(id: number, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    await this.assertTaskAccess(id, viewer);
    return this.prisma.taskRemark.findMany({ where: { taskID: id }, orderBy: { createdAt: 'desc' } });
  }

  async addChat(id: number, dto: CreateTaskChatDto, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    await this.assertTaskAccess(id, viewer);
    const text = (dto.message || '').trim();
    const attachmentUrl = (dto.attachmentUrl || '').trim() || null;
    if (!text && !attachmentUrl) {
      throw new BadRequestException('Message or attachment is required');
    }
    if (dto.status && !canManageTaskModule(viewer)) {
      throw new ForbiddenException('Only administrators can change task status');
    }
    if (dto.priority && !canManageTaskModule(viewer)) {
      throw new ForbiddenException('Only administrators can change task priority');
    }
    const chat = await this.prisma.taskChat.create({
      data: {
        taskID: id,
        message: text || (attachmentUrl ? '📷 Photo' : ''),
        attachmentUrl,
        userID: dto.userID ?? viewer.userId ?? null,
        employeeID: dto.employeeID ?? viewer.employeeId ?? null,
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
    return chat;
  }

  async getChats(id: number, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    await this.assertTaskAccess(id, viewer);
    return this.prisma.taskChat.findMany({ where: { taskID: id }, orderBy: { createdAt: 'asc' } });
  }

  async getActivities(id: number, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    await this.assertTaskAccess(id, viewer);
    return this.prisma.taskActivityLog.findMany({ where: { taskID: id }, orderBy: { createdAt: 'desc' } });
  }

  async getEmployeesByDepartment(departmentID: number, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    const where: any = { departmentNameID: departmentID, lifecycleStatus: 'ACTIVE' };
    if (viewer.companyID && viewer.role !== 'SUPERADMIN') where.companyID = viewer.companyID;
    return this.prisma.manageEmployee.findMany({
      where,
      select: {
        id: true,
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        departments: { select: { departmentName: true } },
      },
      orderBy: { employeeFirstName: 'asc' },
    });
  }
}

function assertCanManage(viewer: TaskViewerContext) {
  if (!canManageTaskModule(viewer)) throw new ForbiddenException('Admin access required');
}
