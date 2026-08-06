import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateCompanyOwnerDto } from './dto/create-company-owner.dto';
import { ownerTitleForLegalEntity } from '../common/company-module-permissions';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateCompanyDto) {
    return this.prisma.company.create({ data });
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
        personalPhoneNo: true,
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

    const username = dto.username.trim();
    const existingCred = await this.prisma.employeeCredentials.findUnique({
      where: { username },
    });
    if (existingCred) throw new ConflictException('Username already exists');

    const existingUser = await this.prisma.user.findUnique({
      where: { username },
    });
    if (existingUser) throw new ConflictException('Username already exists');

    const ownerTitle =
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

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);
    const joiningDate =
      dto.joiningDate?.trim() ||
      new Date().toISOString().slice(0, 10);

    const created = await this.prisma.$transaction(async (tx) => {
      const employee = await tx.manageEmployee.create({
        data: {
          employeeID: employeeCode,
          employeeFirstName: dto.firstName.trim(),
          employeeLastName: (dto.lastName || '').trim() || null,
          personalPhoneNo: dto.personalPhoneNo?.trim() || null,
          businessEmail: dto.businessEmail?.trim() || null,
          joiningDate,
          companyID: company.id,
          serviceProviderID: company.serviceProviderID,
          branchesID: defaultBranch?.id ?? null,
          isCompanyOwner: true,
          ownerTitle,
          employmentStatus: 'Active',
          onboardingApprovalStatus: 'APPROVED',
          lifecycleStatus: 'ACTIVE',
        },
      });

      await tx.employeeCredentials.create({
        data: {
          employeeID: employee.id,
          username,
          password: passwordHash,
          mustChangePassword: false,
          isActive: true,
          serviceProviderID: company.serviceProviderID ?? undefined,
          companyID: company.id,
          branchesID: defaultBranch?.id ?? undefined,
        },
      });

      return tx.manageEmployee.findUnique({
        where: { id: employee.id },
        include: {
          company: {
            select: { id: true, companyName: true, legalEntityType: true },
          },
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
      });
    });

    return {
      ...created,
      ownerTitle,
      roleLabel: ownerTitle,
      message: `Company owner (${ownerTitle}) created. Login with employee credentials.`,
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

    if (dto.username) {
      const username = dto.username.trim();
      const taken = await this.prisma.employeeCredentials.findFirst({
        where: { username, employeeID: { not: owner.id } },
      });
      if (taken) throw new ConflictException('Username already exists');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.manageEmployee.update({
        where: { id: owner.id },
        data: {
          employeeFirstName: dto.firstName?.trim() ?? undefined,
          employeeLastName:
            dto.lastName !== undefined ? dto.lastName.trim() || null : undefined,
          personalPhoneNo:
            dto.personalPhoneNo !== undefined
              ? dto.personalPhoneNo.trim() || null
              : undefined,
          businessEmail:
            dto.businessEmail !== undefined
              ? dto.businessEmail.trim() || null
              : undefined,
        },
      });

      if (owner.employeeCredentials) {
        const credUpdate: any = {};
        if (dto.username) credUpdate.username = dto.username.trim();
        if (dto.password) {
          const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
          credUpdate.password = await bcrypt.hash(dto.password, saltRounds);
          credUpdate.mustChangePassword = false;
        }
        if (dto.isActive !== undefined) credUpdate.isActive = dto.isActive;
        if (Object.keys(credUpdate).length > 0) {
          await tx.employeeCredentials.update({
            where: { employeeID: owner.id },
            data: credUpdate,
          });
        }
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
            createdAt: true,
          },
        },
      },
    });
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
      personalPhoneNo: user.contactNo || undefined,
      businessEmail: user.email || undefined,
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

  update(id: number, data: UpdateCompanyDto) {
    return this.prisma.company.update({
      where: { id },
      data,
    });
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