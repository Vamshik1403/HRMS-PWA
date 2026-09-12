import { AsyncLocalStorage } from 'async_hooks';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getMutuallyLinkedCompanyIds } from '../company/federal-domain.util';
import {
  asEngineerAssignmentRows,
  assignmentRequestKind,
  inboundEngineerAssignmentStatus,
} from '../task-management/assignment-request.util';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
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
  normalizeEnplSiteVisits,
  normalizeEnplTaskStatus,
  toEnplContacts,
} from './enpl-sync.util';

type SyncStore = { skipOutbound: boolean };

@Injectable()
export class EnplSyncService {
  private readonly logger = new Logger(EnplSyncService.name);
  private readonly als = new AsyncLocalStorage<SyncStore>();
  private companyCache: { id: number; companyName: string | null; serviceProviderID: number | null } | null = null;
  private inboundLookups: any = null;

  constructor(
    private prisma: PrismaService,
    private push: PushNotificationsService,
  ) {}

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
        employees: '/api/integrations/enpl/employees',
      },
    };
  }

  async bulkImportFromEnpl() {
    const payload = await this.fetchEnplExport();
    this.inboundLookups = payload.lookups || null;
    try {
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
      const statusRepair = await this.recomputeStatusesFromRemarks();
      return {
        companyId: company.id,
        imported: { customers: customerOk, sites: siteOk, tasks: taskOk },
        statusRepair,
        errors: errors.slice(0, 50),
        errorCount: errors.length,
      };
    } finally {
      this.inboundLookups = null;
    }
  }

  async listEmployeesForEnpl() {
    const company = await this.resolveCompany();
    const linked = await getMutuallyLinkedCompanyIds(this.prisma, company.id);
    const companyIds = [...new Set([company.id, ...linked])];
    const rows = await this.prisma.manageEmployee.findMany({
      where: {
        companyID: { in: companyIds },
        isDeleted: false,
        lifecycleStatus: 'ACTIVE',
      },
      select: {
        id: true,
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        businessEmail: true,
        personalEmail: true,
        personalPhoneNo: true,
        businessPhoneNo: true,
        amc: true,
        departments: { select: { departmentName: true } },
        empDepartment: {
          orderBy: { id: 'desc' },
          take: 1,
          select: { department: { select: { departmentName: true } } },
        },
        employeeCredentials: { select: { username: true } },
        company: { select: { companyName: true } },
      },
      orderBy: [{ employeeFirstName: 'asc' }, { employeeLastName: 'asc' }],
    });
    return rows.map((row) => {
      const credUser = row.employeeCredentials?.username || '';
      const email =
        row.businessEmail ||
        row.personalEmail ||
        (credUser.includes('@') ? credUser : null) ||
        null;
      const department =
        row.departments?.departmentName ||
        row.empDepartment[0]?.department?.departmentName ||
        null;
      return {
        id: row.id,
        hrmsEmployeeId: row.id,
        employeeID: row.employeeID,
        name: [row.employeeFirstName, row.employeeLastName].filter(Boolean).join(' ').trim() || null,
        email,
        phone: row.personalPhoneNo || row.businessPhoneNo || null,
        department,
        departmentName: department,
        companyName: row.company?.companyName || null,
        amc: !!row.amc,
      };
    });
  }

  async recomputeStatusesFromRemarks(): Promise<{ scanned: number; updated: number }> {
    const company = await this.resolveCompany();
    const tasks = await this.prisma.taskProject.findMany({
      where: { companyID: company.id, isDeleted: false },
      select: {
        id: true,
        status: true,
        remarks: { orderBy: { createdAt: 'desc' }, select: { status: true } },
        engineerAssignments: { select: { status: true } },
      },
    });
    let updated = 0;
    for (const task of tasks) {
      const pending = task.engineerAssignments.some(
        (row) => assignmentRequestKind(row.status) !== 'working',
      );
      if (pending) continue;
      if (String(task.status || '').trim() === 'On-Hold') continue;
      const latest = task.remarks.find((row) => blank(row.status));
      if (!latest?.status) continue;
      const next = normalizeEnplTaskStatus(latest.status);
      if (!next || next === task.status) continue;
      await this.prisma.taskProject.update({
        where: { id: task.id },
        data: { status: next },
      });
      updated += 1;
    }
    this.logger.log(`ENPL status recompute: scanned ${tasks.length}, updated ${updated}`);
    return { scanned: tasks.length, updated };
  }

  /** ENPL assignment-action and site-visit are open JSON routes. Do not send HRMS_SYNC_TOKEN. */
  private async postEnplOpenJson(path: string, payload: Record<string, unknown>, label: string) {
    const base = (process.env.ENPL_ERP_BASE_URL || ENPL_ERP_BASE_DEFAULT).replace(/\/$/, '');
    const res = await fetch(`${base}/${path.replace(/^\//, '')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new BadRequestException(
        `ENPL ${label} failed HTTP ${res.status}${text ? `: ${text.slice(0, 400)}` : ''}`,
      );
    }
    return text;
  }

  async postTaskAssignmentAction(body: {
    action: 'accept' | 'reschedule';
    hrmsEmployeeId: number;
    email?: string | null;
    enplTaskId?: number | null;
    hrmsTaskId: number;
    reason?: string | null;
  }) {
    const payload: Record<string, unknown> = {
      action: body.action,
      hrmsEmployeeId: String(body.hrmsEmployeeId),
      hrmsTaskId: String(body.hrmsTaskId),
    };
    if (body.email) payload.email = body.email;
    if (body.enplTaskId != null) payload.enplTaskId = body.enplTaskId;
    if (body.reason) payload.reason = body.reason;
    return this.postEnplOpenJson('hrms-sync/task-assignment-action', payload, 'assignment action');
  }

  async postTaskSiteVisit(body: {
    kind: 'checkin' | 'checkout';
    hrmsEmployeeId: number;
    email?: string | null;
    enplTaskId?: number | null;
    hrmsTaskId: number;
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    addressText?: string | null;
    at?: string | null;
  }) {
    const payload: Record<string, unknown> = {
      kind: body.kind,
      hrmsEmployeeId: String(body.hrmsEmployeeId),
      hrmsTaskId: String(body.hrmsTaskId),
      latitude: body.latitude,
      longitude: body.longitude,
    };
    if (body.email) payload.email = body.email;
    if (body.enplTaskId != null) payload.enplTaskId = body.enplTaskId;
    if (body.accuracyMeters != null && Number.isFinite(body.accuracyMeters)) {
      payload.accuracyMeters = body.accuracyMeters;
    }
    if (body.addressText) payload.addressText = body.addressText;
    if (body.at) payload.at = body.at;
    return this.postEnplOpenJson('hrms-sync/task-site-visit', payload, 'site visit');
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
    const dueAt = asDate(body.dueAt || body.dueDateTime);
    const data: Prisma.TaskProjectUncheckedCreateInput = {
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
      dueDateTime: dueAt ?? (existing as any)?.dueDateTime ?? null,
      expectedDurationMinutes:
        asInt(body.expectedDurationMinutes) ?? (existing as any)?.expectedDurationMinutes ?? null,
      siteVisits:
        body.siteVisits !== undefined
          ? (normalizeEnplSiteVisits(body.siteVisits) as Prisma.InputJsonValue)
          : ((existing as any)?.siteVisits as Prisma.InputJsonValue | undefined),
      siteVisitSummary:
        body.siteVisitSummary !== undefined
          ? (body.siteVisitSummary as Prisma.InputJsonValue)
          : ((existing as any)?.siteVisitSummary as Prisma.InputJsonValue | undefined),
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

    await this.syncTaskWorkscopeFromEnpl(saved.id, company.id, body);
    await this.syncTaskInventoryFromEnpl(saved.id, company.id, body);
    await this.syncTaskPurchaseFromEnpl(saved.id, body);
    await this.syncTaskEngineersFromEnpl(saved.id, body, status);

    await this.saveMapping(company.id, 'task', saved.id, data.erpTaskId ?? null, taskCode);
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
          engineerAssignments: { select: { status: true } },
        },
      });
      if (!row || row.companyID !== company.id) return;
      const pendingAssignment = row.engineerAssignments.some(
        (a) => assignmentRequestKind(a.status) !== 'working',
      );
      const outboundStatus = row.isDeleted
        ? 'Cancelled'
        : pendingAssignment &&
            (row.status === 'Work in Progress' || row.status === 'WIP')
          ? 'On-Hold'
          : row.status;
      payload = {
        id: row.id,
        taskName: row.taskName,
        taskCode: row.taskCode,
        erpTaskId: row.erpTaskId ?? null,
        customerID: row.customerID,
        siteID: row.siteID,
        description: row.description,
        status: outboundStatus,
        isDeleted: row.isDeleted,
        priority: row.priority,
        taskType: row.taskType,
        createdBy: row.createdByName,
        dueAt: row.dueDateTime ? row.dueDateTime.toISOString() : null,
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

  private async linkedCompanyIds(): Promise<number[]> {
    const company = await this.resolveCompany();
    const linked = await getMutuallyLinkedCompanyIds(this.prisma, company.id);
    return [...new Set([company.id, ...linked])];
  }

  private lookupName(kind: 'workscopeCategories' | 'products', enplId: number | null): string | null {
    if (enplId == null || !this.inboundLookups) return null;
    const rows = this.inboundLookups[kind] || [];
    const match = rows.find((row: any) => Number(row.id) === enplId);
    if (!match) return null;
    return blank(match.workscopeCategoryName || match.productName || match.name);
  }

  private async resolveWorkscopeCategoryId(companyId: number, row: any): Promise<number | null> {
    const enplCatId = asInt(row?.workscopeCategoryId ?? row?.workscopeCategoryID);
    const name =
      blank(row?.workscopeCategoryName || row?.category?.workscopeCategoryName || row?.categoryName) ||
      this.lookupName('workscopeCategories', enplCatId);
    if (!name) return null;
    const existing = await this.prisma.taskWorkscopeCategory.findFirst({
      where: { companyID: companyId, workscopeCategoryName: { equals: name, mode: 'insensitive' } },
    });
    if (existing) return existing.id;
    const created = await this.prisma.taskWorkscopeCategory.create({
      data: { companyID: companyId, workscopeCategoryName: name },
    });
    return created.id;
  }

  private async resolveProductId(companyId: number, row: any): Promise<number | null> {
    const enplProductId = asInt(row?.productTypeId ?? row?.productId);
    const name =
      blank(row?.productName || row?.product?.productName) ||
      this.lookupName('products', enplProductId);
    if (!name) return null;
    const existing = await this.prisma.taskProduct.findFirst({
      where: { companyID: companyId, productName: { equals: name, mode: 'insensitive' } },
    });
    if (existing) return existing.id;
    const created = await this.prisma.taskProduct.create({
      data: { companyID: companyId, productName: name, productCode: blank(row?.productCode || row?.productId) },
    });
    return created.id;
  }

  private async findEmployeeForEngineer(row: any): Promise<number | null> {
    const companyIds = await this.linkedCompanyIds();
    const hrmsId = asInt(row?.hrmsEmployeeId || row?.manageEmployeeID || row?.hrmsId);
    if (hrmsId) {
      const byId = await this.prisma.manageEmployee.findFirst({
        where: { id: hrmsId, isDeleted: false, companyID: { in: companyIds } },
        select: { id: true },
      });
      if (byId) return byId.id;
    }
    const email = blank(row?.engineer?.email || row?.engineerEmail || row?.email)?.toLowerCase();
    if (email) {
      const byEmail = await this.prisma.manageEmployee.findFirst({
        where: {
          isDeleted: false,
          companyID: { in: companyIds },
          OR: [
            { businessEmail: { equals: email, mode: 'insensitive' } },
            { personalEmail: { equals: email, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      if (byEmail) return byEmail.id;
    }
    const code = blank(row?.employeeID || row?.engineer?.employeeID || row?.engineerCode);
    if (code) {
      const byCode = await this.prisma.manageEmployee.findFirst({
        where: {
          isDeleted: false,
          companyID: { in: companyIds },
          employeeID: { equals: code, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (byCode) return byCode.id;
    }
    return null;
  }

  private async syncTaskWorkscopeFromEnpl(taskID: number, companyId: number, body: any) {
    const workscope = Array.isArray(body?.workscopeDetails)
      ? body.workscopeDetails
      : Array.isArray(body?.workscope)
        ? body.workscope
        : null;
    if (!workscope) return;
    await this.prisma.taskWorkscopeDetail.deleteMany({ where: { taskID } });
    if (!workscope.length) return;
    await this.prisma.taskWorkscopeDetail.createMany({
      data: await Promise.all(
        workscope.map(async (row: any) => ({
          taskID,
          workscopeCategoryID: await this.resolveWorkscopeCategoryId(companyId, row),
          workscopeDetails: blank(row.workscopeDetails || row.details),
          extraNote: blank(row.extraNote || row.note),
        })),
      ),
    });
  }

  private async syncTaskInventoryFromEnpl(taskID: number, companyId: number, body: any) {
    const inventories = Array.isArray(body?.taskInventories)
      ? body.taskInventories
      : Array.isArray(body?.inventories)
        ? body.inventories
        : Array.isArray(body?.inventory)
          ? body.inventory
          : null;
    if (!inventories) return;
    await this.prisma.taskInventory.deleteMany({ where: { taskID } });
    if (!inventories.length) return;
    await this.prisma.taskInventory.createMany({
      data: await Promise.all(
        inventories.map(async (row: any) => ({
          taskID,
          productTypeId: await this.resolveProductId(companyId, row),
          makeModel: blank(row.makeModel),
          snMac: blank(row.snMac),
          description: blank(row.description),
          purchaseDate: asDate(row.purchaseDate),
          warrantyPeriod: blank(row.warrantyPeriod),
          warrantyStatus: blank(row.warrantyStatus),
          thirdPartyPurchase: !!row.thirdPartyPurchase,
        })),
      ),
    });
  }

  private async syncTaskPurchaseFromEnpl(taskID: number, body: any) {
    if (!body?.purchase || typeof body.purchase !== 'object') return;
    const purchase = body.purchase;
    await this.prisma.taskPurchase.deleteMany({ where: { taskID } });
    const products = Array.isArray(purchase.products) ? purchase.products : [];
    const attachments = Array.isArray(purchase.taskPurchaseAttachments)
      ? purchase.taskPurchaseAttachments
      : Array.isArray(purchase.attachments)
        ? purchase.attachments
        : [];
    await this.prisma.taskPurchase.create({
      data: {
        taskID,
        purchaseType: blank(purchase.purchaseType),
        customerName: blank(purchase.customerName),
        address: blank(purchase.address),
        products: products.length
          ? {
              create: products.map((p: any) => ({
                make: blank(p.make),
                model: blank(p.model),
                description: blank(p.description),
                warranty: blank(p.warranty),
                rate: p.rate != null ? String(p.rate) : null,
                vendor: blank(p.vendor),
                validity: p.validity != null ? String(p.validity) : null,
                availability: blank(p.availability),
              })),
            }
          : undefined,
        attachments: attachments.length
          ? {
              create: attachments
                .filter((att: any) => blank(att.filename) || blank(att.fileUrl))
                .map((att: any) => ({
                  filename: blank(att.filename) || 'attachment',
                  filepath: blank(att.filepath),
                  fileUrl: blank(att.fileUrl),
                  mimeType: blank(att.mimeType),
                  fileSize: asInt(att.fileSize),
                  erpFilepath: blank(att.filepath || att.erpFilepath),
                })),
            }
          : undefined,
      },
    });
  }

  private async syncTaskEngineersFromEnpl(taskID: number, body: any, taskStatus?: string | null) {
    const engineerRows = asEngineerAssignmentRows(body);
    if (!engineerRows) return;
    const previous = await this.prisma.taskEngineerAssignment.findMany({
      where: { taskID },
      select: { manageEmployeeID: true, status: true },
    });
    const alreadyPending = new Set(
      previous
        .filter(
          (row) =>
            row.manageEmployeeID != null && assignmentRequestKind(row.status) === 'pending',
        )
        .map((row) => row.manageEmployeeID as number),
    );
    await this.prisma.taskEngineerAssignment.deleteMany({ where: { taskID } });
    await this.prisma.taskAssignment.deleteMany({ where: { taskID } });
    if (!engineerRows.length) return;
    const assignedEmployeeIds = new Set<number>();
    const data: Array<{
      taskID: number;
      manageEmployeeID: number | null;
      engineerName: string | null;
      engineerEmail: string | null;
      engineerPhone: string | null;
      proposedDateTime: Date | null;
      priority: string | null;
      status: string | null;
      notes: string | null;
      assignedDate: Date | null;
      rescheduleReason: string | null;
      managerReason: string | null;
    }> = [];
    for (const row of engineerRows) {
      const manageEmployeeID = await this.findEmployeeForEngineer(row);
      if (manageEmployeeID) assignedEmployeeIds.add(manageEmployeeID);
      const rawStatus = blank(row.assignmentStatus || row.status);
      data.push({
        taskID,
        manageEmployeeID,
        engineerName: blank(
          row.engineer
            ? `${row.engineer.firstName || row.engineer.employeeFirstName || ''} ${row.engineer.lastName || row.engineer.employeeLastName || ''}`.trim()
            : row.engineerName || row.name,
        ),
        engineerEmail: blank(row.engineer?.email || row.engineerEmail || row.email),
        engineerPhone: blank(row.engineer?.phoneNumber || row.engineerPhone || row.phone),
        proposedDateTime: asDate(row.proposedDateTime),
        priority: blank(row.priority) ? normalizeEnplPriority(row.priority) : null,
        status: inboundEngineerAssignmentStatus(rawStatus, taskStatus, {
          requiresAccept: row.requiresAccept === true,
          showInRequests: row.showInRequests === true,
          hasPendingAssignment: body?.hasPendingAssignment === true,
          pendingAssignmentHrmsEmployeeIds: body?.pendingAssignmentHrmsEmployeeIds,
          hrmsEmployeeId: manageEmployeeID ?? asInt(row.hrmsEmployeeId || row.manageEmployeeID || row.hrmsId),
        }),
        notes: blank(row.notes),
        assignedDate: asDate(row.assignedDate),
        rescheduleReason: blank(row.rescheduleReason),
        managerReason: blank(row.managerReason),
      });
    }
    if (data.length) {
      await this.prisma.taskEngineerAssignment.createMany({ data });
    }
    if (assignedEmployeeIds.size) {
      await this.prisma.taskAssignment.createMany({
        data: [...assignedEmployeeIds].map((manageEmployeeID) => ({ taskID, manageEmployeeID })),
        skipDuplicates: true,
      });
    }
    const newlyPending = [
      ...new Set(
        data
          .filter(
            (row) =>
              row.manageEmployeeID != null &&
              assignmentRequestKind(row.status) === 'pending' &&
              !alreadyPending.has(row.manageEmployeeID),
          )
          .map((row) => row.manageEmployeeID as number),
      ),
    ];
    if (newlyPending.length) {
      void this.notifyNewPendingAssignments(taskID, newlyPending).catch((err) =>
        this.logger.warn(`Task request push failed for task ${taskID}: ${err?.message || err}`),
      );
    }
  }

  private formatAssignmentPushSchedule(iso?: Date | string | null): string {
    if (!iso) return '';
    const d = iso instanceof Date ? iso : new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  }

  private async notifyNewPendingAssignments(taskID: number, employeeIds: number[]) {
    const task = await this.prisma.taskProject.findFirst({
      where: { id: taskID },
      select: {
        taskName: true,
        scheduleDateTime: true,
        customer: { select: { customerName: true } },
        site: { select: { branchName: true, city: true } },
      },
    });
    const taskName = task?.taskName || `Task ${taskID}`;
    const customer = task?.customer?.customerName || '';
    const site = [task?.site?.branchName, task?.site?.city].filter(Boolean).join(', ');
    const schedule = this.formatAssignmentPushSchedule(task?.scheduleDateTime);
    const body = [customer, site, schedule].filter(Boolean).join(' · ') || 'New task request';
    for (const employeeId of employeeIds) {
      await this.push.sendToEmployee(employeeId, `Task request: ${taskName}`, body, {
        kind: 'task',
        event: 'task-request',
        url: `/empMyTasks?tab=Requests&taskId=${taskID}`,
        taskId: taskID,
        tag: `task-request-${taskID}-${employeeId}`,
      });
    }
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
