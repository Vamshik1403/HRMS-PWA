import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceProviderDto } from './dto/create-service-provider.dto';
import { UpdateServiceProviderDto } from './dto/update-service-provider.dto';

const SP_FIELDS = [
  'companyName',
  'companyAddress',
  'country',
  'state',
  'city',
  'pincode',
  'countryCode',
  'gstNo',
  'contactNo',
  'emailAdd',
  'website',
  'companyLogoUrl',
] as const;

type SpField = (typeof SP_FIELDS)[number];

function pickServiceProviderData(
  data: CreateServiceProviderDto | UpdateServiceProviderDto,
): Partial<Record<SpField, string | undefined>> {
  const out: Partial<Record<SpField, string | undefined>> = {};
  for (const key of SP_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = (data as Record<string, unknown>)[key];
      out[key] = value == null ? undefined : String(value);
    }
  }
  return out;
}

@Injectable()
export class ServiceProviderService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateServiceProviderDto) {
    const existing = await this.prisma.serviceProvider.count();
    if (existing > 0) {
      throw new BadRequestException(
        'Only one Service Provider is allowed. Edit the existing record instead.',
      );
    }
    return this.prisma.serviceProvider.create({
      data: pickServiceProviderData(data),
    });
  }

  findAll() {
    return this.prisma.serviceProvider.findMany({ orderBy: { id: 'asc' } });
  }

  findOne(id: number) {
    return this.prisma.serviceProvider.findUnique({ where: { id } });
  }

  update(id: number, data: UpdateServiceProviderDto) {
    return this.prisma.serviceProvider.update({
      where: { id },
      data: pickServiceProviderData(data),
    });
  }

  async remove(id: number) {
    const sp = await this.prisma.serviceProvider.findUnique({ where: { id } });
    if (!sp) throw new NotFoundException(`Service provider ${id} not found`);
    try {
      return await this.prisma.serviceProvider.delete({ where: { id } });
    } catch (error: any) {
      throw new BadRequestException(
        error?.message ||
          'Cannot delete service provider while companies or users still reference it.',
      );
    }
  }
}
