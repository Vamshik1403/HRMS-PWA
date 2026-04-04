import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentsDto } from './dto/create-department.dto';
import { UpdateDepartmentsDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateDepartmentsDto) {
    return this.prisma.departments.create({ data });
  }

  findAll() {
    return this.prisma.departments.findMany({
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.departments.findUnique({
      where: { id },
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
      },
    });
  }

  update(id: number, data: UpdateDepartmentsDto) {
    return this.prisma.departments.update({
      where: { id },
      data,
    });
  }

  remove(id: number) {
    return this.prisma.departments.delete({ where: { id } });
  }
}
