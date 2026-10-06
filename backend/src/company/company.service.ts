import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
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
import {
  entitledRightsKeys,
  limitPermissionsToPlan,
  loadEmployeePermissions,
} from '../common/employee-permission.util';
import { PRODUCT_MODULE_CATALOG } from '../common/product-modules';
import {
  getMutuallyLinkedCompanyIds,
  normalizeFederalDomainCode,
} from './federal-domain.util';
import { assertPasswordMeetsPolicy } from '../auth/password-policy';

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

  private liveEmployeeScope(excludeEmployeeId?: number) {
    return {
      isDeleted: false,
      companyID: { not: null },
      ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
    };
  }

  private activeUsernameUserWhere(normalized: string) {
    return {
      username: { equals: normalized, mode: 'insensitive' as const },
      OR: [
        { role: { not: UserRole.COMPANY_ADMIN } },
        { companyID: { not: null } },
      ],
    };
  }

  private rethrowAsHttp(err: any): never {
    if (err instanceof HttpException) throw err;
    if (err?.code === 'P2002') {
      const target = Array.isArray(err.meta?.target)
        ? err.meta.target.join(' ')
        : String(err.meta?.target || '');
      if (/email/i.test(target)) {
        throw new ConflictException('Email already exists');
      }
      if (/username/i.test(target)) {
        throw new ConflictException('Username already exists');
      }
      if (/phone|mobile|contact/i.test(target)) {
        throw new ConflictException('Mobile number already exists');
      }
      if (/gst/i.test(target)) {
        throw new ConflictException('GST number already exists');
      }
      if (/pan/i.test(target)) {
        throw new ConflictException('PAN already exists');
      }
      if (/companyName|company_name/i.test(target)) {
        throw new ConflictException('Company name already exists');
      }
      throw new ConflictException('A record with these details already exists');
    }
    throw err;
  }

  /** Frees email/username/mobile held by deleted or orphaned tenant logins. */
  private async releaseStaleLoginUniques() {
    const stale = await this.prisma.manageEmployee.findMany({
      where: {
        OR: [
          { isDeleted: true },
          { isCompanyOwner: true, companyID: null },
        ],
      },
      select: { id: true },
    });
    const ids = stale.map((row) => row.id);
    if (ids.length === 0) return;

    await this.prisma.employeeCredentials.deleteMany({
      where: { employeeID: { in: ids } },
    });
    await this.prisma.manageEmployee.updateMany({
      where: { id: { in: ids } },
      data: {
        isDeleted: true,
        businessEmail: null,
        personalEmail: null,
        personalPhoneNo: null,
        businessPhoneNo: null,
      },
    });
  }

  async isUsernameAvailable(username?: string, excludeOwnerId?: number) {
    const normalized = this.normalizeUsername(username);
    if (!normalized) {
      return { available: false, message: 'Username is required' };
    }

    const existingCred = await this.prisma.employeeCredentials.findFirst({
      where: {
        username: { equals: normalized, mode: 'insensitive' },
        employee: this.liveEmployeeScope(excludeOwnerId),
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
      where: this.activeUsernameUserWhere(normalized),
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
        ...this.liveEmployeeScope(excludeEmployeeId),
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

  private async assertMobileAvailable(mobile: string, excludeEmployeeId?: number) {
    const digits = this.digitsOnly(mobile);
    const trimmed = String(mobile || '').trim();
    if (!digits && !trimmed) return;

    const candidates = await this.prisma.manageEmployee.findMany({
      where: {
        ...this.liveEmployeeScope(excludeEmployeeId),
        OR: [
          ...(trimmed ? [{ personalPhoneNo: trimmed }, { businessPhoneNo: trimmed }] : []),
          ...(digits
            ? [
                { personalPhoneNo: { contains: digits } },
                { businessPhoneNo: { contains: digits } },
              ]
            : []),
        ],
      },
      select: { id: true, personalPhoneNo: true, businessPhoneNo: true },
      take: 50,
    });
    const taken = candidates.some((row) => {
      const personal = this.digitsOnly(row.personalPhoneNo);
      const business = this.digitsOnly(row.businessPhoneNo);
      return (
        (digits && (personal === digits || business === digits)) ||
        String(row.personalPhoneNo || '').trim() === trimmed ||
        String(row.businessPhoneNo || '').trim() === trimmed
      );
    });
    if (taken) {
      throw new ConflictException('Mobile number already exists');
    }
  }

  private async assertPrimaryContactsAvailable(contacts?: PrimaryContactDto[]) {
    if (!Array.isArray(contacts) || contacts.length === 0) return;

    const seenEmails = new Set<string>();
    const seenUsernames = new Set<string>();
    const seenMobiles = new Set<string>();

    for (const contact of contacts) {
      const email = this.normalizeEmail(contact.email);
      const mobile = String(contact.mobile || '').trim();
      const username = this.normalizeUsername(contact.username) || email;
      const firstName = String(contact.firstName || '').trim();
      const lastName = String(contact.lastName || '').trim();
      const isFilled = !!(email || mobile || firstName || lastName || username);
      if (!isFilled) continue;
      if (!email || !mobile) {
        throw new BadRequestException(
          'Each filled primary contact requires email and mobile',
        );
      }
      if (seenEmails.has(email)) {
        throw new ConflictException('Duplicate email in primary contacts');
      }
      if (seenUsernames.has(username)) {
        throw new ConflictException('Duplicate username in primary contacts');
      }
      const mobileKey = this.digitsOnly(mobile) || mobile;
      if (seenMobiles.has(mobileKey)) {
        throw new ConflictException('Duplicate mobile number in primary contacts');
      }
      seenEmails.add(email);
      seenUsernames.add(username);
      seenMobiles.add(mobileKey);

      await this.assertEmailAvailable(email);
      await this.assertMobileAvailable(mobile);
      const available = await this.isUsernameAvailable(username);
      if (!available.available) {
        throw new ConflictException(available.message || 'Username already exists');
      }
    }
  }

  private employeeInitialPassword(personalPhoneNo?: string | null): string {
    return this.digitsOnly(personalPhoneNo) || String(personalPhoneNo || '').trim();
  }

  async create(data: CreateCompanyDto) {
    const { primaryContacts, ...companyData } = data;
    await this.releaseStaleLoginUniques();
    await this.assertPrimaryContactsAvailable(primaryContacts);

    let company;
    try {
      company = await this.prisma.company.create({ data: companyData as any });
    } catch (err) {
      this.rethrowAsHttp(err);
    }
    try {
      await this.processPrimaryContacts(company!.id, primaryContacts);
      return company;
    } catch (err) {
      try {
        await this.remove(company.id);
      } catch (cleanupErr) {
        console.error('Rolled-back tenant cleanup failed:', cleanupErr);
      }
      this.rethrowAsHttp(err);
    }
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

    await this.releaseStaleLoginUniques();

    const username = this.normalizeUsername(dto.username) || email;
    await this.assertEmailAvailable(email);
    await this.assertMobileAvailable(mobile);
    const existingCred = await this.prisma.employeeCredentials.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        employee: this.liveEmployeeScope(),
      },
    });
    if (existingCred) throw new ConflictException('Username already exists');

    const existingUser = await this.prisma.user.findFirst({
      where: this.activeUsernameUserWhere(username),
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

    const chosenPassword = (dto.password || '').trim();
    if (chosenPassword) {
      assertPasswordMeetsPolicy(chosenPassword);
    }
    const plainPassword =
      chosenPassword || this.employeeInitialPassword(mobile);
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
    const entitled = await entitledRightsKeys(this.prisma, companyId);
    const permissions = isCompanyOwner
      ? limitPermissionsToPlan(this.mapPermissionRows(dto.permissions), entitled)
      : [];

    let created;
    try {
      created = await this.prisma.$transaction(async (tx) => {
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
          mustChangePassword: false,
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
    } catch (err) {
      this.rethrowAsHttp(err);
    }

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
          employee: this.liveEmployeeScope(owner.id),
        },
      });
      if (taken) throw new ConflictException('Username already exists');

      const takenUser = await this.prisma.user.findFirst({
        where: this.activeUsernameUserWhere(nextUsername),
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
          assertPasswordMeetsPolicy(dto.password);
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
        const entitled = await entitledRightsKeys(this.prisma, companyId);
        await this.persistModulePermissions(
          tx,
          companyId,
          owner.id,
          limitPermissionsToPlan(this.mapPermissionRows(dto.permissions), entitled),
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

    const entitled = await entitledRightsKeys(this.prisma, companyId);
    await this.prisma.$transaction(async (tx) => {
      await this.persistModulePermissions(
        tx,
        companyId,
        owner.id,
        limitPermissionsToPlan(this.mapPermissionRows(permissions), entitled),
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
    const modules = PRODUCT_MODULE_CATALOG;

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
      await this.releaseStaleLoginUniques();

      const employees = await this.prisma.manageEmployee.findMany({
        where: { companyID: companyId },
        select: { id: true },
      });
      const employeeIds = employees.map((row) => row.id);
      if (employeeIds.length > 0) {
        await this.prisma.employeeCredentials.deleteMany({
          where: { employeeID: { in: employeeIds } },
        });
        await this.prisma.manageEmployee.updateMany({
          where: { id: { in: employeeIds } },
          data: {
            isDeleted: true,
            businessEmail: null,
            personalEmail: null,
            personalPhoneNo: null,
            businessPhoneNo: null,
          },
        });
      }

      const companyUsers = await this.prisma.user.findMany({
        where: { companyID: companyId },
        select: { id: true, username: true, email: true, contactNo: true },
      });
      for (const row of companyUsers) {
        try {
          await this.prisma.user.update({
            where: { id: row.id },
            data: {
              isActive: false,
              companyID: null,
              username: `deleted_${row.id}_${row.username || 'user'}`.slice(0, 180),
              email: row.email
                ? `deleted_${row.id}_${row.email}`.slice(0, 180)
                : `deleted_${row.id}@deleted.local`,
              contactNo: row.contactNo
                ? `deleted_${row.id}_${row.contactNo}`.slice(0, 40)
                : null,
            },
          });
        } catch (userCleanupErr) {
          console.error('Company user unique cleanup failed:', userCleanupErr);
        }
      }

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

  private jwtUserId(user?: {
    sub?: number;
    id?: number;
    employeeId?: number;
    employeeID?: number;
  }): number | undefined {
    const n = Number(user?.sub ?? user?.id);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  private jwtEmployeeId(user?: { employeeId?: number; employeeID?: number }): number | undefined {
    const n = Number(user?.employeeId ?? user?.employeeID);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  private async assertCanManageFederalDomain(
    companyId: number,
    user?: {
      role?: string;
      sub?: number;
      id?: number;
      type?: string;
      companyID?: number;
      employeeId?: number;
      employeeID?: number;
      branchesID?: number;
      serviceProviderID?: number;
    },
  ) {
    if (!user) throw new ForbiddenException('Authentication required');
    const role = String(user.role || '').toUpperCase();
    const isEmployee = role === 'EMPLOYEE' || String(user.type || '').toLowerCase() === 'employee';
    if (role === 'SUPERADMIN' || role === 'SERVICE_PROVIDER') return;

    const target = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, serviceProviderID: true },
    });
    if (!target) throw new NotFoundException('Company not found');

    const tokenCompanyId = Number(user.companyID);
    if (Number.isFinite(tokenCompanyId) && tokenCompanyId === companyId) return;

    const userId = this.jwtUserId(user);
    if (userId) {
      const link = await this.prisma.userCompany.findFirst({
        where: { userID: userId, companyID: companyId },
        select: { id: true },
      });
      if (link) return;
    }

    if (role === 'BRANCH_ADMIN') {
      const branchId = Number(user.branchesID);
      if (Number.isFinite(branchId) && branchId > 0) {
        const branch = await this.prisma.branches.findFirst({
          where: { id: branchId },
          select: { companyID: true },
        });
        if (branch?.companyID === companyId) return;
      }
    }

    if (role === 'COMPANY_ADMIN' || role === 'MULTI_COMPANY_ADMIN' || role === 'ADMIN' || role === 'BRANCH_ADMIN') {
      if (Number.isFinite(tokenCompanyId) && tokenCompanyId > 0) {
        const home = await this.prisma.company.findUnique({
          where: { id: tokenCompanyId },
          select: { serviceProviderID: true },
        });
        if (
          home?.serviceProviderID != null &&
          target.serviceProviderID != null &&
          home.serviceProviderID === target.serviceProviderID
        ) {
          return;
        }
      }
    }

    const employeeId = this.jwtEmployeeId(user) ?? (isEmployee ? this.jwtUserId(user) : undefined);
    if (employeeId) {
      const emp = await this.prisma.manageEmployee.findFirst({
        where: { id: employeeId, isDeleted: false },
        select: {
          id: true,
          companyID: true,
          serviceProviderID: true,
          isCompanyOwner: true,
        },
      });
      if (emp?.companyID === companyId) return;

      if (emp && (emp.isCompanyOwner || isEmployee)) {
        const permissions = await loadEmployeePermissions(
          this.prisma,
          emp.id,
          emp.companyID || companyId,
          !!emp.isCompanyOwner,
        );
        const hasAccess =
          !!emp.isCompanyOwner ||
          permissions.some((p) => p.canView || p.canCreate || p.canEdit || p.canDelete);
        if (hasAccess) {
          const homeSp =
            emp.serviceProviderID ??
            (emp.companyID
              ? (
                  await this.prisma.company.findUnique({
                    where: { id: emp.companyID },
                    select: { serviceProviderID: true },
                  })
                )?.serviceProviderID
              : null);
          const jwtSp = Number(user.serviceProviderID);
          const operatorSp = homeSp ?? (Number.isFinite(jwtSp) ? jwtSp : null);
          if (
            operatorSp != null &&
            target.serviceProviderID != null &&
            operatorSp === target.serviceProviderID
          ) {
            return;
          }
        }
      }
    }

    throw new ForbiddenException('You cannot manage Federal Domain for this company');
  }

  async getFederalDomain(
    companyId: number,
    user?: {
      role?: string;
      sub?: number;
      id?: number;
      companyID?: number;
      employeeId?: number;
      employeeID?: number;
    },
  ) {
    await this.assertCanManageFederalDomain(companyId, user);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, companyName: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    const mine = await this.prisma.companyFederalDomain.findMany({
      where: { companyID: companyId },
      orderBy: { createdAt: 'asc' },
      select: { code: true },
    });
    const myCodes = mine.map((row) => row.code);

    const othersWithSame = myCodes.length
      ? await this.prisma.companyFederalDomain.findMany({
          where: { code: { in: myCodes }, companyID: { not: companyId } },
          select: {
            code: true,
            companyID: true,
            company: { select: { id: true, companyName: true } },
          },
        })
      : [];

    const byCode = new Map<
      string,
      { id: number; companyName: string | null }[]
    >();
    const linkedById = new Map<
      number,
      { id: number; companyName: string | null; sharedCodes: string[] }
    >();
    for (const row of othersWithSame) {
      const peer = {
        id: row.company.id,
        companyName: row.company.companyName ?? null,
      };
      const list = byCode.get(row.code) || [];
      if (!list.some((c) => c.id === peer.id)) list.push(peer);
      byCode.set(row.code, list);

      const existing = linkedById.get(peer.id) || {
        id: peer.id,
        companyName: peer.companyName,
        sharedCodes: [],
      };
      if (!existing.sharedCodes.includes(row.code)) existing.sharedCodes.push(row.code);
      linkedById.set(peer.id, existing);
    }

    const otherCodes = await this.prisma.companyFederalDomain.findMany({
      where: { companyID: { not: companyId } },
      distinct: ['code'],
      orderBy: { code: 'asc' },
      select: { code: true },
    });
    const mySet = new Set(myCodes);
    const availableCodes = otherCodes
      .map((row) => row.code)
      .filter((code) => code && !mySet.has(code));

    return {
      companyID: company.id,
      companyName: company.companyName,
      codes: myCodes.map((code) => ({
        code,
        linkedCompanyCount: byCode.get(code)?.length ?? 0,
        linkedCompanies: byCode.get(code) ?? [],
      })),
      availableCodes,
      linkedCompanies: [...linkedById.values()],
    };
  }

  async addFederalDomainCode(
    companyId: number,
    rawCode: string,
    user?: {
      role?: string;
      sub?: number;
      id?: number;
      companyID?: number;
      employeeId?: number;
      employeeID?: number;
    },
  ) {
    await this.assertCanManageFederalDomain(companyId, user);
    const code = normalizeFederalDomainCode(rawCode);
    if (!code) throw new BadRequestException('Enter a federal domain code');
    if (code.length > 120) throw new BadRequestException('Code is too long');

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    try {
      await this.prisma.companyFederalDomain.create({
        data: { companyID: companyId, code },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('This company already has that code');
      }
      throw err;
    }

    return this.getFederalDomain(companyId, user);
  }

  async removeFederalDomainCode(
    companyId: number,
    rawCode: string,
    user?: {
      role?: string;
      sub?: number;
      id?: number;
      companyID?: number;
      employeeId?: number;
      employeeID?: number;
    },
  ) {
    await this.assertCanManageFederalDomain(companyId, user);
    const code = normalizeFederalDomainCode(rawCode);
    if (!code) throw new BadRequestException('Code is required');

    await this.prisma.companyFederalDomain.deleteMany({
      where: { companyID: companyId, code },
    });
    return this.getFederalDomain(companyId, user);
  }

  async getMutualLinkedCompanyIds(companyId: number): Promise<number[]> {
    return getMutuallyLinkedCompanyIds(this.prisma, companyId);
  }

  private assertSuperAdmin(user: { role?: string } | undefined) {
    if (String(user?.role || '').toUpperCase() !== 'SUPERADMIN') {
      throw new ForbiddenException('Only SuperAdmin can manage task assignee company links');
    }
  }

  async getTaskAssigneeLinks(companyId: number, user?: { role?: string }) {
    this.assertSuperAdmin(user);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, companyName: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    const linkTable = (this.prisma as any).companyTaskAssigneeLink;
    const outbound = await linkTable.findMany({
      where: { companyID: companyId },
      select: { linkedCompanyID: true },
    });
    const linkedCompanyIDs = outbound.map((r: { linkedCompanyID: number }) => r.linkedCompanyID);
    let mutualCompanyIDs: number[] = [];
    if (linkedCompanyIDs.length) {
      const inbound = await linkTable.findMany({
        where: {
          companyID: { in: linkedCompanyIDs },
          linkedCompanyID: companyId,
        },
        select: { companyID: true },
      });
      mutualCompanyIDs = inbound.map((r: { companyID: number }) => r.companyID);
    }

    return {
      companyID: company.id,
      companyName: company.companyName,
      linkedCompanyIDs,
      mutualCompanyIDs,
    };
  }

  async setTaskAssigneeLinks(
    companyId: number,
    linkedCompanyIDs: number[],
    user?: { role?: string },
  ) {
    this.assertSuperAdmin(user);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    const uniqueIds = [
      ...new Set(
        (Array.isArray(linkedCompanyIDs) ? linkedCompanyIDs : [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0 && id !== companyId),
      ),
    ];

    if (uniqueIds.length) {
      const found = await this.prisma.company.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
      });
      if (found.length !== uniqueIds.length) {
        throw new BadRequestException('One or more selected companies were not found');
      }
    }

    const linkTable = (this.prisma as any).companyTaskAssigneeLink;
    await this.prisma.$transaction([
      linkTable.deleteMany({
        where: { companyID: companyId },
      }),
      ...(uniqueIds.length
        ? [
            linkTable.createMany({
              data: uniqueIds.map((linkedCompanyID) => ({
                companyID: companyId,
                linkedCompanyID,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    return this.getTaskAssigneeLinks(companyId, user);
  }
}