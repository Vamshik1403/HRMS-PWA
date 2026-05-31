/**
 * One-time employee import for Manage Employees (ManageEmployee table).
 *
 * Usage:
 *   npm run import:employees
 *   npm run import:employees -- --file ../../scripts/import/employees_import.json
 *   npm run import:employees -- --file ../../scripts/import/employees_import.csv --dry-run
 */
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const SALT_ROUNDS = 12;

type ImportDefaults = {
  serviceProviderID?: number;
  companyID?: number;
  branchesID?: number;
  workShiftID?: number;
  attendancePolicyID?: number;
  leavePolicyID?: number;
  employmentType?: string;
  employmentStatus?: string;
  probationPeriod?: string;
  salaryPayGradeType?: string;
  monthlyPayGradeID?: number;
  hourlyPayGradeID?: number;
  typeOfEmployee?: string;
};

type RawEmployeeRow = Record<string, unknown>;

type NormalizedEmployee = {
  employeeID?: string;
  employeeFirstName?: string;
  employeeLastName?: string;
  joiningDate?: string;
  businessPhoneNo?: string;
  businessEmail?: string;
  personalPhoneNo?: string;
  personalEmail?: string;
  emergancyContact?: string;
  presentAddress?: string;
  permenantAddress?: string;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  maritalStatus?: string;
  employeeFatherName?: string;
  employeeMotherName?: string;
  employeeSpouseName?: string;
  numberOfChildren?: number;
  aadharNo?: string;
  panNo?: string;
  uanNo?: string;
  esiNo?: string;
  pfMemberStatus?: string;
  pfNumber?: string;
  departmentNameID?: number;
  designationID?: number;
  departmentName?: string;
  designation?: string;
  bankDetails?: {
    bankName?: string;
    bankBranchName?: string;
    accNumber?: string;
    ifscCode?: string;
    upi?: string;
  }[];
  serviceProviderID?: number;
  companyID?: number;
  branchesID?: number;
  workShiftID?: number;
  attendancePolicyID?: number;
  leavePolicyID?: number;
  employmentType?: string;
  employmentStatus?: string;
  probationPeriod?: string;
  salaryPayGradeType?: string;
  monthlyPayGradeID?: number;
  hourlyPayGradeID?: number;
  typeOfEmployee?: string;
};

type ImportFile = {
  defaults?: ImportDefaults;
  employees: RawEmployeeRow[];
};

type Report = {
  runAt: string;
  sourceFile: string;
  dryRun: boolean;
  replaceExisting: boolean;
  totalRows: number;
  imported: { employeeID: string; id: number; name: string }[];
  replaced: { employeeID: string; oldId: number; newId: number; name: string }[];
  skipped: { employeeID?: string; email?: string; reason: string }[];
  failed: { employeeID?: string; error: string }[];
};

/** Excel export column names (with *) from employees_import.json */
const DEPT_NAME_MAP: Record<string, string> = {
  'hr department': 'Admin',
  'technical department': 'Technical',
  'it department': 'Software',
  'sales department': 'Sales',
  'purchase': 'Purchase',
  'accounts department': 'Accounts',
};

const DESIGNATION_NAME_MAP: Record<string, string> = {
  'filed engineer': 'Field Engineer',
  'filed engineer (trainee)': 'Field Engineer',
  'software developer': 'Jr. Software Developer',
  'junior software developer': 'Jr. Software Developer',
  'presales network engineer': 'Presales Engineer',
  'jr. network engineer (trainee)': 'Jr. Network Enginner',
  'purchase executive (trainee)': 'Purchase Manager',
  'sr manager': 'Sales Manager',
  'l1 engineer': 'Field Engineer',
  'surveillance engineer cum surveillance surveillance officer': 'Field Engineer',
  'accounts executive': 'Accountant',
};

