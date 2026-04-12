import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeMemoDto } from './dto/create-employee-memo.dto';
import { UpdateEmployeeMemoDto } from './dto/update-employee-memo.dto';

@Injectable()
export class EmployeeMemoService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.employeeMemo.findMany({
      include: { manageEmployee: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.employeeMemo.findUnique({
      where: { id },
      include: { manageEmployee: true },
    });
  }

  create(dto: CreateEmployeeMemoDto) {
    return this.prisma.employeeMemo.create({
      data: {
        serviceProviderID: dto.serviceProviderID,
        companyID: dto.companyID,
        branchesID: dto.branchesID,
        employeeID: dto.employeeID,
        memoType: dto.memoType,
        subject: dto.subject,
        description: dto.description,
        issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : null,
        issuedBy: dto.issuedBy,
      },
    });
  }

  update(id: number, dto: UpdateEmployeeMemoDto) {
    return this.prisma.employeeMemo.update({
      where: { id },
      data: {
        ...dto,
        issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : undefined,
      },
    });
  }

  remove(id: number) {
    return this.prisma.employeeMemo.delete({ where: { id } });
  }
}
