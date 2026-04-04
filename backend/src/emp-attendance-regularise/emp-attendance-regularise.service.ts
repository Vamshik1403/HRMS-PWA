import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmpAttendanceRegulariseDto } from './dto/create-emp-attendance-regularise.dto';
import { UpdateEmpAttendanceRegulariseDto } from './dto/update-emp-attendance-regularise.dto';

@Injectable()
export class EmpAttendanceRegulariseService {
  constructor(private prisma: PrismaService) {}

  async create(createEmpAttendanceRegulariseDto: CreateEmpAttendanceRegulariseDto) {
    const data = { ...createEmpAttendanceRegulariseDto } as any;

    // Rule: Only past dates allowed — no future regularisation
    if (data.attendanceDate) {
      const reqDate = new Date(data.attendanceDate);
      reqDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (reqDate > today) {
        throw new BadRequestException('Attendance regularisation is only allowed for past dates');
      }
    }

    // Rule: No duplicate request for the same employee + date (with PENDING status)
    if (data.manageEmployeeID && data.attendanceDate) {
      const existing = await this.prisma.empAttendanceRegularise.findFirst({
        where: {
          manageEmployeeID: data.manageEmployeeID,
          attendanceDate: new Date(data.attendanceDate),
          status: 'Pending',
        },
      });
      if (existing) {
        throw new ConflictException(
          'A pending regularisation request already exists for this employee on the selected date',
        );
      }
    }

    return this.prisma.empAttendanceRegularise.create({
      data,
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

  async findAll() {
    return this.prisma.empAttendanceRegularise.findMany({
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
    return this.prisma.empAttendanceRegularise.findUnique({
      where: { id },
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

  async update(id: number, updateEmpAttendanceRegulariseDto: UpdateEmpAttendanceRegulariseDto) {
    const data = { ...updateEmpAttendanceRegulariseDto } as any;
    return this.prisma.empAttendanceRegularise.update({
      where: { id },
      data,
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

  async remove(id: number) {
    return this.prisma.empAttendanceRegularise.delete({
      where: { id },
    });
  }
}