const COLUMN_ALIASES: Record<string, string[]> = {
  employeeID: [
    'employeeID',
    'employee_id',
    'employeeId',
    'empCode',
    'emp_code',
    'Emp Code',
    'Employee Code',
    'Employee Code*',
    'Employee ID',
    'EmployeeID',
    'Code',
  ],
  employeeFirstName: [
    'employeeFirstName',
    'firstName',
    'first_name',
    'First Name',
    'fname',
  ],
  employeeLastName: [
    'employeeLastName',
    'lastName',
    'last_name',
    'Last Name',
    'lname',
    'Surname',
  ],
  fullName: ['fullName', 'full_name', 'Full Name', 'Employee Name', 'Name', 'Name*'],
  joiningDate: [
    'joiningDate',
    'joining_date',
    'Joining Date',
    'Date of Joining',
    'DOJ',
    'DOJ*',
  ],
  personalPhoneNo: [
    'personalPhoneNo',
    'personal_phone',
    'Mobile',
    'Mobile No',
    'Mobile No*',
    'Login Through*',
    'Phone',
    'Contact No',
    'Personal Phone',
  ],
  businessPhoneNo: ['businessPhoneNo', 'business_phone', 'Business Phone'],
  personalEmail: [
    'personalEmail',
    'personal_email',
    'Personal Email',
    'Email',
    'Email*',
    'email',
  ],
  businessEmail: ['businessEmail', 'business_email', 'Business Email'],
  departmentName: [
    'departmentName',
    'department',
    'Department',
    'Employee Department',
    'Dept',
    'department_name',
  ],
  designation: [
    'designation',
    'Designation',
    'Employee Designation',
    'Job Title',
    'Title',
  ],
  gender: ['gender', 'Gender', 'Gender*'],
  dateOfBirth: ['dateOfBirth', 'date_of_birth', 'DOB', 'DOB*', 'Date of Birth'],
  bloodGroup: ['bloodGroup', 'blood_group', 'Blood Group'],
  maritalStatus: ['maritalStatus', 'marital_status', 'Marital Status'],
  presentAddress: [
    'presentAddress',
    'present_address',
    'Present Address',
    'Address',
    'Emp Address',
  ],
  permenantAddress: [
    'permenantAddress',
    'permanentAddress',
    'permanent_address',
    'Permanent Address',
  ],
  aadharNo: ['aadharNo', 'aadhar', 'Aadhaar', 'Aadhar', 'ADHAAR', 'aadhar_no'],
  panNo: ['panNo', 'pan', 'PAN', 'pan_no'],
  uanNo: ['uanNo', 'uan', 'UAN'],
  esiNo: ['esiNo', 'esi', 'ESI'],
  pfNumber: ['pfNumber', 'pf', 'PF Number', 'PF No'],
  employeeFatherName: ['employeeFatherName', 'fatherName', "Father's Name", 'Father Name'],
  bankName: ['bankName', 'Bank Name', 'bank'],
  bankBranchName: ['bankBranchName', 'Bank Branch', 'Branch Name', 'branch'],
  accNumber: [
    'accNumber',
    'accountNumber',
    'Account No',
    'Account Number',
    'Bank Account',
  ],
  ifscCode: ['ifscCode', 'ifsc', 'IFSC', 'IFSC Code'],
  upi: ['upi', 'UPI'],
};

function parseArgs() {
  const args = process.argv.slice(2);
  let file: string | undefined;
  let dryRun = false;
  let replaceExisting = true;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      file = args[++i];
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--no-replace') {
      replaceExisting = false;
    } else if (args[i] === '--replace') {
      replaceExisting = true;
    }
  }
  const backendDir = path.resolve(__dirname, '..');
  const defaultCandidates = [
    path.join(backendDir, '../scripts/import/employees_import.json'),
    path.join(backendDir, '../scripts/import/employees.json'),
    path.join(backendDir, '../scripts/import/employees_import.csv'),
  ];
  const resolved =
    file != null
      ? path.resolve(process.cwd(), file)
      : defaultCandidates.find((p) => fs.existsSync(p));
  if (!resolved) {
    throw new Error(
      `No import file found. Copy employees_import.json to scripts/import/ and run:\n` +
        `  npm run import:employees -- --file ../scripts/import/employees_import.json`,
    );
  }
  return { file: resolved, dryRun, replaceExisting };
}

function normalizeLookupKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function mapDepartmentName(name: string | undefined): string | undefined {
  if (!name?.trim()) return undefined;
  const key = normalizeLookupKey(name);
  return DEPT_NAME_MAP[key] ?? name.trim();
}

