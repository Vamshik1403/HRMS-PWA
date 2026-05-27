import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskCustomerDto } from './dto/create-task-customer.dto';
import { UpdateTaskCustomerDto } from './dto/update-task-customer.dto';
import { assertCanManageTaskModule, parseViewer, TaskViewerContext } from './task-context';
import { nextCustomerCode } from './task-code.util';

@Injectable()
export class TaskCustomersService {
  constructor(private prisma: PrismaService) {}

  private baseWhere(viewer: TaskViewerContext, companyID?: number) {
    const where: any = { isDeleted: false };
    if (companyID) where.companyID = companyID;
    else if (viewer.companyID && viewer.role !== 'SUPERADMIN') where.companyID = viewer.companyID;
    return where;
  }

  async findAll(query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    assertCanManageTaskModule(viewer);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const search = (query.search || '').trim();
    const where = this.baseWhere(viewer, query.companyID ? Number(query.companyID) : undefined);
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerCode: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.taskCustomer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { sites: true, tasks: true } } },
      }),
      this.prisma.taskCustomer.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: number, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    assertCanManageTaskModule(viewer);
    const row = await this.prisma.taskCustomer.findFirst({
      where: { id, isDeleted: false },
      include: { sites: { where: { isDeleted: false } }, _count: { select: { tasks: true } } },
    });
    if (!row) throw new NotFoundException('Customer not found');
    return row;
  }

  async create(dto: CreateTaskCustomerDto, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    assertCanManageTaskModule(viewer);
    const companyID = dto.companyID ?? viewer.companyID ?? null;
    let code = await nextCustomerCode(this.prisma, companyID);
    for (let i = 0; i < 5; i++) {
      const exists = await this.prisma.taskCustomer.findUnique({ where: { customerCode: code } });
      if (!exists) break;
      code = await nextCustomerCode(this.prisma, companyID);
    }
    return this.prisma.taskCustomer.create({
      data: {
        customerCode: code,
        customerName: dto.customerName,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        country: dto.country,
        serviceProviderID: dto.serviceProviderID ?? viewer.serviceProviderID ?? null,
        companyID,
        createdByUserID: dto.createdByUserID ?? viewer.userId ?? null,
      },
    });
  }

  async update(id: number, dto: UpdateTaskCustomerDto, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    assertCanManageTaskModule(viewer);
    await this.findOne(id, query);
    return this.prisma.taskCustomer.update({
      where: { id },
      data: {
        customerName: dto.customerName,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        country: dto.country,
      },
    });
  }

  async remove(id: number, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    assertCanManageTaskModule(viewer);
    await this.findOne(id, query);
    return this.prisma.taskCustomer.update({ where: { id }, data: { isDeleted: true } });
  }

  async dropdown(query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    const where = this.baseWhere(viewer, query.companyID ? Number(query.companyID) : undefined);
    const q = (query.q || query.search || '').trim();
    if (q) {
      where.OR = [
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerCode: { contains: q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.taskCustomer.findMany({
      where,
      orderBy: { customerName: 'asc' },
      take: Math.min(50, Math.max(1, Number(query.limit) || 20)),
      select: {
        id: true,
        customerCode: true,
        customerName: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        country: true,
      },
    });
  }
}
