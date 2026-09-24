import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnplSyncService } from '../enpl-sync/enpl-sync.service';
import { CreateTaskCustomerSiteDto } from './dto/create-task-customer-site.dto';
import { UpdateTaskCustomerSiteDto } from './dto/update-task-customer-site.dto';
import { assertCanManageTaskModule, parseViewer, TaskViewerContext } from './task-context';
import { composeAddressQuery } from '../common/reverse-geocode';
import { GoogleMapsService } from '../google-maps/google-maps.service';

@Injectable()
export class TaskCustomerSitesService {
  constructor(
    private prisma: PrismaService,
    private enplSync: EnplSyncService,
    private googleMaps: GoogleMapsService,
  ) {}

  private async resolveSitePin(opts: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    country?: string | null;
    latitude?: unknown;
    longitude?: unknown;
    placeId?: string | null;
    locationSource?: string | null;
    refetchLocation?: boolean;
    existing?: {
      address?: string | null;
      city?: string | null;
      state?: string | null;
      pincode?: string | null;
      country?: string | null;
      latitude?: string | null;
      longitude?: string | null;
      placeId?: string | null;
      locationSource?: string | null;
      locationVerified?: boolean | null;
    } | null;
  }): Promise<{
    latitude?: string;
    longitude?: string;
    placeId?: string | null;
    locationSource?: string;
    locationVerified?: boolean;
  }> {
    const addressQuery = composeAddressQuery(
      opts.address,
      opts.city,
      opts.state,
      opts.pincode,
      opts.country,
    );
    const existingQuery = opts.existing
      ? composeAddressQuery(
          opts.existing.address,
          opts.existing.city,
          opts.existing.state,
          opts.existing.pincode,
          opts.existing.country,
        )
      : '';
    const pin = await this.googleMaps.resolvePin({
      feature: 'site',
      addressQuery,
      incomingLat: opts.latitude,
      incomingLng: opts.longitude,
      incomingPlaceId: opts.placeId,
      incomingSource: opts.locationSource,
      refetch: opts.refetchLocation === true,
      existing: opts.existing ? { ...opts.existing, address: existingQuery } : null,
      missingMessage:
        'Could not find coordinates for this site address. Please check the address.',
    });
    if (!pin) return {};
    return {
      latitude: pin.latitude,
      longitude: pin.longitude,
      placeId: pin.placeId,
      locationSource: pin.locationSource,
      locationVerified: pin.locationVerified,
    };
  }

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
        { siteCode: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.taskCustomerSite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { customer: { select: { id: true, customerCode: true, customerName: true } }, contacts: true, notes: true },
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
      include: { customer: true, contacts: true, notes: true },
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
    const customer = await this.assertCustomerAccess(dto.customerID, viewer);
    const coords = await this.resolveSitePin({
      address: dto.address,
      city: dto.city,
      state: dto.state,
      pincode: dto.pincode,
      country: dto.country,
      latitude: dto.latitude,
      longitude: dto.longitude,
      placeId: dto.placeId,
      locationSource: dto.locationSource,
      refetchLocation: dto.refetchLocation,
    });
    const created = await this.prisma.taskCustomerSite.create({
      data: {
        customerID: dto.customerID,
        companyID: dto.companyID ?? customer.companyID ?? null,
        siteCode: dto.siteCode?.trim() || null,
        branchName: dto.branchName,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        country: dto.country,
        gstNo: dto.gstNo,
        latitude: coords.latitude,
        longitude: coords.longitude,
        placeId: coords.placeId,
        locationSource: coords.locationSource,
        locationVerified: coords.locationVerified,
        contacts: dto.contacts?.length
          ? {
              create: dto.contacts
                .filter((c) => c.contactPerson?.trim() && c.contactNumber?.trim())
                .map((c) => ({
                  contactPerson: c.contactPerson.trim(),
                  contactNumber: c.contactNumber.trim(),
                  designation: c.designation?.trim() || null,
                  email: c.email?.trim() || null,
                })),
            }
          : undefined,
        notes: dto.notes?.length
          ? {
              create: dto.notes
                .filter((n) => n.title?.trim())
                .map((n) => ({
                  title: n.title.trim(),
                  description: n.description?.trim() || null,
                  createdBy: n.createdBy?.trim() || null,
                })),
            }
          : undefined,
      },
      include: { customer: { select: { id: true, customerCode: true, customerName: true } }, contacts: true, notes: true },
    });
    this.enplSync.notifyHrmsChange('site', created.id);
    return created;
  }

  async update(id: number, dto: UpdateTaskCustomerSiteDto, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    assertCanManageTaskModule(viewer);
    const existing = await this.findOne(id, query);
    if (dto.customerID && dto.customerID !== existing.customerID) {
      await this.assertCustomerAccess(dto.customerID, viewer);
    }
    const coords = await this.resolveSitePin({
      address: dto.address !== undefined ? dto.address : existing.address,
      city: dto.city !== undefined ? dto.city : existing.city,
      state: dto.state !== undefined ? dto.state : existing.state,
      pincode: dto.pincode !== undefined ? dto.pincode : existing.pincode,
      country: dto.country !== undefined ? dto.country : existing.country,
      latitude: dto.latitude,
      longitude: dto.longitude,
      placeId: dto.placeId,
      locationSource: dto.locationSource,
      refetchLocation: dto.refetchLocation,
      existing,
    });
    const updated = await this.prisma.taskCustomerSite.update({
      where: { id },
      data: {
        customerID: dto.customerID,
        companyID: dto.companyID ?? existing.companyID ?? existing.customer?.companyID ?? undefined,
        siteCode: dto.siteCode,
        branchName: dto.branchName,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        country: dto.country,
        gstNo: dto.gstNo,
        ...(coords ?? {}),
      },
    });
    if (dto.contacts) {
      await this.prisma.taskCustomerSiteContact.deleteMany({ where: { siteID: id } });
      const rows = dto.contacts.filter((c) => c.contactPerson?.trim() && c.contactNumber?.trim());
      if (rows.length) {
        await this.prisma.taskCustomerSiteContact.createMany({
          data: rows.map((c) => ({
            siteID: id,
            contactPerson: c.contactPerson.trim(),
            contactNumber: c.contactNumber.trim(),
            designation: c.designation?.trim() || null,
            email: c.email?.trim() || null,
          })),
        });
      }
    }
    if (dto.notes) {
      await this.prisma.taskCustomerSiteNote.deleteMany({ where: { siteID: id } });
      const notes = dto.notes.filter((n) => n.title?.trim());
      if (notes.length) {
        await this.prisma.taskCustomerSiteNote.createMany({
          data: notes.map((n) => ({
            siteID: id,
            title: n.title.trim(),
            description: n.description?.trim() || null,
            createdBy: n.createdBy?.trim() || null,
          })),
        });
      }
    }
    const row = await this.findOne(id, query);
    this.enplSync.notifyHrmsChange('site', id);
    return row ?? updated;
  }

  async remove(id: number, query: Record<string, string | undefined>) {
    const viewer = parseViewer(query);
    assertCanManageTaskModule(viewer);
    await this.findOne(id, query);
    const updated = await this.prisma.taskCustomerSite.update({ where: { id }, data: { isDeleted: true } });
    this.enplSync.notifyHrmsChange('site', id);
    return updated;
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
        { siteCode: { contains: q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.taskCustomerSite.findMany({
      where,
      orderBy: { branchName: 'asc' },
      take: Math.min(50, Math.max(1, Number(query.limit) || 20)),
      select: {
        id: true,
        branchName: true,
        siteCode: true,
        gstNo: true,
        city: true,
        address: true,
        customerID: true,
        customer: { select: { id: true, customerCode: true, customerName: true } },
      },
    });
  }
}
