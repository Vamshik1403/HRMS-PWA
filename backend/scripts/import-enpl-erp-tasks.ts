/**
 * GET-only copy of ENPL-ERP customers, sites, and tasks into the Electrohelps HRMS tenant.
 *
 * Usage:
 *   npm run import:enpl-erp-tasks
 *   npx ts-node -r dotenv/config scripts/import-enpl-erp-tasks.ts
 *
 * Never POST/PUT/PATCH/DELETE ERP. Never writes ERP sites into Company/Branches.
 */
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const LOCAL_EXPORT_URL = process.env.HRMS_EXPORT_URL || 'http://127.0.0.1:8000/hrms-export';
const PUBLIC_EXPORT_URL = 'https://enplerp.electrohelps.in/backend/hrms-export';
const ERP_UPLOAD_ROOT =
  process.env.ERP_UPLOADS_DIR || '/home/server/ENPL-ERP/backend/uploads';
const HRMS_UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads');

const COMPANY_NAMES = new Set([
  'electrohelps networks pvt ltd',
  'electohelps networks pvt ltd',
  'electohelps',
  'electrohelps networks',
  'ehs networks',
]);

const prisma = new PrismaClient();

type JsonMap = Record<string, any>;

function blank(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeTaskStatus(status?: string | null): string {
  const value = String(status || '').trim();
  if (value === 'WIP') return 'Work in Progress';
  if (value === 'Closed') return 'Completed';
  return value || 'Open';
}

function effectiveErpStatus(src: any): string {
  const remarks = Array.isArray(src.remarks) ? [...src.remarks] : [];
  remarks.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return normalizeTaskStatus(remarks[0]?.status || src.status) || 'Open';
}

function httpGetBuffer(url: string, headers: Record<string, string> = {}): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, { headers, timeout: 120000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks) }));
    });
    req.on('timeout', () => req.destroy(new Error(`Timeout fetching ${url}`)));
    req.on('error', reject);
  });
}

async function httpGetJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const { status, body } = await httpGetBuffer(url, headers);
  if (status < 200 || status >= 300) {
    throw new Error(`GET ${url} failed with HTTP ${status}`);
  }
  return JSON.parse(body.toString('utf8'));
}

async function fetchExport(): Promise<any> {
  const headers: Record<string, string> = {};
  if (process.env.HRMS_EXPORT_TOKEN) {
    headers['x-hrms-export-token'] = process.env.HRMS_EXPORT_TOKEN;
  }
  try {
    console.log(`GET ${LOCAL_EXPORT_URL}`);
    return await httpGetJson(LOCAL_EXPORT_URL, headers);
  } catch (err) {
    console.warn(`Local ERP export failed: ${(err as Error).message}`);
    console.log(`GET ${PUBLIC_EXPORT_URL}`);
    return await httpGetJson(PUBLIC_EXPORT_URL, headers);
  }
}

function assertSingleCompany<T extends { id: number; companyName: string | null }>(companies: T[]): T {
  const matched = companies.filter((row) => COMPANY_NAMES.has((row.companyName || '').trim().toLowerCase()));
  if (matched.length === 0) {
    throw new Error(
      'No Company matched Electrohelps Networks Pvt Ltd / Electohelps / Electrohelps Networks / EHS Networks. Aborting.',
    );
  }
  if (matched.length > 1) {
    throw new Error(
      `Expected one Electrohelps company, found ${matched.length}: ${matched.map((c) => `${c.id}:${c.companyName}`).join(', ')}. Aborting.`,
    );
  }
  return matched[0];
}

function uploadsMatch(filepath?: string | null): string | null {
  const normalized = String(filepath || '').replace(/\\/g, '/');
  const match = normalized.match(/(?:^|\/)uploads\/(.+)$/);
  return match?.[1] || null;
}

