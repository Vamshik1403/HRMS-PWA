import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceProviderDto } from './dto/create-service-provider.dto';
import { UpdateServiceProviderDto } from './dto/update-service-provider.dto';

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
    return this.prisma.serviceProvider.create({ data });
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
      data,
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