function mapDesignationName(name: string | undefined): string | undefined {
  if (!name?.trim()) return undefined;
  const key = normalizeLookupKey(name);
  return DESIGNATION_NAME_MAP[key] ?? name.trim();
}

function normalizePhone(v: unknown): string | undefined {
  const s = asString(v);
  if (!s) return undefined;
  const digits = s.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  return digits.length >= 6 ? digits : undefined;
}

function normalizeNumericId(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) {
    return String(Math.trunc(v));
  }
  const s = String(v).trim();
  return s || undefined;
}

function parseJoiningDate(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const s = String(v).trim();
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return formatDateCell(v);
}

function pickAlias(row: RawEmployeeRow, field: string): unknown {
  const keys = COLUMN_ALIASES[field] ?? [field];
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return row[k];
    }
  }
  return undefined;
}

function asString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
}

function asNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeEmail(v: unknown): string | undefined {
  const s = asString(v);
  return s ? s.toLowerCase() : undefined;
}

function splitFullName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function formatDateCell(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 100000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(n));
    return epoch.toISOString().slice(0, 10);
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return s;
}

function normalizeRow(row: RawEmployeeRow, defaults: ImportDefaults): NormalizedEmployee {
  let first = asString(pickAlias(row, 'employeeFirstName'));
  let last = asString(pickAlias(row, 'employeeLastName'));
  const full = asString(pickAlias(row, 'fullName'));
  if (full && !first && !last) {
    const split = splitFullName(full);
    first = split.first || undefined;
    last = split.last || undefined;
  }

  const bankName = asString(pickAlias(row, 'bankName'));
  const accNumber = normalizeNumericId(pickAlias(row, 'accNumber'));
  const bankDetails =
    bankName || accNumber
      ? [
          {
            bankName,
            bankBranchName: asString(pickAlias(row, 'bankBranchName')),
            accNumber,
            ifscCode: asString(pickAlias(row, 'ifscCode')),
            upi: asString(pickAlias(row, 'upi')),
          },
        ]
      : undefined;

  const direct = row as NormalizedEmployee;

  return {
    employeeID: asString(direct.employeeID ?? pickAlias(row, 'employeeID')),
    employeeFirstName: first,
    employeeLastName: last,
    joiningDate: parseJoiningDate(direct.joiningDate ?? pickAlias(row, 'joiningDate')),
    businessPhoneNo: normalizePhone(direct.businessPhoneNo ?? pickAlias(row, 'businessPhoneNo')),
    businessEmail: normalizeEmail(direct.businessEmail ?? pickAlias(row, 'businessEmail')),
    personalPhoneNo: normalizePhone(direct.personalPhoneNo ?? pickAlias(row, 'personalPhoneNo')),
    personalEmail: normalizeEmail(direct.personalEmail ?? pickAlias(row, 'personalEmail')),
    emergancyContact: asString(direct.emergancyContact),
    presentAddress: asString(direct.presentAddress ?? pickAlias(row, 'presentAddress')),
    permenantAddress: asString(direct.permenantAddress ?? pickAlias(row, 'permenantAddress')),
    gender: asString(direct.gender ?? pickAlias(row, 'gender')),
    dateOfBirth: formatDateCell(direct.dateOfBirth ?? pickAlias(row, 'dateOfBirth')),
    bloodGroup: asString(direct.bloodGroup ?? pickAlias(row, 'bloodGroup')),
    maritalStatus: asString(direct.maritalStatus ?? pickAlias(row, 'maritalStatus')),
    employeeFatherName: asString(
      direct.employeeFatherName ?? pickAlias(row, 'employeeFatherName'),
    ),
    employeeMotherName: asString(direct.employeeMotherName),
    employeeSpouseName: asString(direct.employeeSpouseName),
    numberOfChildren: asNumber(direct.numberOfChildren),
    aadharNo: normalizeNumericId(direct.aadharNo ?? pickAlias(row, 'aadharNo')),
    panNo: asString(direct.panNo ?? pickAlias(row, 'panNo')),
    uanNo: normalizeNumericId(direct.uanNo ?? pickAlias(row, 'uanNo')),
    esiNo: asString(direct.esiNo ?? pickAlias(row, 'esiNo')),
    pfNumber: asString(direct.pfNumber ?? pickAlias(row, 'pfNumber')),
    pfMemberStatus: asString(direct.pfMemberStatus),
    departmentNameID: asNumber(direct.departmentNameID),
    designationID: asNumber(direct.designationID),
    departmentName: mapDepartmentName(
      asString(direct.departmentName ?? pickAlias(row, 'departmentName')),
    ),
    designation: mapDesignationName(
      asString(direct.designation ?? pickAlias(row, 'designation')),
    ),
    bankDetails: direct.bankDetails ?? bankDetails,
    serviceProviderID: asNumber(direct.serviceProviderID) ?? defaults.serviceProviderID,
    companyID: asNumber(direct.companyID) ?? defaults.companyID,
    branchesID: asNumber(direct.branchesID) ?? defaults.branchesID,
    workShiftID: asNumber(direct.workShiftID) ?? defaults.workShiftID,
    attendancePolicyID:
      asNumber(direct.attendancePolicyID) ?? defaults.attendancePolicyID,
    leavePolicyID: asNumber(direct.leavePolicyID) ?? defaults.leavePolicyID,
    employmentType: asString(direct.employmentType) ?? defaults.employmentType,
    employmentStatus: asString(direct.employmentStatus) ?? defaults.employmentStatus,
    probationPeriod: asString(direct.probationPeriod) ?? defaults.probationPeriod,
    salaryPayGradeType:
      asString(direct.salaryPayGradeType) ?? defaults.salaryPayGradeType,
    monthlyPayGradeID:
      asNumber(direct.monthlyPayGradeID) ?? defaults.monthlyPayGradeID,
    hourlyPayGradeID:
      asNumber(direct.hourlyPayGradeID) ?? defaults.hourlyPayGradeID,
    typeOfEmployee: asString(direct.typeOfEmployee) ?? defaults.typeOfEmployee,
  };
}

