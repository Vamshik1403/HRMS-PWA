import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskCustomerSiteDto } from './dto/create-task-customer-site.dto';
import { UpdateTaskCustomerSiteDto } from './dto/update-task-customer-site.dto';
import { assertCanManageTaskModule, parseViewer, TaskViewerContext } from './task-context';

@Injectable()
export class TaskCustomerSitesService {
  constructor(private prisma: PrismaService) {}

  private async assertCustomerAccess(customerID: number, viewer: TaskViewerContext) {
    const customer = await this.prisma.taskCustomer.findFirst({
      where: { id: customerID, isDeleted: false },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (viewer.role !== 'SUPERADMIN' && viewer.companyID && customer.companyID !== viewer.companyID) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async findAll(query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    assertCanManageTaskModule(viewer);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const search = (query.search || '').trim();
    const customerID = query.customerID ? Number(query.customerID) : undefined;
    const where: any = { isDeleted: false };
    if (customerID) where.customerID = customerID;
    if (query.companyID || (viewer.companyID && viewer.role !== 'SUPERADMIN')) {
      where.customer = {
        companyID: query.companyID ? Number(query.companyID) : viewer.companyID,
        isDeleted: false,
      };
    }
    if (search) {
      where.OR = [
        { branchName: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.taskCustomerSite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { customer: { select: { id: true, customerCode: true, customerName: true } } },
      }),
      this.prisma.taskCustomerSite.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByCustomer(customerID: number, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    await this.assertCustomerAccess(customerID, viewer);
    return this.prisma.taskCustomerSite.findMany({
      where: { customerID, isDeleted: false },
      orderBy: { branchName: 'asc' },
    });
  }

  async findOne(id: number, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    assertCanManageTaskModule(viewer);
    const row = await this.prisma.taskCustomerSite.findFirst({
      where: { id, isDeleted: false },
      include: { customer: true },
    });
    if (!row) throw new NotFoundException('Site not found');
    if (viewer.role !== 'SUPERADMIN' && viewer.companyID && row.customer?.companyID !== viewer.companyID) {
      throw new NotFoundException('Site not found');
    }
    return row;
  }

  async create(dto: CreateTaskCustomerSiteDto, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    assertCanManageTaskModule(viewer);
    await this.assertCustomerAccess(dto.customerID, viewer);
    return this.prisma.taskCustomerSite.create({
      data: {
        customerID: dto.customerID,
        branchName: dto.branchName,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        country: dto.country,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
      include: { customer: { select: { id: true, customerCode: true, customerName: true } } },
    });
  }

  async update(id: number, dto: UpdateTaskCustomerSiteDto, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    assertCanManageTaskModule(viewer);
    const existing = await this.findOne(id, query);
    if (dto.customerID && dto.customerID !== existing.customerID) {
      await this.assertCustomerAccess(dto.customerID, viewer);
    }
    return this.prisma.taskCustomerSite.update({
      where: { id },
      data: {
        customerID: dto.customerID,
        branchName: dto.branchName,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        country: dto.country,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
      include: { customer: { select: { id: true, customerCode: true, customerName: true } } },
    });
  }

  async remove(id: number, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    assertCanManageTaskModule(viewer);
    await this.findOne(id, query);
    return this.prisma.taskCustomerSite.update({ where: { id }, data: { isDeleted: true } });
  }

  async dropdown(query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    assertCanManageTaskModule(viewer);
    const q = (query.q || query.search || '').trim();
    const customerID = query.customerID ? Number(query.customerID) : undefined;
    const where: any = { isDeleted: false };
    if (customerID) where.customerID = customerID;
    if (viewer.companyID && viewer.role !== 'SUPERADMIN') {
      where.customer = { companyID: viewer.companyID, isDeleted: false };
    }
    if (q) {
      where.OR = [
        { branchName: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.taskCustomerSite.findMany({
      where,
      orderBy: { branchName: 'asc' },
      take: Math.min(50, Math.max(1, Number(query.limit) || 20)),
      select: {
        id: true,
        branchName: true,
        city: true,
        customerID: true,
        customer: { select: { id: true, customerCode: true, customerName: true } },
      },
    });
  }
}
