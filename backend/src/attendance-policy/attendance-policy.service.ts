// attendance-policy.service.ts
import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendancePolicyDto } from './dto/create-attendance-policy.dto';
import { UpdateAttendancePolicyDto } from './dto/update-attendance-policy.dto';

@Injectable()
export class AttendancePolicyService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateAttendancePolicyDto) {
    // Check unique policy name per company
    if (data.companyID && data.attendancePolicyName) {
      const existing = await this.prisma.attendancePolicy.findFirst({
        where: {
          companyID: data.companyID,
          attendancePolicyName: data.attendancePolicyName,
        },
      });
      if (existing) {
        throw new ConflictException(
          `Attendance policy name "${data.attendancePolicyName}" already exists for this company.`,
        );
      }
    }
    return this.prisma.attendancePolicy.create({
      data: {
        serviceProviderID: data.serviceProviderID,
        companyID: data.companyID,
        branchesID: data.branchesID,
        attendancePolicyName: data.attendancePolicyName,
        workingHoursType: data.workingHoursType,
        checkin_begin_before_min: data.checkin_begin_before_min,
        checkout_end_after_min: data.checkout_end_after_min,
        checkin_grace_time_min: data.checkin_grace_time_min,
        min_work_hours_half_day_min: data.min_work_hours_half_day_min,
        max_late_check_in_time: data.max_late_check_in_time,
        earlyCheckoutBeforeEndMin: data.earlyCheckoutBeforeEndMin,
        markAs: data.markAs,
        lateMarkCount: data.lateMarkCount,
        allow_self_mark_attendance: data.allow_self_mark_attendance,
        allow_manager_update_ot: data.allow_manager_update_ot,
        max_ot_hours_per_day_min: data.max_ot_hours_per_day_min,
        // New fields
        overtimeApplicable: data.overtimeApplicable ?? false,
        minOvertimeHrs: data.minOvertimeHrs ?? 0,
        maxOvertimeHrs: data.maxOvertimeHrs ?? 0,
        overtimeTrimmingApply: data.overtimeTrimmingApply ?? false,
        checkoutGracePeriodForOvertimeTrimming: data.checkoutGracePeriodForOvertimeTrimming ?? 0,
        breakTimeForOT: data.breakTimeForOT ?? 0,
        otMealApply: data.otMealApply ?? false,
        minsForOTMealToken: data.minsForOTMealToken ?? 0,
        minsForBreakTimeForMeal: data.minsForBreakTimeForMeal ?? 0,
        lateMarkMarkAs: data.lateMarkMarkAs ?? null,
        lateMarkMarkCount: data.lateMarkMarkCount ?? null,
        maxLateCheckinMarkAs: data.maxLateCheckinMarkAs ?? null,
        trimPreshiftMin: data.trimPreshiftMin ?? 0,
        trimPostshiftMin: data.trimPostshiftMin ?? 0,
      },
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
      },
    });
  }

  findAll() {
    return this.prisma.attendancePolicy.findMany({
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.attendancePolicy.findUnique({
      where: { id },
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
      },
    });
  }

  async update(id: number, data: UpdateAttendancePolicyDto) {
    // Check unique policy name per company on update
    if (data.attendancePolicyName !== undefined) {
      const companyID = data.companyID;
      if (companyID) {
        const existing = await this.prisma.attendancePolicy.findFirst({
          where: {
            companyID,
            attendancePolicyName: data.attendancePolicyName,
            id: { not: id },
          },
        });
        if (existing) {
          throw new ConflictException(
            `Attendance policy name "${data.attendancePolicyName}" already exists for this company.`,
          );
        }
      }
    }
    const updateData: any = {};

    // Only include fields that are provided
    if (data.serviceProviderID !== undefined) updateData.serviceProviderID = data.serviceProviderID;
    if (data.companyID !== undefined) updateData.companyID = data.companyID;
    if (data.branchesID !== undefined) updateData.branchesID = data.branchesID;
    if (data.attendancePolicyName !== undefined) updateData.attendancePolicyName = data.attendancePolicyName;
    if (data.workingHoursType !== undefined) updateData.workingHoursType = data.workingHoursType;
    if (data.checkin_begin_before_min !== undefined) updateData.checkin_begin_before_min = data.checkin_begin_before_min;
    if (data.checkout_end_after_min !== undefined) updateData.checkout_end_after_min = data.checkout_end_after_min;
    if (data.checkin_grace_time_min !== undefined) updateData.checkin_grace_time_min = data.checkin_grace_time_min;
    if (data.min_work_hours_half_day_min !== undefined) updateData.min_work_hours_half_day_min = data.min_work_hours_half_day_min;
    if (data.max_late_check_in_time !== undefined) updateData.max_late_check_in_time = data.max_late_check_in_time;
    if (data.earlyCheckoutBeforeEndMin !== undefined) updateData.earlyCheckoutBeforeEndMin = data.earlyCheckoutBeforeEndMin;
    if (data.markAs !== undefined) updateData.markAs = data.markAs;
    if (data.lateMarkCount !== undefined) updateData.lateMarkCount = data.lateMarkCount;
    if (data.allow_self_mark_attendance !== undefined) updateData.allow_self_mark_attendance = data.allow_self_mark_attendance;
    if (data.allow_manager_update_ot !== undefined) updateData.allow_manager_update_ot = data.allow_manager_update_ot;
    if (data.max_ot_hours_per_day_min !== undefined) updateData.max_ot_hours_per_day_min = data.max_ot_hours_per_day_min;
    
    // New fields
    if (data.overtimeApplicable !== undefined) updateData.overtimeApplicable = data.overtimeApplicable;
    if (data.minOvertimeHrs !== undefined) updateData.minOvertimeHrs = data.minOvertimeHrs;
    if (data.maxOvertimeHrs !== undefined) updateData.maxOvertimeHrs = data.maxOvertimeHrs;
    if (data.overtimeTrimmingApply !== undefined) updateData.overtimeTrimmingApply = data.overtimeTrimmingApply;
    if (data.checkoutGracePeriodForOvertimeTrimming !== undefined) updateData.checkoutGracePeriodForOvertimeTrimming = data.checkoutGracePeriodForOvertimeTrimming;
    if (data.breakTimeForOT !== undefined) updateData.breakTimeForOT = data.breakTimeForOT;
    if (data.otMealApply !== undefined) updateData.otMealApply = data.otMealApply;
    if (data.minsForOTMealToken !== undefined) updateData.minsForOTMealToken = data.minsForOTMealToken;
    if (data.minsForBreakTimeForMeal !== undefined) updateData.minsForBreakTimeForMeal = data.minsForBreakTimeForMeal;
    if (data.lateMarkMarkAs !== undefined) updateData.lateMarkMarkAs = data.lateMarkMarkAs;
    if (data.lateMarkMarkCount !== undefined) updateData.lateMarkMarkCount = data.lateMarkMarkCount;
    if (data.maxLateCheckinMarkAs !== undefined) updateData.maxLateCheckinMarkAs = data.maxLateCheckinMarkAs;
    if (data.trimPreshiftMin !== undefined) updateData.trimPreshiftMin = data.trimPreshiftMin;
    if (data.trimPostshiftMin !== undefined) updateData.trimPostshiftMin = data.trimPostshiftMin;

    return this.prisma.attendancePolicy.update({
      where: { id },
      data: updateData,
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
      },
    });
  }

  remove(id: number) {
    return this.prisma.attendancePolicy.delete({ where: { id } });
  }
}