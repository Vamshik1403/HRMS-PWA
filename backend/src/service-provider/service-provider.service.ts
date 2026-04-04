import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceProviderDto } from './dto/create-service-provider.dto';
import { UpdateServiceProviderDto } from './dto/update-service-provider.dto';

@Injectable()
export class ServiceProviderService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateServiceProviderDto) {
    return this.prisma.serviceProvider.create({ data });
  }

  findAll() {
    return this.prisma.serviceProvider.findMany();
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

  remove(id: number) {
    return this.prisma.serviceProvider.delete({ where: { id } });
  }
}
