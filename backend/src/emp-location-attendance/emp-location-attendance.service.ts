import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceLocationDto } from './dto/create-attendance-location.dto';

@Injectable()
export class EmpLocationAttendanceService {
  constructor(private prisma: PrismaService) {}

  async checkIn(employeeId: number, dto: CreateAttendanceLocationDto, ipAddress: string) {
    if (!['CHECK_IN', 'CHECK_OUT'].includes(dto.checkType)) {
      throw new BadRequestException('checkType must be CHECK_IN or CHECK_OUT');
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayRecords = await this.prisma.attendanceLocation.findMany({
      where: {
        employeeId,
        checkinTime: { gte: startOfDay, lte: endOfDay },
      },
    });

    const alreadyCheckedIn = todayRecords.some((r) => r.checkType === 'CHECK_IN');
    const alreadyCheckedOut = todayRecords.some((r) => r.checkType === 'CHECK_OUT');

    if (dto.checkType === 'CHECK_IN') {
      if (alreadyCheckedIn) {
        throw new BadRequestException('You have already checked in today.');
      }
    }

    if (dto.checkType === 'CHECK_OUT') {
      if (!alreadyCheckedIn) {
        throw new BadRequestException('You must check in before checking out.');
      }
      if (alreadyCheckedOut) {
        throw new BadRequestException('You have already checked out today.');
      }
    }

    // Fetch employee details to populate process_att_logs with name/company/branch/dept
    const employee = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: {
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        company: { select: { companyName: true } },
        branches: { select: { branchName: true } },
        departments: { select: { departmentName: true } },
      },
    });

    const record = await this.prisma.attendanceLocation.create({
      data: {
        employeeId,
        checkType: dto.checkType,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy ?? null,
        ipAddress,
        deviceType: dto.deviceType ?? null,
        browser: dto.browser ?? null,
        operatingSystem: dto.operatingSystem ?? null,
        userAgent: dto.userAgent ?? null,
      },
    });

    // Mirror the punch into process_att_logs so it appears in attendance reports
    try {
      const fullName = [employee?.employeeFirstName, employee?.employeeLastName]
        .filter(Boolean)
        .join(' ') || String(employeeId);

      await this.prisma.process_att_logs.create({
        data: {
          device_sn: 'LOCATION_APP',
          user_id: employee?.employeeID ?? String(employeeId),
          username: fullName,
          punch_time: record.checkinTime,
          company_name: employee?.company?.companyName ?? null,
          branch_name: employee?.branches?.branchName ?? null,
          department_name: employee?.departments?.departmentName ?? null,
          device_emp_code: employee?.employeeID ?? null,
          manage_employee_id: employeeId,
          device_id: null,
          raw_body: JSON.stringify({
            source: 'location_attendance',
            checkType: dto.checkType,
            latitude: dto.latitude,
            longitude: dto.longitude,
            accuracy: dto.accuracy ?? null,
            ipAddress,
          }),
          status: '0',
          device_name: 'Location Attendance App',
          device_type: dto.deviceType ?? null,
          auth_type: 'GPS',
        },
      });
    } catch {
      // Non-critical: do not fail the punch if process_att_logs write fails
    }

    return record;
  }

  async getMyRecords(employeeId: number) {
    return this.prisma.attendanceLocation.findMany({
      where: { employeeId },
      orderBy: { checkinTime: 'desc' },
      take: 100,
    });
  }

  async getTodayStatus(employeeId: number) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const records = await this.prisma.attendanceLocation.findMany({
      where: {
        employeeId,
        checkinTime: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { checkinTime: 'asc' },
    });

    const checkIn = records.find((r) => r.checkType === 'CHECK_IN') ?? null;
    const checkOut = [...records].reverse().find((r) => r.checkType === 'CHECK_OUT') ?? null;

    return {
      isCheckedIn: !!checkIn,
      isCheckedOut: !!checkOut,
      checkIn,
      checkOut,
      allToday: records,
    };
  }
}