function resolveLocalErpFile(filepath?: string | null, filename?: string | null, folder?: string): string | null {
  if (filepath && fs.existsSync(filepath)) return filepath;
  const relative = uploadsMatch(filepath);
  if (relative) {
    const fromRoot = path.join(ERP_UPLOAD_ROOT, relative);
    if (fs.existsSync(fromRoot)) return fromRoot;
    const fromBackend = path.join('/home/server/ENPL-ERP/backend', 'uploads', relative);
    if (fs.existsSync(fromBackend)) return fromBackend;
  }
  if (filename && folder) {
    const named = path.join(ERP_UPLOAD_ROOT, folder, filename);
    if (fs.existsSync(named)) return named;
  }
  return null;
}

function safeFilename(name: string): string {
  return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
}

async function importFile(opts: {
  filepath?: string | null;
  filename?: string | null;
  fileUrl?: string | null;
  folder: string;
}): Promise<{ filename: string; filepath: string; fileUrl: string; skipped: boolean } | null> {
  const originalName = safeFilename(opts.filename || path.basename(opts.filepath || opts.fileUrl || 'file'));
  if (!originalName) return null;
  const destDir = path.join(HRMS_UPLOAD_ROOT, opts.folder);
  const destPath = path.join(destDir, originalName);
  const publicUrl = `/uploads/${opts.folder}/${originalName}`;
  fs.mkdirSync(destDir, { recursive: true });
  if (fs.existsSync(destPath)) {
    return { filename: originalName, filepath: destPath, fileUrl: publicUrl, skipped: true };
  }

  const localSrc = resolveLocalErpFile(opts.filepath, opts.filename, opts.folder);
  if (localSrc) {
    fs.copyFileSync(localSrc, destPath);
    return { filename: originalName, filepath: destPath, fileUrl: publicUrl, skipped: false };
  }

  const candidates = [
    opts.fileUrl,
    opts.filepath ? `http://127.0.0.1:8000/uploads/${uploadsMatch(opts.filepath) || `${opts.folder}/${originalName}`}` : null,
    `http://127.0.0.1:8000/uploads/${opts.folder}/${originalName}`,
  ].filter(Boolean) as string[];

  for (const url of candidates) {
    try {
      const { status, body } = await httpGetBuffer(url);
      if (status >= 200 && status < 300 && body.length > 0) {
        fs.writeFileSync(destPath, body);
        return { filename: originalName, filepath: destPath, fileUrl: publicUrl, skipped: false };
      }
    } catch {
      /* try next */
    }
  }

  console.warn(`  file missing: ${originalName} (${opts.filepath || opts.fileUrl || 'no path'})`);
  return {
    filename: originalName,
    filepath: opts.filepath || destPath,
    fileUrl: opts.fileUrl || publicUrl,
    skipped: true,
  };
}

async function replaceCustomerContacts(customerID: number, contacts: any[]) {
  await prisma.taskCustomerContact.deleteMany({ where: { customerID } });
  const rows = (contacts || []).filter((c) => blank(c.contactPerson) && blank(c.contactNumber));
  if (!rows.length) return;
  await prisma.taskCustomerContact.createMany({
    data: rows.map((c) => ({
      customerID,
      contactPerson: String(c.contactPerson).trim(),
      contactNumber: String(c.contactNumber).trim(),
      designation: blank(c.designation),
      email: blank(c.emailAddress || c.email),
    })),
  });
}

async function replaceSiteChildren(siteID: number, contacts: any[], notes: any[]) {
  await prisma.taskCustomerSiteContact.deleteMany({ where: { siteID } });
  await prisma.taskCustomerSiteNote.deleteMany({ where: { siteID } });
  const contactRows = (contacts || []).filter((c) => blank(c.contactPerson) && blank(c.contactNumber));
  if (contactRows.length) {
    await prisma.taskCustomerSiteContact.createMany({
      data: contactRows.map((c) => ({
        siteID,
        contactPerson: String(c.contactPerson).trim(),
        contactNumber: String(c.contactNumber).trim(),
        designation: blank(c.designation),
        email: blank(c.emailAddress || c.email),
      })),
    });
  }
  const noteRows = (notes || []).filter((n) => blank(n.title));
  if (noteRows.length) {
    await prisma.taskCustomerSiteNote.createMany({
      data: noteRows.map((n) => ({
        siteID,
        title: String(n.title).trim(),
        description: blank(n.description),
        createdBy: blank(n.createdBy),
        createdAt: asDate(n.createdAt) || undefined,
      })),
    });
  }
}

