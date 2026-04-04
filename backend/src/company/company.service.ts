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

  findAll() {
    return this.prisma.company.findMany({
      include: {
        serviceProvider: true, // 👈 include relation if needed
      },
    });
  }

  findOne(id: number) {
    return this.prisma.company.findUnique({
      where: { id },
      include: {
        serviceProvider: true,
      },
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
