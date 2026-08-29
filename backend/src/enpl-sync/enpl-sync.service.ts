import { AsyncLocalStorage } from 'async_hooks';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ENPL_COMPANY_NAMES, ENPL_ENTITY, ENPL_ERP_BASE_DEFAULT, EnplEntityType } from './enpl-sync.constants';
import {
  asDate,
  asInt,
  blank,
  inboundDeletedFlag,
  isInactiveSyncStatus,
  liveTaskStatus,
  mapEnplContacts,
  normalizeEnplPriority,
  normalizeEnplTaskStatus,
  toEnplContacts,
} from './enpl-sync.util';

type SyncStore = { skipOutbound: boolean };

@Injectable()
export class EnplSyncService {
  private readonly logger = new Logger(EnplSyncService.name);
  private readonly als = new AsyncLocalStorage<SyncStore>();
  private companyCache: { id: number; companyName: string | null; serviceProviderID: number | null } | null = null;

  constructor(private prisma: PrismaService) {}

  runInbound<T>(source: string | undefined, fn: () => Promise<T>): Promise<T> {
    const skip = !source || String(source).toLowerCase() === 'enpl';
    return this.als.run({ skipOutbound: skip }, fn);
  }

  notifyHrmsChange(kind: EnplEntityType, hrmsId: number) {
    if (this.als.getStore()?.skipOutbound) return;
    setImmediate(() => {
      this.pushToEnpl(kind, hrmsId).catch((err) =>
        this.logger.warn(`ENPL outbound ${kind} ${hrmsId}: ${(err as Error).message}`),
      );
    });
  }

  async health() {
    const company = await this.resolveCompany();
    return {
      ok: true,
      companyId: company.id,
      companyName: company.companyName,
      companySlug: 'electrohelps-networks-pvt-ltd',
      inbound: {
        customers: '/api/integrations/enpl/customers',
        sites: '/api/integrations/enpl/sites',
        tasks: '/api/integrations/enpl/tasks',
      },
    };
  }

  async bulkImportFromEnpl() {
    const payload = await this.fetchEnplExport();
    const customers = payload.customers || [];
    const sites = payload.sites || [];
    const tasks = payload.tasks || [];
    let customerOk = 0;
    let siteOk = 0;
    let taskOk = 0;
    const errors: Array<{ type: string; id?: unknown; message: string }> = [];
    for (const row of customers) {
      try {
        await this.upsertCustomerFromEnpl(row);
        customerOk += 1;
      } catch (err) {
        errors.push({ type: 'customer', id: row?.id, message: (err as Error).message });
      }
    }
    for (const row of sites) {
      try {
        await this.upsertSiteFromEnpl(row);
        siteOk += 1;
      } catch (err) {
        errors.push({ type: 'site', id: row?.id, message: (err as Error).message });
      }
    }
    for (const row of tasks) {
      try {
        await this.upsertTaskFromEnpl(row);
        taskOk += 1;
      } catch (err) {
        errors.push({ type: 'task', id: row?.id, message: (err as Error).message });
      }
    }
    const company = await this.resolveCompany();
    await this.backfillMappingsFromErpColumns();
    return {
      companyId: company.id,
      imported: { customers: customerOk, sites: siteOk, tasks: taskOk },
      errors: errors.slice(0, 50),
      errorCount: errors.length,
    };
  }