async function replaceTaskNested(
  taskID: number,
  companyID: number,
  erp: any,
  maps: {
    workscope: Map<number, number>;
    product: Map<number, number>;
    employeeByEmail: Map<string, number>;
    engineer: Map<number, number | null>;
  },
) {
  await prisma.taskProjectContact.deleteMany({ where: { taskID } });
  await prisma.taskWorkscopeDetail.deleteMany({ where: { taskID } });
  await prisma.taskSchedule.deleteMany({ where: { taskID } });
  await prisma.taskRemark.deleteMany({ where: { taskID } });
  await prisma.taskImage.deleteMany({ where: { taskID } });
  await prisma.taskNote.deleteMany({ where: { taskID } });
  await prisma.taskInventory.deleteMany({ where: { taskID } });
  await prisma.taskPurchase.deleteMany({ where: { taskID } });
  await prisma.taskEngineerAssignment.deleteMany({ where: { taskID } });
  await prisma.taskAssignment.deleteMany({ where: { taskID } });

  const contacts = (erp.contacts || []).filter((c: any) => blank(c.contactName) && blank(c.contactNumber));
  if (contacts.length) {
    await prisma.taskProjectContact.createMany({
      data: contacts.map((c: any) => ({
        taskID,
        contactName: String(c.contactName).trim(),
        contactNumber: String(c.contactNumber).trim(),
        contactEmail: blank(c.contactEmail || c.emailAddress),
        designation: blank(c.designation),
      })),
    });
  }

  const workscope = erp.workscopeDetails || [];
  if (workscope.length) {
    await prisma.taskWorkscopeDetail.createMany({
      data: workscope.map((row: any) => ({
        taskID,
        workscopeCategoryID: maps.workscope.get(Number(row.workscopeCategoryId)) ?? null,
        workscopeDetails: blank(row.workscopeDetails),
        extraNote: blank(row.extraNote),
      })),
    });
  }

  const schedules = erp.schedule || [];
  if (schedules.length) {
    await prisma.taskSchedule.createMany({
      data: schedules.map((row: any) => ({
        taskID,
        proposedDateTime: asDate(row.proposedDateTime),
        priority: blank(row.priority),
      })),
    });
  }

  const remarks = erp.remarks || [];
  if (remarks.length) {
    await prisma.taskRemark.createMany({
      data: remarks.map((row: any) => ({
        taskID,
        remark: String(row.remark || '').trim() || '(empty)',
        status: blank(row.status),
        createdBy: blank(row.createdBy),
        authorName: blank(row.createdBy),
        createdAt: asDate(row.createdAt) || undefined,
      })),
    });
  }

  for (const image of erp.images || []) {
    const copied = await importFile({
      filepath: image.filepath,
      filename: image.filename,
      fileUrl: image.fileUrl,
      folder: 'tasks',
    });
    if (!copied) continue;
    await prisma.taskImage.create({
      data: {
        taskID,
        filename: copied.filename,
        filepath: copied.filepath,
        fileUrl: copied.fileUrl,
        mimeType: blank(image.mimeType),
        fileSize: image.fileSize ?? null,
        uploadedBy: blank(image.uploadedBy),
        uploadedByName: blank(image.uploadedByName),
        uploadedAt: asDate(image.uploadedAt) || undefined,
        erpFilepath: blank(image.filepath),
      },
    });
  }

  for (const note of erp.taskNotes || []) {
    const copied = await importFile({
      filepath: note.filepath,
      filename: note.filename,
      fileUrl: note.fileUrl,
      folder: 'task-notes',
    });
    await prisma.taskNote.create({
      data: {
        taskID,
        filename: copied?.filename || blank(note.filename),
        title: blank(note.title),
        description: blank(note.description),
        filepath: copied?.filepath || blank(note.filepath),
        fileUrl: copied?.fileUrl || blank(note.fileUrl),
        mimeType: blank(note.mimeType),
        fileSize: note.fileSize ?? null,
        note: blank(note.note),
        uploadedBy: blank(note.uploadedBy),
        uploadedByName: blank(note.uploadedByName),
        uploadedAt: asDate(note.uploadedAt) || undefined,
        erpFilepath: blank(note.filepath),
      },
    });
  }

  const inventories = erp.taskInventories || erp.inventories || [];
  if (inventories.length) {
    await prisma.taskInventory.createMany({
      data: inventories.map((row: any) => ({
        taskID,
        productTypeId: maps.product.get(Number(row.productTypeId)) ?? null,
        makeModel: blank(row.makeModel),
        snMac: blank(row.snMac),
        description: blank(row.description),
        purchaseDate: asDate(row.purchaseDate),
        warrantyPeriod: blank(row.warrantyPeriod),
        warrantyStatus: blank(row.warrantyStatus),
        thirdPartyPurchase: !!row.thirdPartyPurchase,
      })),
    });
  }

  if (erp.purchase) {
    const attachments: {
      filename: string;
      filepath: string;
      fileUrl: string;
      mimeType: string | null;
      fileSize: number | null;
      erpFilepath: string | null;
    }[] = [];
    for (const att of erp.purchase.taskPurchaseAttachments || erp.purchase.attachments || []) {
      const copied = await importFile({
        filepath: att.filepath,
        filename: att.filename,
        fileUrl: att.fileUrl,
        folder: 'purchase',
      });
      if (!copied) continue;
      attachments.push({
        filename: copied.filename,
        filepath: copied.filepath,
        fileUrl: copied.fileUrl,
        mimeType: blank(att.mimeType),
        fileSize: att.fileSize ?? null,
        erpFilepath: blank(att.filepath),
      });
    }
    await prisma.taskPurchase.create({
      data: {
        taskID,
        purchaseType: blank(erp.purchase.purchaseType),
        customerName: blank(erp.purchase.customerName),
        address: blank(erp.purchase.address),
        products: (erp.purchase.products || []).length
          ? {
              create: erp.purchase.products.map((p: any) => ({
                make: blank(p.make),
                model: blank(p.model),
                description: blank(p.description),
                warranty: blank(p.warranty),
                rate: p.rate != null ? String(p.rate) : null,
                vendor: blank(p.vendor),
                validity: p.validity ? String(p.validity) : null,
                availability: blank(p.availability),
              })),
            }
          : undefined,
        attachments: attachments.length ? { create: attachments } : undefined,
      },
    });
  }

  const assignedEmployeeIds = new Set<number>();
  const engineerRows = erp.engineerAssignments || [];
  if (engineerRows.length) {
    await prisma.taskEngineerAssignment.createMany({
      data: engineerRows.map((row: any) => {
        const email = blank(row.engineer?.email || row.engineerEmail)?.toLowerCase();
        const fromEmail = email ? maps.employeeByEmail.get(email) : undefined;
        const fromLookup = row.engineerId != null ? maps.engineer.get(Number(row.engineerId)) : undefined;
        const manageEmployeeID = fromEmail ?? fromLookup ?? null;
        if (manageEmployeeID) assignedEmployeeIds.add(manageEmployeeID);
        return {
          taskID,
          manageEmployeeID,
          engineerName: blank(
            row.engineer ? `${row.engineer.firstName || ''} ${row.engineer.lastName || ''}`.trim() : row.engineerName,
          ),
          engineerEmail: blank(row.engineer?.email || row.engineerEmail),
          engineerPhone: blank(row.engineer?.phoneNumber || row.engineerPhone),
          proposedDateTime: asDate(row.proposedDateTime),
          priority: blank(row.priority),
          status: blank(row.status),
          notes: blank(row.notes),
          assignedDate: asDate(row.assignedDate),
        };
      }),
    });
  }
  if (assignedEmployeeIds.size) {
    await prisma.taskAssignment.createMany({
      data: [...assignedEmployeeIds].map((manageEmployeeID) => ({ taskID, manageEmployeeID })),
      skipDuplicates: true,
    });
  }
}