function loadImportFile(filePath: string): ImportFile {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(raw)) return { employees: raw };
    if (raw.employees && Array.isArray(raw.employees)) return raw as ImportFile;
    throw new Error('JSON must be an array or { defaults?, employees: [] }');
  }
  if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') {
    const buf = fs.readFileSync(filePath);
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true, raw: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const employees = XLSX.utils.sheet_to_json<RawEmployeeRow>(sheet, {
      defval: null,
    });
    return { employees };
  }
  throw new Error(`Unsupported file type: ${ext}`);
}

function loadDefaults(fileDefaults?: ImportDefaults): ImportDefaults {
  const defaultsPath = path.resolve(
    __dirname,
    '../../scripts/import/import.defaults.json',
  );
  const fromFile = fs.existsSync(defaultsPath)
    ? (JSON.parse(fs.readFileSync(defaultsPath, 'utf8')) as ImportDefaults)
    : {};
  return { ...fromFile, ...fileDefaults };
}

async function resolveDepartmentId(
  prisma: PrismaClient,
  name: string | undefined,
  branchesID: number | undefined,
): Promise<number | undefined> {
  if (!name?.trim() || !branchesID) return undefined;
  const mapped = mapDepartmentName(name) ?? name.trim();
  let row = await prisma.departments.findFirst({
    where: {
      branchesID,
      departmentName: { equals: mapped, mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (!row) {
    const token = mapped.split(/\s+/)[0];
    row = await prisma.departments.findFirst({
      where: {
        branchesID,
        departmentName: { contains: token, mode: 'insensitive' },
      },
      select: { id: true },
    });
  }
  return row?.id;
}

async function resolveDesignationId(
  prisma: PrismaClient,
  name: string | undefined,
  branchesID: number | undefined,
): Promise<number | undefined> {
  if (!name?.trim() || !branchesID) return undefined;
  const mapped = mapDesignationName(name) ?? name.trim();
  let row = await prisma.designations.findFirst({
    where: {
      branchesID,
      designation: { equals: mapped, mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (!row) {
    row = await prisma.designations.findFirst({
      where: {
        branchesID,
        designation: { contains: mapped.split(' ')[0], mode: 'insensitive' },
      },
      select: { id: true },
    });
  }
  return row?.id;
}

async function findDuplicate(
  prisma: PrismaClient,
  companyID: number,
  employeeID?: string,
  businessEmail?: string,
  personalEmail?: string,
) {
  const or: object[] = [];
  if (employeeID) {
    or.push({ employeeID: { equals: employeeID, mode: 'insensitive' as const } });
  }
  if (businessEmail) or.push({ businessEmail });
  if (personalEmail) or.push({ personalEmail });
  if (!or.length) return null;
  return prisma.manageEmployee.findFirst({
    where: { companyID, OR: or },
    select: { id: true, employeeID: true, businessEmail: true, personalEmail: true },
  });
}

type ManageEmployeeServiceLike = { remove: (id: number) => Promise<unknown> };

let nestContext: import('@nestjs/common').INestApplicationContext | null = null;
let manageEmployeeService: ManageEmployeeServiceLike | null = null;

async function getManageEmployeeService(): Promise<ManageEmployeeServiceLike> {
  if (manageEmployeeService) return manageEmployeeService;
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../src/app.module');
  const { ManageEmployeeService } = await import('../src/manage-employee/manage-employee.service');
  nestContext = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const service = nestContext.get(ManageEmployeeService);
  manageEmployeeService = service;
  return service;
}

/** Delete child rows not covered by ManageEmployeeService.remove (FK blockers). */
async function purgeEmployeeRelations(prisma: PrismaClient, id: number): Promise<void> {
  const reimbs = await prisma.reimbursement.findMany({
    where: { manageEmployeeID: id },
    select: { id: true },
  });
  if (reimbs.length) {
    await prisma.reimbursementItem.deleteMany({
      where: { reimbursementID: { in: reimbs.map((r) => r.id) } },
    });
  }

  const rosterRows = await prisma.rosterEmployee.findMany({
    where: { employeeID: id },
    select: { id: true },
  });
  if (rosterRows.length) {
    await prisma.rosterDay.deleteMany({
      where: { rosterEmployeeID: { in: rosterRows.map((r) => r.id) } },
    });
  }

  const advances = await prisma.salaryAdvance.findMany({
    where: { manageEmployeeID: id },
    select: { id: true },
  });
  if (advances.length) {
    await prisma.salaryAdvanceRepayment.deleteMany({
      where: { salaryAdvanceID: { in: advances.map((a) => a.id) } },
    });
  }

  await prisma.taskAssignment.deleteMany({ where: { manageEmployeeID: id } });
  await prisma.attendanceLocation.deleteMany({ where: { employeeId: id } });
  await prisma.empAbsentDeclaration.deleteMany({ where: { employeeId: id } });
  await prisma.reimbursement.deleteMany({ where: { manageEmployeeID: id } });
  await prisma.empLeaveBalance.deleteMany({ where: { manageEmployeeID: id } });
  await prisma.generateSalary.deleteMany({ where: { employeeID: id } });
  await prisma.rosterEmployee.deleteMany({ where: { employeeID: id } });
  await prisma.overtime.deleteMany({ where: { employeeID: id } });
  await prisma.salaryAdvance.deleteMany({ where: { manageEmployeeID: id } });
  await prisma.employeeMemo.deleteMany({ where: { employeeID: id } });
  await prisma.privilegedLeaveLedger.deleteMany({ where: { employeeID: id } });
  await prisma.privilegedLeaveLapse.deleteMany({ where: { employeeID: id } });
  await prisma.employeeHolidayOverride.deleteMany({ where: { employeeID: id } });
  await prisma.employeeWeeklyOff.deleteMany({ where: { employeeID: id } });
  await prisma.employeeLink.deleteMany({
    where: { OR: [{ employeeId: id }, { linkedEmployeeId: id }] },
  });
  await prisma.employeeTermination.deleteMany({ where: { employeeId: id } });
}

async function deleteExistingEmployee(
  prisma: PrismaClient,
  id: number,
): Promise<void> {
  await purgeEmployeeRelations(prisma, id);
  const service = await getManageEmployeeService();
  await service.remove(id);
}

async function createEmployee(
  prisma: PrismaClient,
  emp: NormalizedEmployee,
): Promise<number> {
  const companyID = emp.companyID!;
  const branchesID = emp.branchesID;
  const departmentNameID =
    emp.departmentNameID ??
    (await resolveDepartmentId(prisma, emp.departmentName, branchesID));
  const designationID =
    emp.designationID ??
    (await resolveDesignationId(prisma, emp.designation, branchesID));

  const effectFrom = emp.joiningDate ?? new Date().toISOString().slice(0, 10);

  const created = await prisma.$transaction(async (tx) => {
    const employee = await tx.manageEmployee.create({
      data: {
        serviceProviderID: emp.serviceProviderID ?? undefined,
        companyID,
        branchesID: branchesID ?? undefined,
        employeeFirstName: emp.employeeFirstName ?? undefined,
        employeeLastName: emp.employeeLastName ?? undefined,
        employeeID: emp.employeeID ?? undefined,
        joiningDate: emp.joiningDate ?? undefined,
        businessPhoneNo: emp.businessPhoneNo ?? undefined,
        businessEmail: emp.businessEmail ?? undefined,
        personalPhoneNo: emp.personalPhoneNo ?? undefined,
        personalEmail: emp.personalEmail ?? undefined,
        emergancyContact: emp.emergancyContact ?? undefined,
        presentAddress: emp.presentAddress ?? undefined,
        permenantAddress: emp.permenantAddress ?? undefined,
        gender: emp.gender ?? undefined,
        numberOfChildren: emp.numberOfChildren ?? undefined,
        dateOfBirth: emp.dateOfBirth ?? undefined,
        bloodGroup: emp.bloodGroup ?? undefined,
        maritalStatus: emp.maritalStatus ?? undefined,
        employeeFatherName: emp.employeeFatherName ?? undefined,
        employeeMotherName: emp.employeeMotherName ?? undefined,
        employeeSpouseName: emp.employeeSpouseName ?? undefined,
        aadharNo: emp.aadharNo ?? undefined,
        panNo: emp.panNo ?? undefined,
        uanNo: emp.uanNo ?? undefined,
        esiNo: emp.esiNo ?? undefined,
        pfMemberStatus: emp.pfMemberStatus ?? undefined,
        pfNumber: emp.pfNumber ?? undefined,
        departmentNameID: departmentNameID ?? undefined,
        designationID: designationID ?? undefined,
        employmentType: emp.employmentType ?? undefined,
        employmentStatus: emp.employmentStatus ?? undefined,
        probationPeriod: emp.probationPeriod ?? undefined,
        workShiftID: emp.workShiftID ?? undefined,
        attendancePolicyID: emp.attendancePolicyID ?? undefined,
        leavePolicyID: emp.leavePolicyID ?? undefined,
        salaryPayGradeType: emp.salaryPayGradeType ?? undefined,
        monthlyPayGradeID: emp.monthlyPayGradeID ?? undefined,
        hourlyPayGradeID: emp.hourlyPayGradeID ?? undefined,
        typeOfEmployee: emp.typeOfEmployee ?? undefined,
        empType: emp.employmentType ?? undefined,
        lifecycleStatus: 'ACTIVE',
        ...(emp.bankDetails?.length
          ? {
              employeeBankDetails: {
                create: emp.bankDetails.map((b) => ({
                  bankName: b.bankName ?? null,
                  bankBranchName: b.bankBranchName ?? null,
                  accNumber: normalizeNumericId(b.accNumber) ?? null,
                  ifscCode: b.ifscCode ?? null,
                  upi: b.upi ?? null,
                })),
              },
            }
          : {}),
        ...(departmentNameID
          ? {
              empDepartment: {
                create: [{ departmentNameID, effectFrom }],
              },
            }
          : {}),
        ...(designationID
          ? {
              empDesignation: {
                create: [{ designationID, effectFrom }],
              },
            }
          : {}),
        ...(branchesID
          ? {
              empBranch: {
                create: [{ branchesID, effectFrom }],
              },
            }
          : {}),
        ...(emp.employmentType
          ? {
              empEmploymentType: {
                create: [{ employmentType: emp.employmentType, effectFrom }],
              },
            }
          : {}),
        ...(emp.employmentStatus
          ? {
              empEmploymentStatus: {
                create: [
                  {
                    employmentStatus: emp.employmentStatus,
                    probationPeriod: emp.probationPeriod ?? null,
                    effectFrom,
                  },
                ],
              },
            }
          : {}),
        ...(emp.workShiftID
          ? {
              empWorkShift: {
                create: [{ workShiftID: emp.workShiftID, effectFrom }],
              },
            }
          : {}),
        ...(emp.attendancePolicyID
          ? {
              empAttendancePolicy: {
                create: [{ attendancePolicyID: emp.attendancePolicyID, effectFrom }],
              },
            }
          : {}),
        ...(emp.leavePolicyID
          ? {
              empLeavePolicy: {
                create: [{ leavePolicyID: emp.leavePolicyID, effectFrom }],
              },
            }
          : {}),
      },
    });

    if (emp.employeeID && emp.personalPhoneNo) {
      const hashed = await bcrypt.hash(emp.personalPhoneNo, SALT_ROUNDS);
      await tx.employeeCredentials.create({
        data: {
          employeeID: employee.id,
          username: emp.employeeID,
          password: hashed,
          isActive: true,
          serviceProviderID: emp.serviceProviderID ?? undefined,
          companyID,
          branchesID: branchesID ?? undefined,
        },
      });
    }

    return employee;
  });

  return created.id;
}

async function main() {
  const { file, dryRun, replaceExisting } = parseArgs();
  const payload = loadImportFile(file);
  const defaults = loadDefaults(payload.defaults);

  if (!defaults.companyID) {
    throw new Error('companyID is required in import.defaults.json or file defaults');
  }

  const prisma = new PrismaClient();
  const report: Report = {
    runAt: new Date().toISOString(),
    sourceFile: file,
    dryRun,
    replaceExisting,
    totalRows: payload.employees.length,
    imported: [],
    replaced: [],
    skipped: [],
    failed: [],
  };

  console.log(`Import file: ${file}`);
  console.log(
    `Rows: ${payload.employees.length}${dryRun ? ' (dry-run)' : ''}${replaceExisting ? ' (replace existing)' : ''}`,
  );

  for (let i = 0; i < payload.employees.length; i++) {
    const row = payload.employees[i];
    try {
      const emp = normalizeRow(row, defaults);

      if (!emp.employeeID) {
        report.skipped.push({
          reason: `Row ${i + 1}: missing employee code`,
        });
        continue;
      }

      if (!emp.employeeFirstName) {
        report.skipped.push({
          employeeID: emp.employeeID,
          reason: `Row ${i + 1}: missing first name`,
        });
        continue;
      }

      const dup = await findDuplicate(
        prisma,
        defaults.companyID!,
        emp.employeeID,
        emp.businessEmail,
        emp.personalEmail,
      );

      if (dup && !replaceExisting) {
        report.skipped.push({
          employeeID: emp.employeeID,
          email: emp.businessEmail ?? emp.personalEmail,
          reason: 'Duplicate employee (use --replace to overwrite)',
        });
        continue;
      }

      const displayName = `${emp.employeeFirstName} ${emp.employeeLastName ?? ''}`.trim();

      if (dryRun) {
        if (dup) {
          report.replaced.push({
            employeeID: emp.employeeID,
            oldId: dup.id,
            newId: 0,
            name: displayName,
          });
        } else {
          report.imported.push({
            employeeID: emp.employeeID,
            id: 0,
            name: displayName,
          });
        }
        continue;
      }

      if (dup) {
        await deleteExistingEmployee(prisma, dup.id);
      }

      const id = await createEmployee(prisma, emp);
      if (dup) {
        report.replaced.push({
          employeeID: emp.employeeID,
          oldId: dup.id,
          newId: id,
          name: displayName,
        });
      } else {
        report.imported.push({
          employeeID: emp.employeeID,
          id,
          name: displayName,
        });
      }
    } catch (e) {
      report.failed.push({
        employeeID: asString((row as RawEmployeeRow).employeeID ?? pickAlias(row, 'employeeID')),
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const reportPath = path.resolve(
    __dirname,
    '../../scripts/import/import-report.json',
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n--- Import summary ---');
  console.log(`Imported:  ${report.imported.length}`);
  console.log(`Replaced: ${report.replaced.length}`);
  console.log(`Skipped:   ${report.skipped.length}`);
  console.log(`Failed:    ${report.failed.length}`);
  console.log(`Report:    ${reportPath}`);

  await prisma.$disconnect();
  if (nestContext) await nestContext.close();

  if (report.failed.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