  async upsertCustomerFromEnpl(body: any): Promise<{ hrmsId: number }> {
    const company = await this.resolveCompany();
    const { hrmsId, enplId, enplCode } = this.parseCustomerIds(body);
    const name = blank(body.customerName);
    const address = blank(body.regdAddress) || blank(body.address);

    let existing = await this.findMappedRow('customer', enplId, enplCode, hrmsId);
    if (!existing && enplId != null) {
      existing = await this.prisma.taskCustomer.findFirst({
        where: { erpAddressBookId: enplId },
        orderBy: { isDeleted: 'asc' },
      });
    }
    if (!existing && enplCode) {
      existing = await this.prisma.taskCustomer.findFirst({
        where: { customerCode: enplCode },
        orderBy: { isDeleted: 'asc' },
      });
    }
    if (!existing && name) {
      existing = await this.prisma.taskCustomer.findFirst({
        where: { companyID: company.id, customerName: { equals: name, mode: 'insensitive' } },
        orderBy: { isDeleted: 'asc' },
      });
    }
    this.assertCompanyOwned('Customer', existing);

    if (this.wantSoftDelete(body)) {
      if (!existing) return { hrmsId: 0 };
      await this.prisma.taskCustomer.update({ where: { id: existing.id }, data: { isDeleted: true } });
      await this.saveMapping(company.id, 'customer', existing.id, enplId ?? (existing as any).erpAddressBookId, enplCode || (existing as any).customerCode);
      return { hrmsId: existing.id };
    }

    if (!name) throw new BadRequestException('customerName is required');

    const customerCode = await this.uniqueCode({
      wanted: enplCode || (existing as any)?.customerCode,
      existingId: existing?.id,
      enplId,
      findByCode: (code) => this.prisma.taskCustomer.findFirst({ where: { customerCode: code } }),
      fallbackPrefix: 'CUST',
    });

    const data = {
      serviceProviderID: company.serviceProviderID,
      companyID: company.id,
      customerCode,
      customerName: name,
      addressType: blank(body.addressType) || 'Customer',
      address,
      city: blank(body.city),
      state: blank(body.state),
      pincode: blank(body.pinCode || body.pincode),
      country: blank(body.country) || 'India',
      gstNo: blank(body.gstNo),
      erpAddressBookId: enplId ?? (existing as any)?.erpAddressBookId ?? null,
      relationshipManagerName: blank(body.user?.fullName || body.relationshipManagerName),
      relationshipManagerEmail: blank(body.user?.email || body.relationshipManagerEmail),
      isDeleted: this.nextIsDeleted(body, existing),
    };

    const saved = existing
      ? await this.prisma.taskCustomer.update({ where: { id: existing.id }, data })
      : await this.prisma.taskCustomer.create({ data });

    const contacts = mapEnplContacts(body.contacts);
    await this.prisma.taskCustomerContact.deleteMany({ where: { customerID: saved.id } });
    if (contacts.length) {
      await this.prisma.taskCustomerContact.createMany({
        data: contacts.map((c) => ({
          customerID: saved.id,
          contactPerson: c.contactPerson,
          contactNumber: c.contactNumber,
          designation: c.designation,
          email: c.email,
        })),
      });
    }
    await this.saveMapping(company.id, 'customer', saved.id, data.erpAddressBookId, customerCode);
    return { hrmsId: saved.id };
  }

  async upsertSiteFromEnpl(body: any): Promise<{ hrmsId: number }> {
    const company = await this.resolveCompany();
    const { hrmsId, enplId, enplCode } = this.parseSiteIds(body);
    const siteName = blank(body.siteName || body.branchName);
    const siteAddress = blank(body.siteAddress || body.address);

    const customer = await this.resolveCustomerForSite(company.id, body);

    let existing = await this.findMappedRow('site', enplId, enplCode, hrmsId);
    if (!existing && enplId != null) {
      existing = await this.prisma.taskCustomerSite.findFirst({
        where: { erpSiteId: enplId },
        orderBy: { isDeleted: 'asc' },
      });
    }
    if (!existing && enplCode) {
      existing = await this.prisma.taskCustomerSite.findFirst({
        where: { siteCode: enplCode },
        orderBy: { isDeleted: 'asc' },
      });
    }
    if (!existing && customer && siteName) {
      existing = await this.prisma.taskCustomerSite.findFirst({
        where: {
          customerID: customer.id,
          branchName: { equals: siteName, mode: 'insensitive' },
        },
        orderBy: { isDeleted: 'asc' },
      });
    }
    this.assertCompanyOwned('Site', existing, (existing as any)?.companyID);

    if (this.wantSoftDelete(body)) {
      if (!existing) return { hrmsId: 0 };
      await this.prisma.taskCustomerSite.update({ where: { id: existing.id }, data: { isDeleted: true } });
      await this.saveMapping(company.id, 'site', existing.id, enplId ?? (existing as any).erpSiteId, enplCode || (existing as any).siteCode);
      return { hrmsId: existing.id };
    }

    if (!siteName) throw new BadRequestException('siteName is required');
    if (!customer) throw new BadRequestException('addressBookId is required and must match a customer in this company');

    const siteCode = await this.uniqueCode({
      wanted: enplCode || (existing as any)?.siteCode,
      existingId: existing?.id,
      enplId,
      findByCode: (code) => this.prisma.taskCustomerSite.findFirst({ where: { siteCode: code } }),
      fallbackPrefix: 'SITE',
    });

    const data = {
      companyID: company.id,
      customerID: customer.id,
      siteCode,
      erpSiteId: enplId ?? (existing as any)?.erpSiteId ?? null,
      branchName: siteName,
      address: siteAddress,
      city: blank(body.city),
      state: blank(body.state),
      pincode: blank(body.pinCode || body.pincode),
      country: blank(body.country) || 'India',
      gstNo: blank(body.gstNo),
      isDeleted: this.nextIsDeleted(body, existing),
    };

    const saved = existing
      ? await this.prisma.taskCustomerSite.update({ where: { id: existing.id }, data })
      : await this.prisma.taskCustomerSite.create({ data });

    const contacts = mapEnplContacts(body.contacts);
    await this.prisma.taskCustomerSiteContact.deleteMany({ where: { siteID: saved.id } });
    if (contacts.length) {
      await this.prisma.taskCustomerSiteContact.createMany({
        data: contacts.map((c) => ({
          siteID: saved.id,
          contactPerson: c.contactPerson,
          contactNumber: c.contactNumber,
          designation: c.designation,
          email: c.email,
        })),
      });
    }
    await this.saveMapping(company.id, 'site', saved.id, data.erpSiteId, siteCode);
    return { hrmsId: saved.id };
  }