async function resolveUniqueRow<T extends { id: number; companyID: number | null }>(opts: {
  companyID: number;
  erpId: number;
  baseCode: string;
  erpField: (row: T) => number | null | undefined;
  codeFrom: (row: T) => string;
  findByErp: () => Promise<T | null>;
  findByCode: (code: string) => Promise<T | null>;
  label: string;
}): Promise<{ existing: T | null; code: string }> {
  const byErp = await opts.findByErp();
  if (byErp) {
    if (byErp.companyID && byErp.companyID !== opts.companyID) {
      throw new Error(`${opts.label} ERP ${opts.erpId} already belongs to company ${byErp.companyID}`);
    }
    return { existing: byErp, code: opts.codeFrom(byErp) };
  }
  const byCode = await opts.findByCode(opts.baseCode);
  if (byCode) {
    if (byCode.companyID && byCode.companyID !== opts.companyID) {
      throw new Error(`${opts.label} ${opts.baseCode} already belongs to company ${byCode.companyID}`);
    }
    const ownedBy = opts.erpField(byCode);
    if (!ownedBy || ownedBy === opts.erpId) {
      return { existing: byCode, code: opts.baseCode };
    }
    const code = `${opts.baseCode}-${opts.erpId}`;
    const clash = await opts.findByCode(code);
    if (clash) {
      if (clash.companyID && clash.companyID !== opts.companyID) {
        throw new Error(`${opts.label} ${code} already belongs to company ${clash.companyID}`);
      }
      return { existing: clash, code };
    }
    return { existing: null, code };
  }
  return { existing: null, code: opts.baseCode };
}

