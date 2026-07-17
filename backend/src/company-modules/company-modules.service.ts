import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyModuleDto } from './dto/create-company-module.dto';
import { UpdateCompanyModuleDto } from './dto/update-company-module.dto';

@Injectable()
export class CompanyModulesService {
  constructor(private readonly prisma: PrismaService) {}

  private generateModuleKey(moduleName: string): string {
  return `${moduleName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')}_MODULE`;
}

  async create(
  createCompanyModuleDto: CreateCompanyModuleDto,
) {
  const moduleName =
    createCompanyModuleDto.moduleName.trim();

  const moduleKey =
    this.generateModuleKey(moduleName);

  const existingModule =
    await this.prisma.companyModules.findFirst({
      where: {
        OR: [
          {
            moduleName: {
              equals: moduleName,
              mode: 'insensitive',
            },
          },
          {
            moduleKey,
          },
        ],
      },
    });

  if (existingModule) {
    throw new ConflictException(
      `Company module "${moduleName}" already exists`,
    );
  }

  return this.prisma.companyModules.create({
    data: {
      moduleKey,

      moduleName,

      moduleDescription:
        createCompanyModuleDto.moduleDescription
          ?.trim() || null,

      moduleStatus:
        createCompanyModuleDto.moduleStatus ??
        true,
    },
  });
}

  async findAll(moduleStatus?: boolean, search?: string) {
    return this.prisma.companyModules.findMany({
      where: {
        ...(typeof moduleStatus === 'boolean' && {
          moduleStatus,
        }),

        ...(search?.trim() && {
          OR: [
            {
              moduleName: {
                contains: search.trim(),
                mode: 'insensitive',
              },
            },
            {
              moduleDescription: {
                contains: search.trim(),
                mode: 'insensitive',
              },
            },
          ],
        }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const companyModule = await this.prisma.companyModules.findUnique({
      where: {
        id,
      },
    });

    if (!companyModule) {
      throw new NotFoundException(
        `Company module with ID ${id} was not found`,
      );
    }

    return companyModule;
  }

  async update(
  id: number,
  updateCompanyModuleDto: UpdateCompanyModuleDto,
) {
  const existingModule =
    await this.findOne(id);

  if (
    updateCompanyModuleDto.moduleName !==
    undefined
  ) {
    const moduleName =
      updateCompanyModuleDto.moduleName.trim();

    if (!moduleName) {
      throw new ConflictException(
        'Module name cannot be empty',
      );
    }

    const duplicateModule =
      await this.prisma.companyModules.findFirst({
        where: {
          id: {
            not: id,
          },
          moduleName: {
            equals: moduleName,
            mode: 'insensitive',
          },
        },
      });

    if (duplicateModule) {
      throw new ConflictException(
        `Company module "${moduleName}" already exists`,
      );
    }
  }

  return this.prisma.companyModules.update({
    where: {
      id,
    },

    data: {
      /*
       * moduleKey is intentionally not changed.
       * It is a stable internal identifier.
       */

      ...(updateCompanyModuleDto.moduleName !==
        undefined && {
        moduleName:
          updateCompanyModuleDto.moduleName.trim(),
      }),

      ...(updateCompanyModuleDto
        .moduleDescription !== undefined && {
        moduleDescription:
          updateCompanyModuleDto
            .moduleDescription?.trim() ||
          null,
      }),

      ...(updateCompanyModuleDto.moduleStatus !==
        undefined && {
        moduleStatus:
          updateCompanyModuleDto.moduleStatus,
      }),
    },
  });
}

  async updateStatus(id: number, moduleStatus: boolean) {
    await this.findOne(id);

    return this.prisma.companyModules.update({
      where: {
        id,
      },
      data: {
        moduleStatus,
      },
    });
  }

  async remove(id: number) {
    const companyModule = await this.findOne(id);

    await this.prisma.companyModules.delete({
      where: {
        id,
      },
    });

    return {
      message: 'Company module deleted successfully',
      data: companyModule,
    };
  }
}