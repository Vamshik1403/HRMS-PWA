import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto, PrimaryContactDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import {
  CreateCompanyOwnerDto,
  OwnerModulePermissionDto,
} from './dto/create-company-owner.dto';
import {
  COMPANY_MODULE_KEYS,
  fullOwnerPermissions,
  ownerTitleForLegalEntity,
  type ModulePermissionDto,
} from '../common/company-module-permissions';
import { loadEmployeePermissions } from '../common/employee-permission.util';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  private digitsOnly(value?: string | null): string {
    return String(value || '').replace(/\D/g, '');
  }

  private normalizeEmail(value?: string | null): string {
    return String(value || '').trim().toLowerCase();
  }

  private normalizeUsername(value?: string | null): string {
    return String(value || '').trim().toLowerCase();
  }

  async isUsernameAvailable(username?: string, excludeOwnerId?: number) {
    const normalized = this.normalizeUsername(username);
    if (!normalized) {
      return { available: false, message: 'Username is required' };
    }

    const existingCred = await this.prisma.employeeCredentials.findFirst({
      where: {
        username: { equals: normalized, mode: 'insensitive' },
        ...(excludeOwnerId
          ? { employeeID: { not: excludeOwnerId } }
          : {}),
      },
      select: { id: true },
    });
    if (existingCred) {
      return { available: false, message: 'Username already exists' };
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { username: { equals: normalized, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existingUser) {
      return { available: false, message: 'Username already exists' };
    }

    return { available: true };
  }

  private async assertEmailAvailable(email: string, excludeEmployeeId?: number) {
    const existing = await this.prisma.manageEmployee.findFirst({
      where: {
        isDeleted: false,
        ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
        OR: [
          { businessEmail: { equals: email, mode: 'insensitive' } },
          { personalEmail: { equals: email, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Email already exists');
    }
  }

  private employeeInitialPassword(personalPhoneNo?: string | null): string {
    return this.digitsOnly(personalPhoneNo) || String(personalPhoneNo || '').trim();
  }

  async create(data: CreateCompanyDto) {
    const { primaryContacts, ...companyData } = data;
    const company = await this.prisma.company.create({ data: companyData as any });
    await this.processPrimaryContacts(company.id, primaryContacts);
    return company;
  }

  async listOwners(companyId?: number) {
    return this.prisma.manageEmployee.findMany({
      where: {
        isCompanyOwner: true,
        isDeleted: false,
        ...(companyId ? { companyID: companyId } : {}),
      },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        businessEmail: true,
        personalEmail: true,
        personalPhoneNo: true,
        businessPhoneNo: true,
        salutation: true,
        isCompanyOwner: true,
        ownerTitle: true,
        companyID: true,
        serviceProviderID: true,
        company: { select: { id: true, companyName: true, legalEntityType: true } },
        employeeCredentials: {
          select: {
            id: true,
            username: true,
            isActive: true,
            mustChangePassword: true,
            createdAt: true,
          },
        },
      },
      take: 500,
    });
  }

  /**
   * Employee ID prefix from the company name: first word of the company
   * name, up to 3 characters (e.g. "Electrohelps Pvt Ltd" -> "Ele",
   * "3s Infocom" -> "3s" since the first word is only 2 characters long).
   */
  private employeeIdPrefixFromCompanyName(companyName?: string | null): string {
    const firstWord = (companyName || '').trim().split(/\s+/)[0] || 'EMP';
    return firstWord.slice(0, 3);
  }

  private async generateNextEmployeeCode(
    companyId: number,
    companyName?: string | null,
  ): Promise<string> {
    const prefix = this.employeeIdPrefixFromCompanyName(companyName);

    const existing = await this.prisma.manageEmployee.findMany({
      where: {
        companyID: companyId,
        employeeID: { startsWith: prefix },
      },
      select: { employeeID: true },
    });

    let maxSeq = 0;
    for (const row of existing) {
      const match = String(row.employeeID || '').slice(prefix.length).match(/^\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }

    return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
  }

  private async persistModulePermissions(
    tx: any,
    companyId: number,
    manageEmployeeId: number,
    permissions: ModulePermissionDto[],
  ) {
    const allowed = new Set(COMPANY_MODULE_KEYS as readonly string[]);
    for (const row of permissions) {
      if (!allowed.has(row.moduleKey)) continue;
      await tx.employeeModulePermission.upsert({
        where: {
          companyID_manageEmployeeID_moduleKey: {
            companyID: companyId,
            manageEmployeeID: manageEmployeeId,
            moduleKey: row.moduleKey,
          },
        },
        create: {
          companyID: companyId,
          manageEmployeeID: manageEmployeeId,
          moduleKey: row.moduleKey,
          canView: !!row.canView,
          canCreate: !!row.canCreate,
          canEdit: !!row.canEdit,
          canDelete: !!row.canDelete,
        },
        update: {
          canView: !!row.canView,
          canCreate: !!row.canCreate,
          canEdit: !!row.canEdit,
          canDelete: !!row.canDelete,
        },
      });
    }
  }

  private mapPermissionRows(
    rows?: OwnerModulePermissionDto[],
  ): ModulePermissionDto[] {
    if (!Array.isArray(rows) || rows.length === 0) return fullOwnerPermissions();
    const byKey = new Map(rows.map((r) => [r.moduleKey, r]));
    return COMPANY_MODULE_KEYS.map((moduleKey) => {
      const row = byKey.get(moduleKey);
      return {
        moduleKey,
        canView: !!row?.canView,
        canCreate: !!row?.canCreate,
        canEdit: !!row?.canEdit,
        canDelete: !!row?.canDelete,
      };
    });
  }

  async processPrimaryContacts(
    companyId: number,
    contacts?: PrimaryContactDto[],
  ) {
    if (!Array.isArray(contacts) || contacts.length === 0) return;

    for (const contact of contacts) {
      const email = this.normalizeEmail(contact.email);
      const mobile = String(contact.mobile || '').trim();
      const firstName = String(contact.firstName || '').trim();
      const lastName = String(contact.lastName || '').trim();
      const username = String(contact.username || '').trim();
      const phone = String(contact.phone || '').trim();
      const designation = String(contact.designation || '').trim();
      const title = String(contact.title || '').trim();

      const isFilled = !!(email || mobile || firstName || lastName || username);
      if (!isFilled) continue;
      if (!email || !mobile) {
        throw new BadRequestException(
          'Each filled primary contact requires email and mobile',
        );
      }

      await this.createOwner(companyId, {
        firstName: firstName || email,
        lastName: lastName || undefined,
        username: username || email,
        businessEmail: email,
        personalPhoneNo: mobile,
        businessPhoneNo: phone || undefined,
        salutation: title || undefined,
        ownerTitle: designation || undefined,
        isCompanyOwner: !!contact.setAsCompanyAdmin,
      });
    }
  }

  async createOwner(companyId: number, dto: CreateCompanyOwnerDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        companyName: true,
        legalEntityType: true,
        defaultOwnerTitle: true,
        serviceProviderID: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');

    const email = this.normalizeEmail(dto.businessEmail);
    const mobile = String(dto.personalPhoneNo || '').trim();
    if (!email) throw new BadRequestException('Email is required');
    if (!mobile) throw new BadRequestException('Mobile is required');

    const username = this.normalizeUsername(dto.username) || email;
    await this.assertEmailAvailable(email);
    const existingCred = await this.prisma.employeeCredentials.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
    });
    if (existingCred) throw new ConflictException('Username already exists');

    const existingUser = await this.prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
    });
    if (existingUser) throw new ConflictException('Username already exists');

    const isCompanyOwner = dto.isCompanyOwner !== false;
    const ownerTitle =
      (dto.ownerTitle || '').trim() ||
      (company.defaultOwnerTitle || '').trim() ||
      ownerTitleForLegalEntity(company.legalEntityType);
    const employeeCode =
      (dto.employeeCode || '').trim() ||
      (await this.generateNextEmployeeCode(companyId, company.companyName));

    const codeTaken = await this.prisma.manageEmployee.findFirst({
      where: {
        companyID: companyId,
        employeeID: employeeCode,
        isDeleted: false,
      },
    });
    if (codeTaken) {
      throw new ConflictException('Employee code already exists for this company');
    }

    const defaultBranch = await this.prisma.branches.findFirst({
      where: { companyID: companyId },
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    const plainPassword =
      (dto.password || '').trim() || this.employeeInitialPassword(mobile);
    if (!plainPassword || plainPassword.length < 6) {
      throw new BadRequestException(
        'Mobile number must have at least 6 digits to use as the initial password',
      );
    }

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(plainPassword, saltRounds);
    const joiningDate =
      dto.joiningDate?.trim() ||
      new Date().toISOString().slice(0, 10);
    const permissions = isCompanyOwner
      ? this.mapPermissionRows(dto.permissions)
      : [];

    const created = await this.prisma.$transaction(async (tx) => {
      let designationId: number | null = null;
      if (ownerTitle) {
        const existingDesg = await tx.designations.findFirst({
          where: {
            companyID: company.id,
            designation: { equals: ownerTitle, mode: 'insensitive' },
          },
          select: { id: true },
        });
        if (existingDesg) {
          designationId = existingDesg.id;
        } else {
          const createdDesg = await tx.designations.create({
            data: {
              designation: ownerTitle,
              companyID: company.id,
              serviceProviderID: company.serviceProviderID ?? null,
              branchesID: defaultBranch?.id ?? null,
              isManager: isCompanyOwner,
            },
            select: { id: true },
          });
          designationId = createdDesg.id;
        }
      }

      const employee = await tx.manageEmployee.create({
        data: {
          employeeID: employeeCode,
          employeeFirstName: dto.firstName.trim(),
          employeeLastName: (dto.lastName || '').trim() || null,
          salutation: dto.salutation?.trim() || null,
          personalPhoneNo: mobile,
          businessPhoneNo: dto.businessPhoneNo?.trim() || null,
          businessEmail: email,
          personalEmail: email,
          joiningDate,
          companyID: company.id,
          serviceProviderID: company.serviceProviderID,
          branchesID: defaultBranch?.id ?? null,
          designationID: designationId,
          isCompanyOwner,
          ownerTitle,
          employmentStatus: 'Active',
          onboardingApprovalStatus: 'APPROVED',
          lifecycleStatus: 'ACTIVE',
        },
      });

      if (designationId) {
        await tx.empDesignation.create({
          data: {
            manageEmployeeID: employee.id,
            designationID: designationId,
            effectFrom: joiningDate,
          },
        });
      }

      await tx.employeeCredentials.create({
        data: {
          employeeID: employee.id,
          username,
          password: passwordHash,
          mustChangePassword: true,
          requireLoginOtp: isCompanyOwner,
          isActive: true,
          serviceProviderID: company.serviceProviderID ?? undefined,
          companyID: company.id,
          branchesID: defaultBranch?.id ?? undefined,
        },
      });

      if (isCompanyOwner && permissions.length) {
        await this.persistModulePermissions(tx, company.id, employee.id, permissions);
      }

      return tx.manageEmployee.findUnique({
        where: { id: employee.id },
        include: {
          company: {
            select: { id: true, companyName: true, legalEntityType: true },
          },
          designations: {
            select: { id: true, designation: true },
          },
          employeeCredentials: {
            select: {
              id: true,
              username: true,
              isActive: true,
              mustChangePassword: true,
              requireLoginOtp: true,
              createdAt: true,
            },
          },
        },
      });
    });

    return {
      ...created,
      ownerTitle,
      roleLabel: ownerTitle,
      message: isCompanyOwner
        ? `Company admin (${ownerTitle}) created. Login with username.`
        : 'Employee login created. Login with username.',
    };
  }

  async updateOwner(
    companyId: number,
    manageEmployeeId: number,
    dto: Partial<CreateCompanyOwnerDto> & { isActive?: boolean },
  ) {
    const owner = await this.prisma.manageEmployee.findFirst({
      where: {
        id: manageEmployeeId,
        companyID: companyId,
        isCompanyOwner: true,
        isDeleted: false,
      },
      include: { employeeCredentials: true },
    });
    if (!owner) throw new NotFoundException('Company owner not found');

    if (dto.businessEmail !== undefined && !this.normalizeEmail(dto.businessEmail)) {
      throw new BadRequestException('Email is required');
    }
    if (dto.personalPhoneNo !== undefined && !String(dto.personalPhoneNo || '').trim()) {
      throw new BadRequestException('Mobile is required');
    }

    if (dto.businessEmail !== undefined) {
      await this.assertEmailAvailable(
        this.normalizeEmail(dto.businessEmail),
        owner.id,
      );
    }

    const nextUsername =
      dto.username !== undefined
        ? this.normalizeUsername(dto.username)
        : undefined;

    if (nextUsername) {
      const taken = await this.prisma.employeeCredentials.findFirst({
        where: {
          username: { equals: nextUsername, mode: 'insensitive' },
          employeeID: { not: owner.id },
        },
      });
      if (taken) throw new ConflictException('Username already exists');

      const takenUser = await this.prisma.user.findFirst({
        where: { username: { equals: nextUsername, mode: 'insensitive' } },
        select: { id: true },
      });
      if (takenUser) throw new ConflictException('Username already exists');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.manageEmployee.update({
        where: { id: owner.id },
        data: {
          employeeFirstName: dto.firstName?.trim() ?? undefined,
          employeeLastName:
            dto.lastName !== undefined ? dto.lastName.trim() || null : undefined,
          salutation:
            dto.salutation !== undefined ? dto.salutation.trim() || null : undefined,
          personalPhoneNo:
            dto.personalPhoneNo !== undefined
              ? dto.personalPhoneNo.trim() || null
              : undefined,
          businessPhoneNo:
            dto.businessPhoneNo !== undefined
              ? dto.businessPhoneNo.trim() || null
              : undefined,
          businessEmail:
            dto.businessEmail !== undefined
              ? this.normalizeEmail(dto.businessEmail) || null
              : undefined,
          personalEmail:
            dto.businessEmail !== undefined
              ? this.normalizeEmail(dto.businessEmail) || null
              : undefined,
          ownerTitle:
            dto.ownerTitle !== undefined
              ? dto.ownerTitle.trim() || null
              : undefined,
        },
      });

      if (owner.employeeCredentials) {
        const credUpdate: any = {};
        if (nextUsername) credUpdate.username = nextUsername;
        if (dto.password) {
          const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
          credUpdate.password = await bcrypt.hash(dto.password, saltRounds);
          credUpdate.mustChangePassword = false;
        }
        if (dto.isActive !== undefined) credUpdate.isActive = dto.isActive;
        credUpdate.requireLoginOtp = true;
        if (Object.keys(credUpdate).length > 0) {
          await tx.employeeCredentials.update({
            where: { employeeID: owner.id },
            data: credUpdate,
          });
        }
      }

      if (dto.permissions) {
        await this.persistModulePermissions(
          tx,
          companyId,
          owner.id,
          this.mapPermissionRows(dto.permissions),
        );
      }
    });

    return this.prisma.manageEmployee.findUnique({
      where: { id: owner.id },
      include: {
        company: { select: { id: true, companyName: true, legalEntityType: true } },
        employeeCredentials: {
          select: {
            id: true,
            username: true,
            isActive: true,
            mustChangePassword: true,
            requireLoginOtp: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async getOwnerPermissions(companyId: number, ownerId: number) {
    const owner = await this.prisma.manageEmployee.findFirst({
      where: {
        id: ownerId,
        companyID: companyId,
        isCompanyOwner: true,
        isDeleted: false,
      },
      select: {
        id: true,
        employeeFirstName: true,
        employeeLastName: true,
        isCompanyOwner: true,
        ownerTitle: true,
      },
    });
    if (!owner) throw new NotFoundException('Company owner not found');

    const permissions = await loadEmployeePermissions(
      this.prisma,
      owner.id,
      companyId,
      true,
    );

    return {
      employee: {
        id: owner.id,
        name: `${owner.employeeFirstName ?? ''} ${owner.employeeLastName ?? ''}`.trim(),
        isCompanyOwner: true,
        ownerTitle: owner.ownerTitle,
      },
      permissions,
      readOnly: false,
    };
  }

  async saveOwnerPermissions(
    companyId: number,
    ownerId: number,
    permissions: OwnerModulePermissionDto[],
  ) {
    const owner = await this.prisma.manageEmployee.findFirst({
      where: {
        id: ownerId,
        companyID: companyId,
        isCompanyOwner: true,
        isDeleted: false,
      },
      select: { id: true },
    });
    if (!owner) throw new NotFoundException('Company owner not found');

    await this.prisma.$transaction(async (tx) => {
      await this.persistModulePermissions(
        tx,
        companyId,
        owner.id,
        this.mapPermissionRows(permissions),
      );
    });

    return this.getOwnerPermissions(companyId, ownerId);
  }

  async deactivateOwner(companyId: number, manageEmployeeId: number) {
    const owner = await this.prisma.manageEmployee.findFirst({
      where: {
        id: manageEmployeeId,
        companyID: companyId,
        isCompanyOwner: true,
        isDeleted: false,
      },
    });
    if (!owner) throw new NotFoundException('Company owner not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.employeeCredentials.updateMany({
        where: { employeeID: owner.id },
        data: { isActive: false },
      });
      await tx.manageEmployee.update({
        where: { id: owner.id },
        data: { isDeleted: true },
      });
    });

    return { message: 'Company owner deactivated' };
  }

  async migrateCompanyAdminToOwner(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== 'COMPANY_ADMIN') {
      throw new BadRequestException('User is not a COMPANY_ADMIN');
    }
    if (!user.companyID) {
      throw new BadRequestException('COMPANY_ADMIN has no company assigned');
    }

    const existingOwner = await this.prisma.manageEmployee.findFirst({
      where: {
        companyID: user.companyID,
        isCompanyOwner: true,
        isDeleted: false,
      },
    });
    if (existingOwner) {
      throw new ConflictException('Company already has an owner employee');
    }

    if (!user.email?.trim() || !user.contactNo?.trim()) {
      throw new BadRequestException(
        'COMPANY_ADMIN must have email and contact number to migrate',
      );
    }

    const usernameBase = user.username;
    let username = usernameBase;
    let suffix = 1;
    while (await this.prisma.employeeCredentials.findUnique({ where: { username } })) {
      username = `${usernameBase}-${suffix++}`;
    }

    const password = `Owner${user.companyID}${Date.now().toString().slice(-4)}!`;
    const owner = await this.createOwner(user.companyID, {
      firstName: user.firstName || user.username,
      lastName: user.lastName || undefined,
      username,
      password,
      personalPhoneNo: user.contactNo,
      businessEmail: user.email,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });

    return {
      owner,
      temporaryPassword: password,
      message:
        'Migrated COMPANY_ADMIN to company owner employee. Legacy system user deactivated.',
    };
  }

  async findAll() {
    return this.prisma.company.findMany({
      include: {
        serviceProvider: true,
        companyModules: {
          include: {
            module: true,
          },
        },
        subscriptions: {
          where: { isActive: true },
          orderBy: { startDate: 'desc' },
          take: 1,
          include: {
            plan: { select: { planName: true } },
          },
        },
      },
    });
  }

  async findOne(id: number) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        serviceProvider: true,
        companyModules: {
          include: {
            module: true,
          },
          orderBy: {
            module: {
              sortOrder: 'asc',
            },
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }

    return {
      ...company,
      modules: company.companyModules.map((row) => ({
        companyID: row.companyID,
        moduleID: row.moduleID,
        moduleKey: row.module.moduleKey,
        moduleName: row.module.moduleName,
        isEnabled: row.isEnabled,
      })),
    };
  }

  async getAllModules() {
    return this.prisma.module.findMany({
      orderBy: {
        sortOrder: 'asc',
      },
    });
  }

  async seedDefaultModules() {
    const modules = [
      { moduleKey: 'ATTENDANCE_MODULE', moduleName: 'Attendance', sortOrder: 1 },
      { moduleKey: 'ATTENDANCE_HISTORY_MODULE', moduleName: 'Attendance History', sortOrder: 2 },
      { moduleKey: 'WORKSHIFT_ROSTER_MODULE', moduleName: 'WorkShift & Roster', sortOrder: 3 },
      { moduleKey: 'GEO_MARKING_MODULE', moduleName: 'Geo Marking', sortOrder: 4 },
      { moduleKey: 'GEO_FENCING_MODULE', moduleName: 'Geo Fencing', sortOrder: 5 },
      { moduleKey: 'PAYROLL_MODULE', moduleName: 'Payroll', sortOrder: 6 },
      { moduleKey: 'OFF_BOARDING_MODULE', moduleName: 'Off Boarding', sortOrder: 7 },
      { moduleKey: 'REIMBURSEMENT_MODULE', moduleName: 'Reimbursement', sortOrder: 8 },
      { moduleKey: 'IM_MODULE', moduleName: 'Instant Messaging', sortOrder: 9 },
      { moduleKey: 'TASK_MODULE', moduleName: 'Task Management', sortOrder: 10 },
      { moduleKey: 'ONFIELD_TASK_MODULE', moduleName: 'On-Field Task Management', sortOrder: 11 },
      { moduleKey: 'CONTRACTOR_MODULE', moduleName: 'Contractor Management', sortOrder: 12 },
      { moduleKey: 'ADVANCE_REPORTING_MODULE', moduleName: 'Advance Reporting', sortOrder: 13 },
    ];

    for (const item of modules) {
      await this.prisma.module.upsert({
        where: {
          moduleKey: item.moduleKey,
        },
        update: {
          moduleName: item.moduleName,
          sortOrder: item.sortOrder,
        },
        create: {
          ...item,
          isActive: false,
        },
      });
    }

    return this.getAllModules();
  }

  async getCompanyModules(companyID: number) {
    const allModules = await this.prisma.module.findMany({
      orderBy: {
        sortOrder: 'asc',
      },
    });

    const companyModules = await this.prisma.companyModule.findMany({
      where: {
        companyID,
      },
    });

    return allModules.map((module) => {
      const companyModule = companyModules.find(
        (cm) => cm.moduleID === module.id,
      );

      return {
        companyID,
        moduleID: module.id,
        moduleKey: module.moduleKey,
        moduleName: module.moduleName,
        moduleIsActive: module.isActive,
        isEnabled: companyModule?.isEnabled ?? false,
      };
    });
  }

  async updateCompanyModules(
    companyID: number,
    modules: { moduleID: number; isEnabled: boolean }[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      for (const item of modules) {
        await tx.companyModule.upsert({
          where: {
            companyID_moduleID: {
              companyID,
              moduleID: Number(item.moduleID),
            },
          },
          update: {
            isEnabled: item.isEnabled,
          },
          create: {
            companyID,
            moduleID: Number(item.moduleID),
            isEnabled: item.isEnabled,
          },
        });
      }

      const rows = await tx.companyModule.findMany({
        where: {
          companyID,
        },
        include: {
          module: true,
        },
        orderBy: {
          module: {
            sortOrder: 'asc',
          },
        },
      });

      return rows.map((row) => ({
        id: row.id,
        companyID: row.companyID,
        moduleID: row.moduleID,
        moduleKey: row.module.moduleKey,
        moduleName: row.module.moduleName,
        moduleIsActive: row.module.isActive,
        isEnabled: row.isEnabled,
      }));
    });
  }

  async update(id: number, data: UpdateCompanyDto) {
    const { primaryContacts, ...companyData } = data as UpdateCompanyDto;
    const company = await this.prisma.company.update({
      where: { id },
      data: companyData as any,
    });
    await this.processPrimaryContacts(id, primaryContacts);
    return company;
  }

  async remove(id: number) {
    const companyId = Number(id);
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    try {
      await this.prisma.$executeRawUnsafe(
        `
        DO $del$
        DECLARE
          r RECORD;
          cid int := ${companyId};
        BEGIN
          FOR r IN
            SELECT c.conrelid::regclass AS tbl, a.attname AS col
            FROM pg_constraint c
            JOIN pg_attribute a
              ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
            WHERE c.confrelid = '"Company"'::regclass
              AND c.contype = 'f'
              AND a.attnotnull = false
          LOOP
            EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = %s', r.tbl, r.col, r.col, cid);
          END LOOP;

          FOR r IN
            SELECT c.conrelid::regclass AS tbl, a.attname AS col
            FROM pg_constraint c
            JOIN pg_attribute a
              ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
            WHERE c.confrelid = '"Company"'::regclass
              AND c.contype = 'f'
              AND a.attnotnull = true
              AND c.conrelid::regclass::text <> '"Company"'
          LOOP
            EXECUTE format('DELETE FROM %s WHERE %I = %s', r.tbl, r.col, cid);
          END LOOP;

          DELETE FROM "Company" WHERE id = cid;
        END
        $del$;
        `,
      );

      return { message: `Company with ID ${companyId} deleted successfully` };
    } catch (error: any) {
      console.error('Company delete failed:', error);
      throw new BadRequestException(
        error?.message ||
          'Cannot delete company while related records still reference it.',
      );
    }
  }
}