async function main() {
  const payload = await fetchExport();
  const meta = payload.meta || {};
  const counts = meta.counts || {};
  console.log('ERP export meta:', JSON.stringify(counts));

  const companies = await prisma.company.findMany({ select: { id: true, companyName: true, serviceProviderID: true } });
  const company = assertSingleCompany(companies);
  const companyID = company.id;
  const serviceProviderID = company.serviceProviderID ?? null;
  console.log(`Importing into company ${companyID} (${company.companyName})`);

  const employees = await prisma.manageEmployee.findMany({
    where: { companyID, isDeleted: false },
    select: { id: true, businessEmail: true, personalEmail: true },
  });
  const employeeByEmail = new Map<string, number>();
  for (const emp of employees) {
    for (const email of [emp.businessEmail, emp.personalEmail]) {
      if (email?.trim()) employeeByEmail.set(email.trim().toLowerCase(), emp.id);
    }
  }

  const erpDepartmentId = new Map<number, number>();
  const erpWorkscopeCategoryId = new Map<number, number>();
  const erpProductId = new Map<number, number>();
  const erpEngineerId = new Map<number, number | null>();
  const erpAddressBookId = new Map<number, number>();
  const erpSiteId = new Map<number, number>();
  const erpTaskId = new Map<number, number>();

  for (const dept of payload.lookups?.departments || []) {
    const name = String(dept.departmentName || '').trim();
    if (!name) continue;
    let row = await prisma.departments.findFirst({
      where: { companyID, departmentName: { equals: name, mode: 'insensitive' } },
    });
    if (!row) {
      row = await prisma.departments.create({
        data: { companyID, serviceProviderID, departmentName: name },
      });
    }
    erpDepartmentId.set(Number(dept.id), row.id);
  }

  for (const cat of payload.lookups?.workscopeCategories || []) {
    const name = String(cat.workscopeCategoryName || '').trim();
    if (!name) continue;
    const row = await prisma.taskWorkscopeCategory.upsert({
      where: { companyID_workscopeCategoryName: { companyID, workscopeCategoryName: name } },
      update: {},
      create: { companyID, workscopeCategoryName: name },
    });
    erpWorkscopeCategoryId.set(Number(cat.id), row.id);
  }

  for (const product of payload.lookups?.products || []) {
    const name = String(product.productName || '').trim();
    if (!name) continue;
    const row = await prisma.taskProduct.upsert({
      where: { companyID_productName: { companyID, productName: name } },
      update: { productCode: blank(product.productId) },
      create: { companyID, productName: name, productCode: blank(product.productId) },
    });
    erpProductId.set(Number(product.id), row.id);
  }

  for (const engineer of payload.lookups?.engineers || []) {
    const email = blank(engineer.email)?.toLowerCase();
    erpEngineerId.set(Number(engineer.id), email ? employeeByEmail.get(email) ?? null : null);
  }

  console.log(`Lookups: ${erpDepartmentId.size} depts, ${erpWorkscopeCategoryId.size} workscope, ${erpProductId.size} products`);

  const customers: JsonMap[] = payload.customers || [];
  for (let i = 0; i < customers.length; i++) {
    const src = customers[i];
    const customerCodeBase = String(src.addressBookID || '').trim();
    if (!customerCodeBase) throw new Error(`Customer ${src.id} missing addressBookID`);
    const resolved = await resolveUniqueRow({
      companyID,
      erpId: Number(src.id),
      baseCode: customerCodeBase,
      erpField: (row) => row.erpAddressBookId,
      codeFrom: (row) => row.customerCode,
      findByErp: () => prisma.taskCustomer.findFirst({ where: { erpAddressBookId: Number(src.id) } }),
      findByCode: (code) => prisma.taskCustomer.findFirst({ where: { customerCode: code } }),
      label: 'Customer',
    });
    const customerCode = resolved.code;
    const rmEmail = blank(src.user?.email)?.toLowerCase();
    const rmMatched = rmEmail ? employeeByEmail.has(rmEmail) : false;
    const data = {
      serviceProviderID,
      companyID,
      customerCode,
      customerName: String(src.customerName || customerCode).trim(),
      addressType: blank(src.addressType) || 'Customer',
      address: blank(src.regdAddress),
      city: blank(src.city),
      state: blank(src.state),
      pincode: blank(src.pinCode),
      country: 'India',
      gstNo: blank(src.gstNo),
      erpAddressBookId: Number(src.id),
      relationshipManagerName: rmMatched ? blank(src.user?.fullName) : null,
      relationshipManagerEmail: rmMatched ? blank(src.user?.email) : null,
      isDeleted: false,
    };
    const saved = resolved.existing
      ? await prisma.taskCustomer.update({ where: { id: resolved.existing.id }, data })
      : await prisma.taskCustomer.create({
          data: { ...data, createdAt: asDate(src.createdAt) || undefined },
        });
    await replaceCustomerContacts(saved.id, src.contacts || []);
    erpAddressBookId.set(Number(src.id), saved.id);
    if ((i + 1) % 50 === 0 || i === customers.length - 1) {
      console.log(`Customers ${i + 1}/${customers.length}`);
    }
  }

  const sites: JsonMap[] = payload.sites || [];
  for (let i = 0; i < sites.length; i++) {
    const src = sites[i];
    const siteCodeBase = String(src.siteID || '').trim();
    if (!siteCodeBase) throw new Error(`Site ${src.id} missing siteID`);
    const customerID = erpAddressBookId.get(Number(src.addressBookId));
    if (!customerID) {
      console.warn(`Skipping site ${siteCodeBase}: parent customer ${src.addressBookId} not imported`);
      continue;
    }
    const resolved = await resolveUniqueRow({
      companyID,
      erpId: Number(src.id),
      baseCode: siteCodeBase,
      erpField: (row) => row.erpSiteId,
      codeFrom: (row) => row.siteCode || siteCodeBase,
      findByErp: () => prisma.taskCustomerSite.findFirst({ where: { erpSiteId: Number(src.id) } }),
      findByCode: (code) => prisma.taskCustomerSite.findFirst({ where: { siteCode: code } }),
      label: 'Site',
    });
    const siteCode = resolved.code;
    const data = {
      companyID,
      customerID,
      siteCode,
      erpSiteId: Number(src.id),
      branchName: String(src.siteName || siteCode).trim(),
      address: blank(src.siteAddress),
      city: blank(src.city),
      state: blank(src.state),
      pincode: blank(src.pinCode),
      country: 'India',
      gstNo: blank(src.gstNo),
      isDeleted: false,
    };
    const saved = resolved.existing
      ? await prisma.taskCustomerSite.update({ where: { id: resolved.existing.id }, data })
      : await prisma.taskCustomerSite.create({
          data: { ...data, createdAt: asDate(src.createdAt) || undefined },
        });
    await replaceSiteChildren(saved.id, src.contacts || [], src.siteNotes || []);
    erpSiteId.set(Number(src.id), saved.id);
    if ((i + 1) % 50 === 0 || i === sites.length - 1) {
      console.log(`Sites ${i + 1}/${sites.length}`);
    }
  }

  const tasks: JsonMap[] = payload.tasks || [];
  for (let i = 0; i < tasks.length; i++) {
    const src = tasks[i];
    const taskCode = String(src.taskID || '').trim();
    if (!taskCode) throw new Error(`Task ${src.id} missing taskID`);
    const firstSchedule = (src.schedule || [])[0];
    const data = {
      serviceProviderID,
      companyID,
      taskCode,
      erpTaskId: Number(src.id),
      departmentID: src.departmentId != null ? erpDepartmentId.get(Number(src.departmentId)) ?? null : null,
      taskType: String(src.taskType || 'SERVICE'),
      customerID: src.addressBookId != null ? erpAddressBookId.get(Number(src.addressBookId)) ?? null : null,
      siteID: src.siteId != null ? erpSiteId.get(Number(src.siteId)) ?? null : null,
      taskName: blank(src.title) || taskCode,
      description: blank(src.description),
      attachment: blank(src.attachment),
      scheduleDateTime: asDate(firstSchedule?.proposedDateTime),
      priority: blank(firstSchedule?.priority) || blank(src.priority) || 'Medium',
      status: effectiveErpStatus(src),
      createdByName: blank(src.createdBy),
      isDeleted: false,
    };
    const existing = await prisma.taskProject.findFirst({
      where: { OR: [{ erpTaskId: Number(src.id) }, { taskCode }] },
    });
    if (existing && existing.companyID && existing.companyID !== companyID) {
      throw new Error(`Task ${taskCode} already belongs to company ${existing.companyID}`);
    }
    const saved = existing
      ? await prisma.taskProject.update({ where: { id: existing.id }, data })
      : await prisma.taskProject.create({
          data: { ...data, createdAt: asDate(src.createdAt) || undefined },
        });
    await replaceTaskNested(saved.id, companyID, src, {
      workscope: erpWorkscopeCategoryId,
      product: erpProductId,
      employeeByEmail,
      engineer: erpEngineerId,
    });
    erpTaskId.set(Number(src.id), saved.id);
    if ((i + 1) % 25 === 0 || i === tasks.length - 1) {
      console.log(`Tasks ${i + 1}/${tasks.length}`);
    }
  }

  async function upsertMapping(
    entityType: string,
    hrmsId: number,
    enplId: number | null,
    enplCode: string | null,
  ) {
    await prisma.enplEntityMapping.upsert({
      where: { entityType_hrmsId: { entityType, hrmsId } },
      create: { companyID, entityType, hrmsId, enplId, enplCode },
      update: { enplId, enplCode },
    });
  }
  for (const [enpl, hrms] of erpAddressBookId) {
    const row = await prisma.taskCustomer.findUnique({ where: { id: hrms }, select: { customerCode: true } });
    await upsertMapping('customer', hrms, enpl, row?.customerCode ?? null);
  }
  for (const [enpl, hrms] of erpSiteId) {
    const row = await prisma.taskCustomerSite.findUnique({ where: { id: hrms }, select: { siteCode: true } });
    await upsertMapping('site', hrms, enpl, row?.siteCode ?? null);
  }
  for (const [enpl, hrms] of erpTaskId) {
    const row = await prisma.taskProject.findUnique({ where: { id: hrms }, select: { taskCode: true } });
    await upsertMapping('task', hrms, enpl, row?.taskCode ?? null);
  }
  console.log('Wrote ENPL id ↔ HRMS id mappings');

  const tenant = {
    customers: await prisma.taskCustomer.count({ where: { companyID, isDeleted: false } }),
    sites: await prisma.taskCustomerSite.count({ where: { companyID, isDeleted: false } }),
    tasks: await prisma.taskProject.count({ where: { companyID, isDeleted: false } }),
    customerContacts: await prisma.taskCustomerContact.count({ where: { customer: { companyID } } }),
    siteContacts: await prisma.taskCustomerSiteContact.count({ where: { site: { companyID } } }),
    siteNotes: await prisma.taskCustomerSiteNote.count({ where: { site: { companyID } } }),
    taskContacts: await prisma.taskProjectContact.count({ where: { task: { companyID } } }),
    taskRemarks: await prisma.taskRemark.count({ where: { task: { companyID } } }),
    taskSchedules: await prisma.taskSchedule.count({ where: { task: { companyID } } }),
    taskWorkscopeDetails: await prisma.taskWorkscopeDetail.count({ where: { task: { companyID } } }),
    taskEngineerAssignments: await prisma.taskEngineerAssignment.count({ where: { task: { companyID } } }),
    taskImages: await prisma.taskImage.count({ where: { task: { companyID } } }),
    taskNotes: await prisma.taskNote.count({ where: { task: { companyID } } }),
    taskPurchases: await prisma.taskPurchase.count({ where: { task: { companyID } } }),
  };
  const leaked = {
    customers: await prisma.taskCustomer.count({
      where: { erpAddressBookId: { not: null }, companyID: { not: companyID } },
    }),
    sites: await prisma.taskCustomerSite.count({
      where: { erpSiteId: { not: null }, companyID: { not: companyID } },
    }),
    tasks: await prisma.taskProject.count({
      where: { erpTaskId: { not: null }, companyID: { not: companyID } },
    }),
  };

  console.log('HRMS tenant counts:', tenant);
  console.log('Leaked to other companies:', leaked);
  if (tenant.customers !== (counts.customers ?? customers.length)) {
    throw new Error(`Customer count mismatch: HRMS ${tenant.customers} vs ERP ${counts.customers}`);
  }
  if (tenant.sites !== (counts.sites ?? sites.length)) {
    throw new Error(`Site count mismatch: HRMS ${tenant.sites} vs ERP ${counts.sites}`);
  }
  if (tenant.tasks !== (counts.tasks ?? tasks.length)) {
    throw new Error(`Task count mismatch: HRMS ${tenant.tasks} vs ERP ${counts.tasks}`);
  }
  if (leaked.customers || leaked.sites || leaked.tasks) {
    throw new Error('ERP codes were written to another company. Aborting after import — inspect data.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
