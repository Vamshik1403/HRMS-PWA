import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateDeviceDto) {
    const { serviceProviderID, companyID, branchesID, ...rest } = dto;

    const data: Prisma.DevicesCreateInput = {
      ...rest,
      ...(serviceProviderID != null
        ? { serviceProvider: { connect: { id: serviceProviderID } } }
        : {}),
      ...(companyID != null
        ? { company: { connect: { id: companyID } } }
        : {}),
      ...(branchesID != null
        ? { branches: { connect: { id: branchesID } } }
        : {}),
    };

    return this.prisma.devices.create({
      data,
      include: { serviceProvider: true, company: true, branches: true },
    });
  }

  findAll() {
    return this.prisma.devices.findMany({
      orderBy: { createdAt: 'desc' },
      include: { serviceProvider: true, company: true, branches: true },
    });
  }

  findOne(id: number) {
    return this.prisma.devices.findUnique({
      where: { id },
      include: { serviceProvider: true, company: true, branches: true },
    });
  }

  async update(id: number, dto: UpdateDeviceDto) {
    const { serviceProviderID, companyID, branchesID, ...rest } = dto;

    // Build relation updates only if keys are present on dto (can connect or set null)
    const relationData: Prisma.DevicesUpdateInput = {
      ...rest,
      ...(serviceProviderID !== undefined
        ? serviceProviderID == null
          ? { serviceProvider: { disconnect: true } }
          : { serviceProvider: { connect: { id: serviceProviderID } } }
        : {}),
      ...(companyID !== undefined
        ? companyID == null
          ? { company: { disconnect: true } }
          : { company: { connect: { id: companyID } } }
        : {}),
      ...(branchesID !== undefined
        ? branchesID == null
          ? { branches: { disconnect: true } }
          : { branches: { connect: { id: branchesID } } }
        : {}),
    };

    return this.prisma.devices.update({
      where: { id },
      data: relationData,
      include: { serviceProvider: true, company: true, branches: true },
    });
  }

  remove(id: number) {
    return this.prisma.devices.delete({ where: { id } });
  }
}