  async upsertTaskFromEnpl(body: any): Promise<{ hrmsId: number }> {
    const company = await this.resolveCompany();
    const { hrmsId, enplId, enplCode } = this.parseTaskIds(body);
    const title = blank(body.title || body.taskName);

    const customer = await this.resolveCustomerForTask(company.id, body);
    const site = await this.resolveSiteForTask(company.id, customer?.id, body);
    const departmentID = await this.resolveDepartmentId(company.id, body);

    let existing = await this.findMappedRow('task', enplId, enplCode, hrmsId);
    if (!existing && enplId != null) {
      existing = await this.prisma.taskProject.findFirst({
        where: { erpTaskId: enplId },
        orderBy: { isDeleted: 'asc' },
      });
    }
    if (!existing && enplCode) {
      existing = await this.prisma.taskProject.findFirst({
        where: { taskCode: enplCode },
        orderBy: { isDeleted: 'asc' },
      });
    }
    this.assertCompanyOwned('Task', existing);

    const status = liveTaskStatus(body);
    if (this.wantSoftDelete(body, status)) {
      if (!existing) return { hrmsId: 0 };
      await this.prisma.taskProject.update({
        where: { id: existing.id },
        data: { isDeleted: true, status: isInactiveSyncStatus(status) ? status : 'Cancelled' },
      });
      await this.saveMapping(
        company.id,
        'task',
        existing.id,
        enplId ?? (existing as any).erpTaskId,
        enplCode || (existing as any).taskCode,
      );
      return { hrmsId: existing.id };
    }

    if (!title && !enplCode) throw new BadRequestException('title is required');

    const taskCode = await this.uniqueCode({
      wanted: enplCode || (existing as any)?.taskCode,
      existingId: existing?.id,
      enplId,
      findByCode: (code) => this.prisma.taskProject.findFirst({ where: { taskCode: code } }),
      fallbackPrefix: 'TASK',
    });

    const firstSchedule = Array.isArray(body.schedule) ? body.schedule[0] : body.schedule;
    const data = {
      serviceProviderID: company.serviceProviderID,
      companyID: company.id,
      taskCode,
      erpTaskId: enplId ?? (existing as any)?.erpTaskId ?? null,
      departmentID,
      taskType: blank(body.taskType) || 'SERVICE',
      customerID: customer?.id ?? null,
      siteID: site?.id ?? null,
      taskName: title || taskCode,
      description: blank(body.description),
      attachment: blank(body.attachment),
      scheduleDateTime: asDate(firstSchedule?.proposedDateTime || body.scheduleDateTime),
      priority: normalizeEnplPriority(firstSchedule?.priority || body.priority),
      status: status,
      createdByName: blank(body.createdBy || body.createdByName),
      isDeleted: this.nextIsDeleted(body, existing),
    };

    const saved = existing
      ? await this.prisma.taskProject.update({ where: { id: existing.id }, data })
      : await this.prisma.taskProject.create({ data });

    if (body.contacts) {
      const contacts = mapEnplContacts(body.contacts);
      await this.prisma.taskProjectContact.deleteMany({ where: { taskID: saved.id } });
      if (contacts.length) {
        await this.prisma.taskProjectContact.createMany({
          data: contacts.map((c) => ({
            taskID: saved.id,
            contactName: c.contactPerson,
            contactNumber: c.contactNumber,
            contactEmail: c.email,
            designation: c.designation,
          })),
        });
      }
    }

    if (Array.isArray(body.remarks)) {
      await this.prisma.taskRemark.deleteMany({ where: { taskID: saved.id } });
      const remarks = body.remarks.filter((r: any) => blank(r.remark) || blank(r.status));
      if (remarks.length) {
        await this.prisma.taskRemark.createMany({
          data: remarks.map((row: any) => ({
            taskID: saved.id,
            remark: blank(row.remark) || '(empty)',
            status: blank(row.status) ? normalizeEnplTaskStatus(row.status) : null,
            createdBy: blank(row.createdBy),
            authorName: blank(row.createdBy || row.authorName),
            createdAt: asDate(row.createdAt) || undefined,
          })),
        });
      }
    }

    if (Array.isArray(body.schedule) || body.schedules) {
      const schedules = Array.isArray(body.schedule) ? body.schedule : body.schedules || [];
      await this.prisma.taskSchedule.deleteMany({ where: { taskID: saved.id } });
      if (schedules.length) {
        await this.prisma.taskSchedule.createMany({
          data: schedules.map((row: any) => ({
            taskID: saved.id,
            proposedDateTime: asDate(row.proposedDateTime),
            priority: blank(row.priority) ? normalizeEnplPriority(row.priority) : null,
          })),
        });
      }
    }

    await this.saveMapping(company.id, 'task', saved.id, data.erpTaskId, taskCode);
    return { hrmsId: saved.id };
  }

