import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmpFieldSiteAttendanceDto } from './dto/create-emp-field-site-attendance.dto';
import { UpdateEmpFieldSiteAttendanceDto } from './dto/update-emp-field-site-attendance.dto';

@Injectable()
export class EmpFieldSiteAttendanceService {
  constructor(private prisma: PrismaService) {}

  async create(createEmpFieldSiteAttendanceDto: CreateEmpFieldSiteAttendanceDto) {
    return this.prisma.empFieldSiteAttendance.create({
      data: createEmpFieldSiteAttendanceDto,
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

  async findAll() {
    return this.prisma.empFieldSiteAttendance.findMany({
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
      orderBy: {
        id: 'desc',
      },
    });
  }

  async findOne(id: number) {
    return this.prisma.empFieldSiteAttendance.findUnique({
      where: { id },
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

  async update(id: number, updateEmpFieldSiteAttendanceDto: UpdateEmpFieldSiteAttendanceDto) {
    return this.prisma.empFieldSiteAttendance.update({
      where: { id },
      data: updateEmpFieldSiteAttendanceDto,
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

  async remove(id: number) {
    return this.prisma.empFieldSiteAttendance.delete({
      where: { id },
    });
  }
}
