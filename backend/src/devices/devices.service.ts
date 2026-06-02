import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Prisma } from '@prisma/client';
import { reverseGeocode } from '../common/reverse-geocode';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  private async resolveLocationFields(
    latitude?: number | null,
    longitude?: number | null,
  ): Promise<Pick<Prisma.DevicesCreateInput, 'latitude' | 'longitude' | 'address'>> {
    if (latitude == null || longitude == null) {
      return { latitude: null, longitude: null, address: null };
    }
    const address = await reverseGeocode(latitude, longitude);
    return { latitude, longitude, address };
  }

  async create(dto: CreateDeviceDto) {
    const { serviceProviderID, companyID, branchesID, latitude, longitude, ...rest } = dto;
    const location = await this.resolveLocationFields(latitude, longitude);

    const data: Prisma.DevicesCreateInput = {
      ...rest,
      ...location,
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
    const { serviceProviderID, companyID, branchesID, authTypes, latitude, longitude, ...rest } =
      dto;

    let locationPatch: Prisma.DevicesUpdateInput = {};
    if (latitude !== undefined || longitude !== undefined) {
      const existing = await this.prisma.devices.findUnique({
        where: { id },
        select: { latitude: true, longitude: true },
      });
      const lat = latitude !== undefined ? latitude : existing?.latitude ?? null;
      const lng = longitude !== undefined ? longitude : existing?.longitude ?? null;
      locationPatch = await this.resolveLocationFields(lat, lng);
    }

    const relationData: Prisma.DevicesUpdateInput = {
      ...rest,
      ...locationPatch,
      ...(authTypes !== undefined ? { authTypes } : {}),
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

  resolveAddress(latitude: number, longitude: number) {
    return reverseGeocode(latitude, longitude);
  }
}