  private async pushToEnpl(kind: EnplEntityType, hrmsId: number) {
    const company = await this.resolveCompany();
    const token = process.env.HRMS_SYNC_TOKEN || '';
    if (!token) {
      this.logger.warn('HRMS_SYNC_TOKEN not set; skip outbound');
      return;
    }

    let payload: any;
    if (kind === 'customer') {
      const row = await this.prisma.taskCustomer.findFirst({
        where: { id: hrmsId },
        include: { contacts: true, branches: true },
      });
      if (!row || row.companyID !== company.id) return;
      payload = {
        id: row.id,
        hrmsId: row.id,
        customerName: row.customerName,
        customerCode: row.customerCode,
        erpAddressBookId: row.erpAddressBookId ?? null,
        address: row.address,
        pincode: row.pincode,
        city: row.city,
        state: row.state,
        country: row.country,
        gstNo: row.gstNo,
        isDeleted: row.isDeleted,
        addressBookID: row.customerCode,
        regdAddress: row.address,
        pinCode: row.pincode,
        branchName: row.branches?.branchName || null,
        contacts: toEnplContacts(row.contacts),
      };
    } else if (kind === 'site') {
      const row = await this.prisma.taskCustomerSite.findFirst({
        where: { id: hrmsId },
        include: { contacts: true, customer: true },
      });
      if (!row || row.companyID !== company.id) return;
      payload = {
        id: row.id,
        hrmsId: row.id,
        branchName: row.branchName,
        siteCode: row.siteCode,
        erpSiteId: row.erpSiteId ?? null,
        customerID: row.customerID,
        address: row.address,
        pincode: row.pincode,
        city: row.city,
        state: row.state,
        country: row.country,
        gstNo: row.gstNo,
        isDeleted: row.isDeleted,
        siteName: row.branchName,
        siteAddress: row.address,
        pinCode: row.pincode,
        addressBookID: row.customer?.customerCode,
        contacts: toEnplContacts(row.contacts),
      };
    } else {
      const row = await this.prisma.taskProject.findFirst({
        where: { id: hrmsId },
        include: {
          contacts: true,
          remarks: { orderBy: { createdAt: 'desc' }, take: 20 },
          schedules: true,
          department: true,
          customer: true,
          site: true,
        },
      });
      if (!row || row.companyID !== company.id) return;
      payload = {
        id: row.id,
        taskName: row.taskName,
        taskCode: row.taskCode,
        erpTaskId: row.erpTaskId ?? null,
        customerID: row.customerID,
        siteID: row.siteID,
        description: row.description,
        status: row.isDeleted ? 'Cancelled' : row.status,
        isDeleted: row.isDeleted,
        priority: row.priority,
        taskType: row.taskType,
        createdBy: row.createdByName,
        departmentName: row.department?.departmentName || null,
        customer: row.customer
          ? {
              id: row.customer.id,
              customerName: row.customer.customerName,
              address: row.customer.address,
              pincode: row.customer.pincode,
              city: row.customer.city,
              state: row.customer.state,
            }
          : null,
        site: row.site
          ? {
              id: row.site.id,
              branchName: row.site.branchName,
              address: row.site.address,
              pincode: row.site.pincode,
              city: row.site.city,
              state: row.site.state,
            }
          : null,
        contacts: toEnplContacts(
          row.contacts.map((c) => ({
            contactPerson: c.contactName,
            contactName: c.contactName,
            contactNumber: c.contactNumber,
            designation: c.designation,
            email: c.contactEmail,
            contactEmail: c.contactEmail,
          })),
        ),
        remarks: row.remarks.map((r) => ({
          remark: r.remark,
          status: r.status,
          createdBy: r.createdBy || r.authorName,
          createdAt: r.createdAt,
        })),
        schedules: row.schedules.map((s) => ({
          proposedDateTime: s.proposedDateTime,
          priority: s.priority,
        })),
      };
    }

    const base = (process.env.ENPL_ERP_BASE_URL || ENPL_ERP_BASE_DEFAULT).replace(/\/$/, '');
    const path = kind === 'customer' ? 'customers' : kind === 'site' ? 'sites' : 'tasks';
    const res = await fetch(`${base}/hrms-sync/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hrms-sync-token': token,
        'x-sync-source': 'hrms',
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`ENPL ${path} ${res.status}: ${text.slice(0, 400)}`);
      return;
    }
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!json) return;
    const maybeEnplId = asInt(json.enplId ?? json.erpTaskId ?? json.erpAddressBookId ?? json.erpSiteId);
    const maybeId = asInt(json.id);
    const returnedId = maybeEnplId ?? (maybeId != null && maybeId !== hrmsId ? maybeId : null);
    const returnedCode = blank(
      json.customerCode || json.siteCode || json.taskCode || json.addressBookID || json.siteID || json.taskID || json.enplCode,
    );
    if (returnedId != null || returnedCode) {
      const erpField =
        kind === 'customer' ? 'erpAddressBookId' : kind === 'site' ? 'erpSiteId' : 'erpTaskId';
      if (kind === 'customer' && returnedId != null) {
        await this.prisma.taskCustomer.update({ where: { id: hrmsId }, data: { erpAddressBookId: returnedId } });
      } else if (kind === 'site' && returnedId != null) {
        await this.prisma.taskCustomerSite.update({ where: { id: hrmsId }, data: { erpSiteId: returnedId } });
      } else if (kind === 'task' && returnedId != null) {
        await this.prisma.taskProject.update({ where: { id: hrmsId }, data: { erpTaskId: returnedId } });
      }
      await this.saveMapping(company.id, kind, hrmsId, returnedId, returnedCode);
      void erpField;
    }
  }

  private async resolveCompany() {
    if (this.companyCache) return this.companyCache;
    const envId = Number(process.env.ENPL_HRMS_COMPANY_ID || '2');
    let company = await this.prisma.company.findUnique({
      where: { id: envId },
      select: { id: true, companyName: true, serviceProviderID: true },
    });
    const nameOk = company && ENPL_COMPANY_NAMES.has((company.companyName || '').trim().toLowerCase());
    if (!nameOk) {
      const all = await this.prisma.company.findMany({
        select: { id: true, companyName: true, serviceProviderID: true },
      });
      const matched = all.filter((row) => ENPL_COMPANY_NAMES.has((row.companyName || '').trim().toLowerCase()));
      if (matched.length !== 1) {
        throw new BadRequestException(
          `Expected one company named Electrohelps Networks Pvt Ltd, found ${matched.length}`,
        );
      }
      company = matched[0];
    }
    this.companyCache = company!;
    return this.companyCache;
  }

  private async findMappedRow(entityType: EnplEntityType, enplId: number | null, enplCode: string | null, hrmsId: number | null) {
    const company = await this.resolveCompany();
    if (hrmsId != null) {
      const mapped = await this.prisma.enplEntityMapping.findFirst({
        where: { entityType, hrmsId, companyID: company.id },
      });
      if (mapped) return this.loadEntity(entityType, mapped.hrmsId);
    }
    if (enplId != null) {
      const mapped = await this.prisma.enplEntityMapping.findFirst({
        where: { companyID: company.id, entityType, enplId },
      });
      if (mapped) return this.loadEntity(entityType, mapped.hrmsId);
    }
    if (enplCode) {
      const mapped = await this.prisma.enplEntityMapping.findFirst({
        where: { companyID: company.id, entityType, enplCode },
      });
      if (mapped) return this.loadEntity(entityType, mapped.hrmsId);
    }
    return null;
  }

  private loadEntity(entityType: EnplEntityType, hrmsId: number) {
    if (entityType === 'customer') {
      return this.prisma.taskCustomer.findFirst({ where: { id: hrmsId } });
    }
    if (entityType === 'site') {
      return this.prisma.taskCustomerSite.findFirst({ where: { id: hrmsId } });
    }
    return this.prisma.taskProject.findFirst({ where: { id: hrmsId } });
  }

  private wantSoftDelete(body: any, status?: string | null) {
    if (inboundDeletedFlag(body) === true) return true;
    return isInactiveSyncStatus(status);
  }

  private nextIsDeleted(body: any, existing: { isDeleted?: boolean } | null) {
    const flag = inboundDeletedFlag(body);
    if (flag === true) return true;
    if (flag === false) return false;
    return existing?.isDeleted ?? false;
  }

  private parseCustomerIds(body: any) {
    const native = body.erpAddressBookId !== undefined || (body.customerCode != null && body.addressBookID == null);
    if (native) {
      return {
        hrmsId: asInt(body.hrmsId ?? body.id),
        enplId: asInt(body.erpAddressBookId),
        enplCode: blank(body.customerCode || body.addressBookID),
      };
    }
    return {
      hrmsId: asInt(body.hrmsId),
      enplId: asInt(body.id),
      enplCode: blank(body.addressBookID || body.customerCode),
    };
  }

  private parseSiteIds(body: any) {
    const native =
      body.erpSiteId !== undefined ||
      (body.siteCode != null && typeof body.siteID === 'number') ||
      (body.branchName != null && body.siteName == null && body.siteID == null);
    if (native) {
      return {
        hrmsId: asInt(body.hrmsId ?? body.id),
        enplId: asInt(body.erpSiteId),
        enplCode: blank(body.siteCode),
      };
    }
    return {
      hrmsId: asInt(body.hrmsId),
      enplId: asInt(body.id),
      enplCode: blank(typeof body.siteID === 'string' ? body.siteID : body.siteCode),
    };
  }

  private parseTaskIds(body: any) {
    const native = body.taskName != null || body.taskCode != null || body.erpTaskId !== undefined;
    if (native) {
      return {
        hrmsId: asInt(body.hrmsId ?? body.id),
        enplId: asInt(body.erpTaskId),
        enplCode: blank(body.taskCode || body.taskID),
      };
    }
    return {
      hrmsId: asInt(body.hrmsId),
      enplId: asInt(body.id),
      enplCode: blank(body.taskID),
    };
  }

  private async saveMapping(
    companyID: number,
    entityType: EnplEntityType,
    hrmsId: number,
    enplId: number | null,
    enplCode: string | null,
  ) {
    await this.prisma.enplEntityMapping.upsert({
      where: { entityType_hrmsId: { entityType, hrmsId } },
      create: { companyID, entityType, hrmsId, enplId, enplCode },
      update: { enplId, enplCode },
    });
  }

  private assertCompanyOwned(label: string, row: { companyID?: number | null } | null, companyID?: number | null) {
    if (!row) return;
    const cid = companyID ?? row.companyID;
    const expected = Number(process.env.ENPL_HRMS_COMPANY_ID || this.companyCache?.id || 2);
    if (cid && cid !== expected) {
      throw new BadRequestException(`${label} already belongs to another company`);
    }
  }

  private async uniqueCode(opts: {
    wanted: string | null;
    existingId?: number;
    enplId: number | null;
    findByCode: (code: string) => Promise<{ id: number } | null>;
    fallbackPrefix: string;
  }) {
    const base = opts.wanted || `${opts.fallbackPrefix}-${opts.enplId || Date.now()}`;
    const clash = await opts.findByCode(base);
    if (!clash || clash.id === opts.existingId) return base;
    const suffixed = `${base}-${opts.enplId || Date.now()}`;
    const clash2 = await opts.findByCode(suffixed);
    if (!clash2 || clash2.id === opts.existingId) return suffixed;
    return `${opts.fallbackPrefix}-${opts.existingId || opts.enplId || Date.now()}`;
  }

  private async resolveCustomerForSite(companyID: number, body: any) {
    const hrmsCustomerId = asInt(body.customerID ?? body.customer?.id);
    if (hrmsCustomerId != null) {
      const byHrms = await this.prisma.taskCustomer.findFirst({
        where: { id: hrmsCustomerId, companyID },
        orderBy: { isDeleted: 'asc' },
      });
      if (byHrms) return byHrms;
    }
    const enplCustomerId = asInt(body.addressBookId ?? body.addressBookID ?? body.erpAddressBookId);
    const code =
      typeof body.addressBookID === 'string'
        ? blank(body.addressBookID)
        : blank(body.addressBookCode || body.customerCode);
    const name = blank(body.customerName || body.addressBook?.customerName || body.customer?.customerName);
    return this.lookupCustomer(companyID, enplCustomerId, code, name);
  }

  private async resolveCustomerForTask(companyID: number, body: any) {
    const hrmsCustomerId = asInt(body.customerID ?? body.customer?.id);
    if (hrmsCustomerId != null) {
      const byHrms = await this.prisma.taskCustomer.findFirst({
        where: { id: hrmsCustomerId, companyID },
        orderBy: { isDeleted: 'asc' },
      });
      if (byHrms) return byHrms;
    }
    const enplCustomerId = asInt(body.addressBookId ?? body.erpAddressBookId);
    const code = blank(body.addressBookID || body.addressBook?.addressBookID || body.customer?.customerCode);
    const name = blank(body.addressBook?.customerName || body.customerName || body.customer?.customerName);
    return this.lookupCustomer(companyID, enplCustomerId, code, name);
  }

  private async lookupCustomer(companyID: number, enplId: number | null, code: string | null, name: string | null) {
    if (enplId != null) {
      const mapped = await this.prisma.enplEntityMapping.findFirst({
        where: { companyID, entityType: ENPL_ENTITY.customer, enplId },
      });
      if (mapped) {
        return this.prisma.taskCustomer.findFirst({ where: { id: mapped.hrmsId, isDeleted: false } });
      }
      const byErp = await this.prisma.taskCustomer.findFirst({
        where: { erpAddressBookId: enplId, companyID, isDeleted: false },
      });
      if (byErp) return byErp;
    }
    if (code) {
      const mapped = await this.prisma.enplEntityMapping.findFirst({
        where: { companyID, entityType: ENPL_ENTITY.customer, enplCode: code },
      });
      if (mapped) {
        return this.prisma.taskCustomer.findFirst({ where: { id: mapped.hrmsId, isDeleted: false } });
      }
      const byCode = await this.prisma.taskCustomer.findFirst({
        where: { customerCode: code, companyID, isDeleted: false },
      });
      if (byCode) return byCode;
    }
    if (name) {
      return this.prisma.taskCustomer.findFirst({
        where: { companyID, customerName: { equals: name, mode: 'insensitive' }, isDeleted: false },
      });
    }
    return null;
  }

  private async resolveSiteForTask(companyID: number, customerID: number | undefined, body: any) {
    const nativeSiteId =
      typeof body.siteID === 'number' || (body.siteID != null && body.erpSiteId !== undefined)
        ? asInt(body.siteID)
        : asInt(body.site?.id);
    if (nativeSiteId != null) {
      const byHrms = await this.prisma.taskCustomerSite.findFirst({
        where: { id: nativeSiteId, companyID },
        orderBy: { isDeleted: 'asc' },
      });
      if (byHrms) return byHrms;
    }
    const enplSiteId = asInt(body.siteId ?? body.erpSiteId);
    const siteCode = blank(
      typeof body.siteID === 'string' ? body.siteID : body.siteCode || body.site?.siteCode || body.site?.siteID,
    );
    const siteName = blank(body.site?.siteName || body.site?.branchName || body.siteName || body.branchName);
    if (enplSiteId != null) {
      const mapped = await this.prisma.enplEntityMapping.findFirst({
        where: { companyID, entityType: ENPL_ENTITY.site, enplId: enplSiteId },
      });
      if (mapped) {
        return this.prisma.taskCustomerSite.findFirst({ where: { id: mapped.hrmsId, isDeleted: false } });
      }
      const byErp = await this.prisma.taskCustomerSite.findFirst({
        where: { erpSiteId: enplSiteId, companyID, isDeleted: false },
      });
      if (byErp) return byErp;
    }
    if (siteCode) {
      const mapped = await this.prisma.enplEntityMapping.findFirst({
        where: { companyID, entityType: ENPL_ENTITY.site, enplCode: siteCode },
      });
      if (mapped) {
        return this.prisma.taskCustomerSite.findFirst({ where: { id: mapped.hrmsId, isDeleted: false } });
      }
      const byCode = await this.prisma.taskCustomerSite.findFirst({
        where: { siteCode, companyID, isDeleted: false },
      });
      if (byCode) return byCode;
    }
    if (customerID && siteName) {
      return this.prisma.taskCustomerSite.findFirst({
        where: {
          companyID,
          customerID,
          branchName: { equals: siteName, mode: 'insensitive' },
          isDeleted: false,
        },
      });
    }
    return null;
  }

  private async resolveDepartmentId(companyID: number, body: any): Promise<number | null> {
    const name = blank(body.departmentName || body.department?.departmentName);
    if (!name) return null;
    const row = await this.prisma.departments.findFirst({
      where: { companyID, departmentName: { equals: name, mode: 'insensitive' } },
    });
    if (row) return row.id;
    const created = await this.prisma.departments.create({
      data: { companyID, departmentName: name },
    });
    return created.id;
  }

  private async fetchEnplExport() {
    const base = (process.env.ENPL_ERP_BASE_URL || ENPL_ERP_BASE_DEFAULT).replace(/\/$/, '');
    const token = process.env.HRMS_EXPORT_TOKEN || process.env.HRMS_SYNC_TOKEN || '';
    const headers: Record<string, string> = {};
    if (token) headers['x-hrms-export-token'] = token;
    const res = await fetch(`${base}/hrms-export`, { headers });
    if (!res.ok) {
      throw new BadRequestException(`ENPL export failed HTTP ${res.status}`);
    }
    return res.json();
  }

  private async backfillMappingsFromErpColumns() {
    const company = await this.resolveCompany();
    const customers = await this.prisma.taskCustomer.findMany({
      where: { companyID: company.id, isDeleted: false },
      select: { id: true, erpAddressBookId: true, customerCode: true },
    });
    for (const row of customers) {
      await this.saveMapping(company.id, 'customer', row.id, row.erpAddressBookId, row.customerCode);
    }
    const sites = await this.prisma.taskCustomerSite.findMany({
      where: { companyID: company.id, isDeleted: false },
      select: { id: true, erpSiteId: true, siteCode: true },
    });
    for (const row of sites) {
      await this.saveMapping(company.id, 'site', row.id, row.erpSiteId, row.siteCode);
    }
    const tasks = await this.prisma.taskProject.findMany({
      where: { companyID: company.id, isDeleted: false },
      select: { id: true, erpTaskId: true, taskCode: true },
    });
    for (const row of tasks) {
      await this.saveMapping(company.id, 'task', row.id, row.erpTaskId, row.taskCode);
    }
  }
}
