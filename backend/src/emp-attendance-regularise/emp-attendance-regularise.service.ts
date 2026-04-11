import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmpAttendanceRegulariseDto } from './dto/create-emp-attendance-regularise.dto';
import { UpdateEmpAttendanceRegulariseDto } from './dto/update-emp-attendance-regularise.dto';

@Injectable()
export class EmpAttendanceRegulariseService {
  constructor(private prisma: PrismaService) {}

  async fetchAttendanceStatus(employeeId: number, date: string) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Check if there's already an approved regularization for this employee+date
    const existingRegularization = await this.prisma.empAttendanceRegularise.findFirst({
      where: {
        manageEmployeeID: employeeId,
        attendanceDate: targetDate,
        status: 'Approved',
      },
    });

    if (existingRegularization) {
      return {
        actualStatus: existingRegularization.requestedStatus || existingRegularization.actualStatus || 'ABSENT',
        checkInTime: existingRegularization.checkInTime,
        checkOutTime: existingRegularization.checkOutTime,
        isRegularized: true,
        punchCount: 0,
      };
    }

    // Fetch punches from process_att_logs for this employee on this date
    const punches = await this.prisma.process_att_logs.findMany({
      where: {
        manage_employee_id: employeeId,
        punch_time: {
          gte: targetDate,
          lt: nextDay,
        },
      },
      orderBy: { punch_time: 'asc' },
    });

    if (punches.length === 0) {
      return {
        actualStatus: 'ABSENT',
        checkInTime: null,
        checkOutTime: null,
        isRegularized: false,
        punchCount: 0,
      };
    }

    const firstPunch = punches[0].punch_time;
    const lastPunch = punches[punches.length - 1].punch_time;

    // Determine status based on punch count
    let actualStatus = 'ABSENT';
    if (punches.length === 1) {
      actualStatus = 'HALFDAY';
    } else if (punches.length >= 2) {
      // Calculate hours worked
      if (firstPunch && lastPunch) {
        const hoursWorked = (lastPunch.getTime() - firstPunch.getTime()) / (1000 * 60 * 60);
        if (hoursWorked >= 7) {
          actualStatus = 'FULLDAY';
        } else if (hoursWorked >= 4) {
          actualStatus = 'HALFDAY';
        } else {
          actualStatus = 'LATE';
        }
      } else {
        actualStatus = 'FULLDAY';
      }
    }

    return {
      actualStatus,
      checkInTime: firstPunch,
      checkOutTime: lastPunch,
      isRegularized: false,
      punchCount: punches.length,
    };
  }

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
