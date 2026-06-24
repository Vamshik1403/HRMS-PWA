import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateCompanyDto) {
    return this.prisma.company.create({ data });
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

    if (!company) return null;

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

  remove(id: number) {
    return this.prisma.company.delete({ where: { id } });
  }
}