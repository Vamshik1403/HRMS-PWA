// src/overtime/overtime.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as dayjs from "dayjs";
import * as customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

@Injectable()
export class OvertimeService {
  private readonly logger = new Logger(OvertimeService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Parse string timestamp to Date object
   */
  private parseTimestamp(timestamp: string | Date): dayjs.Dayjs {
    if (typeof timestamp === 'string') {
      // Handle both "2026-01-30 10:00:00" and ISO format
      return dayjs(timestamp, ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DDTHH:mm:ss.SSSZ']);
    }
    return dayjs(timestamp);
  }

  /**
   * Format date to string for database query (since punchTimeStamp is String)
   */
  private formatForQuery(date: dayjs.Dayjs): string {
    return date.format('YYYY-MM-DD HH:mm:ss');
  }

  /**
   * Generate OT for ONE employee for ONE date
   */
  async generateForEmployeeDate(employeeID: number, date: Date) {
    try {
      const dayStart = dayjs(date).startOf("day");
      const dayEnd = dayjs(date).endOf("day");

      // 1️⃣ Get ALL punches for the day sorted by time
      const dayPunches = await this.prisma.empAttendanceLogs.findMany({
        where: {
          employeeID,
          // Convert dates to string format for String field comparison
          punchTimeStamp: {
            gte: this.formatForQuery(dayStart),
            lte: this.formatForQuery(dayEnd),
          },
        },
        orderBy: { punchTimeStamp: "asc" },
      });

      // Need at least 2 punches (IN and OUT)
      if (dayPunches.length < 2) {
        this.logger.debug(`Employee ${employeeID}: Less than 2 punches on ${dayStart.format('YYYY-MM-DD')}`);
        return null;
      }

      const firstPunch = dayPunches[0]; // IN time
      const lastPunch = dayPunches[dayPunches.length - 1]; // OUT time
      
      // Parse timestamps
      const firstPunchTime = this.parseTimestamp(firstPunch.punchTimeStamp);
      const lastPunchTime = this.parseTimestamp(lastPunch.punchTimeStamp);
      
      // 2️⃣ Prevent duplicate OT for same day
      const existingOT = await this.prisma.overtime.findFirst({
        where: {
          employeeID,
          workDate: dayStart.toDate(),
        },
      });

   
      // 3️⃣ Get employee with all required relations
      const emp = await this.prisma.manageEmployee.findUnique({
        where: { id: employeeID },
        include: {
          monthlyPayGrade: true,
        },
      });

      if (!emp) {
        this.logger.error(`Employee ${employeeID} not found`);
        return null;
      }

      // 4️⃣ Validate required fields
      if (!emp.serviceProviderID || !emp.companyID || !emp.branchesID) {
        return null;
      }

      if (!emp.monthlyPayGradeID || !emp.workShiftID) {
        return null;
      }

      // 5️⃣ Check if OT is enabled in paygrade
      if (
        !emp.monthlyPayGrade ||
        emp.monthlyPayGrade.otStatus !== true ||
        !emp.monthlyPayGrade.otRate ||
        emp.monthlyPayGrade.miniOTTime == null
      ) {
        return null;
      }

      // 6️⃣ Get work shift days
      const shiftDays = await this.prisma.workShiftDay.findMany({
        where: {
          workShiftID: emp.workShiftID,
        },
      });

      // Get weekday shift for this day
      const weekday = firstPunchTime.format("dddd"); // e.g., "Monday"
      
      const shiftDay = shiftDays.find(
        (day) => day.weekDay === weekday
      );

      if (!shiftDay || shiftDay.weeklyOff || !shiftDay.endTime) {
        return null;
      }

      // 7️⃣ Calculate shift end time on the same date as punch
      const shiftEndTime = dayjs(shiftDay.endTime);
      const shiftEndOnDate = firstPunchTime
        .hour(shiftEndTime.hour())
        .minute(shiftEndTime.minute())
        .second(shiftEndTime.second());

      const punchOutTime = lastPunchTime;

      // 8️⃣ Calculate overtime minutes (after shift end)
      if (punchOutTime.isBefore(shiftEndOnDate)) {
        return null;
      }

      const overtimeMinutes = punchOutTime.diff(shiftEndOnDate, "minute");

      // 9️⃣ Apply minimum OT time threshold
      if (overtimeMinutes < emp.monthlyPayGrade.miniOTTime) {
      
        return null;
      }

      // 🔟 Calculate OT start time (shift end)
      const otStartTime = shiftEndOnDate.clone();

      // Create OT record
      const otRecord = await this.prisma.overtime.create({
        data: {
          serviceProviderID: emp.serviceProviderID,
          companyID: emp.companyID,
          branchesID: emp.branchesID,
          employeeID,
          workShiftID: emp.workShiftID,
          workDate: dayStart.toDate(),
          shiftStartTime: shiftDay.startTime!,
          shiftEndTime: shiftDay.endTime!,
          punchOutTime: punchOutTime.toDate(),
          otStartTime: otStartTime.toDate(),
          otEndTime: punchOutTime.toDate(),
          otMinutes: overtimeMinutes,
          otHours: parseFloat((overtimeMinutes / 60).toFixed(2)),
          otRate: emp.monthlyPayGrade.otRate,
          status: "PENDING",
        },
      });

      return otRecord;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk generate OT for a date range
   */
  async generateForDateRange(startDate: Date, endDate: Date) {
    const start = dayjs(startDate).startOf("day");
    const end = dayjs(endDate).endOf("day");
    
    // Get all employees
    const employees = await this.prisma.manageEmployee.findMany({
      where: {
        monthlyPayGrade: {
          otStatus: true,
        },
      },
      select: { id: true },
    });


    const results: any[] = [];
    for (const emp of employees) {
      // For each day in range
      let currentDate = start.clone();
      while (currentDate.isBefore(end) || currentDate.isSame(end)) {
        try {
          const result = await this.generateForEmployeeDate(
            emp.id,
            currentDate.toDate()
          );
          if (result) {
            results.push({
              id: result.id,
              employeeID: result.employeeID,
              workDate: result.workDate,
              otMinutes: result.otMinutes,
              otHours: result.otHours,
              status: result.status
            });
          }
        } catch (error) {
          this.logger.error(`Failed for employee ${emp.id} on ${currentDate.format('YYYY-MM-DD')}:`, error);
        }
        currentDate = currentDate.add(1, "day");
      }
    }

    return {
      message: `Processed ${employees.length} employees`,
      overtimeRecordsCreated: results.length,
      records: results,
    };
  }

  /**
   * Recalculate OT for specific employee and date (if needed)
   */
  async recalculateOT(employeeID: number, date: Date) {
    // Delete existing OT for this day
    const dayStart = dayjs(date).startOf("day");
    
    await this.prisma.overtime.deleteMany({
      where: {
        employeeID,
        workDate: dayStart.toDate(),
      },
    });

    // Generate new OT
    return this.generateForEmployeeDate(employeeID, date);
  }

  // ================= CRUD Methods =================

  findAll() {
    return this.prisma.overtime.findMany({
      orderBy: { workDate: "desc" },
    });
  }

  findPending() {
    return this.prisma.overtime.findMany({
      where: { status: "PENDING" },
      orderBy: { workDate: "desc" },
    });
  }

  findForEmployee(employeeID: number, startDate?: Date, endDate?: Date) {
    const where: any = { employeeID };
    
    if (startDate && endDate) {
      where.workDate = {
        gte: dayjs(startDate).startOf("day").toDate(),
        lte: dayjs(endDate).endOf("day").toDate(),
      };
    }

    return this.prisma.overtime.findMany({
      where,
      orderBy: { workDate: "desc" },
    });
  }

  approve(id: number) {
    return this.prisma.overtime.update({
      where: { id },
      data: { status: "APPROVED", updatedAt: new Date() },
    });
  }

  reject(id: number, reason?: string) {
    return this.prisma.overtime.update({
      where: { id },
      data: { 
        status: "REJECTED", 
        updatedAt: new Date(),
        ...(reason && { rejectionReason: reason }),
      },
    });
  }

  remove(id: number) {
    return this.prisma.overtime.delete({ where: { id } });
  }

  /**
   * Debug method to check calculations
   */
  async debugEmployeeOT(employeeID: number, date: Date) {
    const dayStart = dayjs(date).startOf("day");
    const dayEnd = dayjs(date).endOf("day");

    const debugInfo: any = {
      employeeID,
      date: dayStart.format('YYYY-MM-DD'),
      punches: [],
      calculations: {}
    };

    // Get punches
    const punches = await this.prisma.empAttendanceLogs.findMany({
      where: {
        employeeID,
        punchTimeStamp: {
          gte: this.formatForQuery(dayStart),
          lte: this.formatForQuery(dayEnd)
        }
      },
      orderBy: { punchTimeStamp: 'asc' }
    });
    
    debugInfo.punches = punches.map(p => ({
      id: p.id,
      punchTimeStamp: p.punchTimeStamp,
      parsedTime: this.parseTimestamp(p.punchTimeStamp).format('YYYY-MM-DD HH:mm:ss')
    }));
    
    if (punches.length >= 2) {
      const firstPunchTime = this.parseTimestamp(punches[0].punchTimeStamp);
      const lastPunchTime = this.parseTimestamp(punches[punches.length-1].punchTimeStamp);
      
      debugInfo.calculations.firstPunch = firstPunchTime.format('HH:mm:ss');
      debugInfo.calculations.lastPunch = lastPunchTime.format('HH:mm:ss');
      
      // Get employee data
      const emp = await this.prisma.manageEmployee.findUnique({
        where: { id: employeeID },
        include: { monthlyPayGrade: true },
      });
      
      if (emp?.workShiftID) {
        const shiftDays = await this.prisma.workShiftDay.findMany({
          where: { workShiftID: emp.workShiftID }
        });
        
        const weekday = firstPunchTime.format('dddd');
        debugInfo.calculations.weekday = weekday;
        
        const shiftDay = shiftDays.find(d => d.weekDay === weekday);
        debugInfo.calculations.shiftDay = shiftDay;
        
        if (shiftDay?.endTime && emp.monthlyPayGrade) {
          const shiftEnd = dayjs(shiftDay.endTime);
          const shiftEndOnDate = firstPunchTime
            .hour(shiftEnd.hour())
            .minute(shiftEnd.minute())
            .second(shiftEnd.second());
          
          const otMinutes = lastPunchTime.diff(shiftEndOnDate, 'minute');
          
          debugInfo.calculations.shiftEnd = shiftEnd.format('HH:mm:ss');
          debugInfo.calculations.shiftEndOnDate = shiftEndOnDate.format('YYYY-MM-DD HH:mm:ss');
          debugInfo.calculations.punchOut = lastPunchTime.format('YYYY-MM-DD HH:mm:ss');
          debugInfo.calculations.otMinutes = otMinutes;
          debugInfo.calculations.miniOTTime = emp.monthlyPayGrade.miniOTTime;
          debugInfo.calculations.otEligible = otMinutes >= (emp.monthlyPayGrade.miniOTTime || 0);
        }
      }
    }
    
    return debugInfo;
  }
}