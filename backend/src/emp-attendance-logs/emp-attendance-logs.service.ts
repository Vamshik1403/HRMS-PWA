import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OvertimeService } from '../overtime/overtime.service';
import dayjs from 'dayjs';

@Injectable()
export class EmpAttendanceLogsService {
  constructor(
    private prisma: PrismaService,
    private overtimeService: OvertimeService,
  ) {}

  async findAll(params?: { skip?: number; take?: number }) {
    const logs = await this.prisma.empAttendanceLogs.findMany({
      orderBy: { punchTimeStamp: 'asc' },
    });

    const processed = new Set<string>();

    for (const log of logs) {
      if (!log.employeeID) continue;

      const dateKey = dayjs(log.punchTimeStamp).format('YYYY-MM-DD');
      const key = `${log.employeeID}_${dateKey}`;

      if (processed.has(key)) continue;
      processed.add(key);

      await this.overtimeService.generateForEmployeeDate(
        log.employeeID,
        dayjs(log.punchTimeStamp).toDate(),
      );
    }

    return logs;
  }
}
