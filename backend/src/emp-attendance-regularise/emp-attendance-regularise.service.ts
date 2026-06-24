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

    // Fetch employee with direct work shift and attendance policy relations
    const employee = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      include: {
        workShift: { include: { workShiftDay: true } },
        attendancePolicy: true,
      },
    });

    // Also check EmpWorkShift for a custom shift assignment (takes priority)
    const empWorkShift = await this.prisma.empWorkShift.findFirst({
      where: { manageEmployeeID: employeeId },
      include: { workShift: { include: { workShiftDay: true } } },
      orderBy: { id: 'desc' },
    });

    const workShift = empWorkShift?.workShift ?? (employee as any)?.workShift ?? null;

    // Determine the weekday name for the target date
    const weekDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = weekDayNames[targetDate.getDay()];

    // Find the WORK shift day for this weekday
    const shiftDay = workShift?.workShiftDay?.find(
      (d: any) => d.weekDay === dayOfWeek && d.shiftType === 'WORK',
    ) ?? null;

    // Resolve attendance policy: employee-level → EmpAttendancePolicy → branch-level
    let policy: any = (employee as any)?.attendancePolicy ?? null;
    if (!policy) {
      const empPolicy = await this.prisma.empAttendancePolicy.findFirst({
        where: { manageEmployeeID: employeeId },
        include: { attendancePolicy: true },
        orderBy: { id: 'desc' },
      });
      policy = empPolicy?.attendancePolicy ?? null;
    }
    if (!policy && employee?.companyID && employee?.branchesID) {
      policy = await this.prisma.attendancePolicy.findFirst({
        where: { companyID: employee.companyID, branchesID: employee.branchesID },
      });
    }



    // Handle single punch using policy markAs setting
    if (punches.length === 1) {
      const singlePunchStatus = policy?.markAs === 'Absent' ? 'ABSENT' : 'HALFDAY';
      return {
        actualStatus: singlePunchStatus,
        checkInTime: firstPunch,
        checkOutTime: null,
        isRegularized: false,
        punchCount: 1,
      };
    }

    // Helper: convert "HH:MM[:SS]" string or Date to minutes since midnight (local time)
    const toMin = (val: Date | string | null | undefined): number => {
      if (!val) return 0;
      if (val instanceof Date) return val.getHours() * 60 + val.getMinutes();
      const parts = String(val).split(':');
      return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    };

    const firstPunchMin = toMin(firstPunch);
    const lastPunchMin = toMin(lastPunch);

    const isFlexible = workShift?.isFlexible || false;
    let startMin = firstPunchMin;
    let endMin = lastPunchMin;

    // Apply same capping logic as the attendance reports calculateWorkedMinutes
    if (!isFlexible && shiftDay && policy) {
      const shiftStartMin = toMin(shiftDay.startTime);
      const shiftEndMin = toMin(shiftDay.endTime);

      // Cap early check-in
      const earlyBuffer = policy.checkin_begin_before_min || 0;
      if (startMin < shiftStartMin - earlyBuffer) {
        startMin = shiftStartMin;
      }

      // Cap late check-out if OT not applicable
      if (!policy.overtimeApplicable) {
        const checkoutBuffer = policy.checkout_end_after_min || 0;
        if (endMin > shiftEndMin + checkoutBuffer) {
          endMin = shiftEndMin;
        }
      }
    }

    let workedMinutes = endMin - startMin;
    if (workedMinutes < 0) workedMinutes += 24 * 60; // handle midnight wrap

    // Deduct break time if employee was present during the full break window
    if (shiftDay?.breakStart && shiftDay?.breakEnd) {
      const breakStartMin = toMin(shiftDay.breakStart);
      const breakEndMin = toMin(shiftDay.breakEnd);
      if (breakStartMin > 0 && breakEndMin > 0 && startMin <= breakStartMin && endMin >= breakEndMin) {
        workedMinutes -= (breakEndMin - breakStartMin);
      }
    }

    // Deduct policy trim pre/post shift minutes
    if (!isFlexible && policy) {
      workedMinutes -= (policy.trimPreshiftMin || 0);
      workedMinutes -= (policy.trimPostshiftMin || 0);
    }

    workedMinutes = Math.max(0, workedMinutes);

    // Use actual shift totalMinutes as full-day threshold; fall back to 480 min (8 h)
    const totalShiftMinutes = shiftDay?.totalMinutes ?? 480;
    // Use policy half-day minimum; fall back to half of shift minutes
    const halfDayMin = policy?.min_work_hours_half_day_min ?? Math.round(totalShiftMinutes / 2);

    let actualStatus: string;
    if (workedMinutes < halfDayMin) {
      actualStatus = 'ABSENT';
    } else if (workedMinutes < totalShiftMinutes) {
      actualStatus = 'HALFDAY';
    } else {
      actualStatus = 'FULLDAY';
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
        departments: true,
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
        departments: true,
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
        departments: true,
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
        departments: true,
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
