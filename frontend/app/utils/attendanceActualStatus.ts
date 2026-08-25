import { formatDevicePunchForDisplay } from "./devicePunchTime";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export type AttendanceActualStatusResult = {
  actualStatus: string;
  checkInTime: string;
  checkOutTime: string;
  day: string;
  alreadyRegularized?: boolean;
};

export async function detectAttendanceActualStatus(params: {
  employeeId: number;
  attendanceDate: string;
  companyID?: number;
  branchesID?: number;
}): Promise<AttendanceActualStatusResult> {
  const { employeeId, attendanceDate: date, companyID, branchesID } = params;

  const timeToMin = (t: string): number => {
    if (!t) return 0;
    const p = t.split(":");
    return (parseInt(p[0]) || 0) * 60 + (parseInt(p[1]) || 0) + (parseInt(p[2]) || 0) / 60;
  };

  const parsePunchTime = (pt: string): string | null => {
    const f = formatDevicePunchForDisplay(pt);
    return f?.timeStr ?? null;
  };

  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayOfWeek = WEEKDAYS[new Date(date).getDay()];

  const [logsRes, empRes, policyRes, holidayRes, leaveRes, regRes, rosterRes] = await Promise.all([
    fetch(`${BACKEND_URL}/process-att-logs?dateFrom=${date}&dateTo=${date}&manageEmployeeIds=${employeeId}&limit=1000`, { cache: "no-store" }),
    fetch(`${BACKEND_URL}/manage-emp/${employeeId}`, { cache: "no-store" }),
    fetch(`${BACKEND_URL}/attendance-policy`, { cache: "no-store" }),
    fetch(`${BACKEND_URL}/public-holiday`, { cache: "no-store" }),
    fetch(`${BACKEND_URL}/leave-application`, { cache: "no-store" }),
    fetch(`${BACKEND_URL}/emp-attendance-regularise`, { cache: "no-store" }),
    fetch(`${BACKEND_URL}/rosters`, { cache: "no-store" }),
  ]);

  const logsRaw = await logsRes.json();
  const allLogs: { manage_employee_id?: number; punch_time?: string }[] = Array.isArray(logsRaw)
    ? logsRaw
    : (logsRaw?.data ?? []);
  const empLogs = allLogs.filter((l) => Number(l.manage_employee_id) === Number(employeeId));
  const punches: string[] = empLogs
    .map((l) => parsePunchTime(l.punch_time ?? ""))
    .filter(Boolean)
    .sort() as string[];

  const empData: {
    workShiftID?: number;
    empWorkShift?: { workShiftID?: number }[];
    branchesID?: number;
    companyID?: number;
  } | null = empRes.ok ? await empRes.json() : null;
  const allPolicies: { companyID?: number; branchesID?: number }[] = policyRes.ok ? await policyRes.json() : [];
  const allHolidays: { companyID?: number; branchesID?: number; startDate?: string; endDate?: string }[] =
    holidayRes.ok ? await holidayRes.json() : [];
  const allLeaves: {
    manageEmployeeID?: number;
    status?: string;
    fromDate?: string;
    toDate?: string;
    appliedLeaveType?: string;
  }[] = leaveRes.ok ? await leaveRes.json() : [];
  const allRegs: {
    manageEmployeeID?: number;
    status?: string;
    attendanceDate?: string;
    requestedStatus?: string;
    actualStatus?: string;
    checkInTime?: string;
    checkOutTime?: string;
  }[] = regRes.ok ? await regRes.json() : [];
  const allRosters: { employeeID?: number; days?: { workDate?: string; dayType?: string }[] }[] =
    rosterRes.ok ? await rosterRes.json() : [];

  const resolvedCompanyID = companyID ?? empData?.companyID;
  const resolvedBranchID = branchesID ?? empData?.branchesID;

  const policy = Array.isArray(allPolicies)
    ? (allPolicies.find(
        (p) =>
          Number(p.companyID) === Number(resolvedCompanyID) &&
          Number(p.branchesID) === Number(resolvedBranchID),
      ) ?? null)
    : null;

  let workShift: {
    isFlexible?: boolean;
    isRotating?: boolean;
    workShiftDay?: {
      weekDay?: string;
      shiftType?: string;
      weeklyOff?: boolean;
      startTime?: string;
      endTime?: string;
      totalMinutes?: number;
      breakStart?: string;
      breakEnd?: string;
    }[];
  } | null = null;
  const empShiftEntry = empData?.empWorkShift?.[0];
  const workShiftID = empShiftEntry?.workShiftID ?? empData?.workShiftID;
  if (workShiftID) {
    const wsRes = await fetch(`${BACKEND_URL}/work-shift/${workShiftID}`, { cache: "no-store" });
    if (wsRes.ok) workShift = await wsRes.json();
  }

  const isFlexible =
    !!(workShift?.isFlexible || String((policy as { workingHoursType?: string } | null)?.workingHoursType || "").toLowerCase().includes("flex"));
  const isRotating = workShift?.isRotating || false;
  const shiftDay =
    workShift?.workShiftDay?.find((d) => d.weekDay === dayOfWeek && d.shiftType === "WORK") ?? null;

  const existingReg = allRegs.find(
    (r) =>
      Number(r.manageEmployeeID) === Number(employeeId) &&
      r.status === "Approved" &&
      new Date(r.attendanceDate ?? "").toISOString().split("T")[0] === date,
  );
  if (existingReg) {
    const checkIn = existingReg.checkInTime
      ? new Date(existingReg.checkInTime).toTimeString().split(" ")[0]
      : "";
    const checkOut = existingReg.checkOutTime
      ? new Date(existingReg.checkOutTime).toTimeString().split(" ")[0]
      : "";
    return {
      actualStatus: `${existingReg.requestedStatus || existingReg.actualStatus} (Regularized)`,
      checkInTime: checkIn,
      checkOutTime: checkOut,
      day: dayOfWeek,
      alreadyRegularized: true,
    };
  }

  const checkIn = punches.length > 0 ? punches[0] : "";
  const checkOut = punches.length >= 2 ? punches[punches.length - 1] : "";

  const build = (status: string): AttendanceActualStatusResult => ({
    actualStatus: status,
    checkInTime: checkIn,
    checkOutTime: checkOut,
    day: dayOfWeek,
  });

  const isWeekOff = (): boolean => {
    if (!workShift) return false;
    if (isRotating) {
      const roster = allRosters.find((r) => Number(r.employeeID) === Number(employeeId));
      const rDay = roster?.days?.find(
        (d) => new Date(d.workDate ?? "").toISOString().split("T")[0] === date,
      );
      return rDay?.dayType === "WEEKLY_OFF";
    }
    return shiftDay?.weeklyOff || false;
  };

  const isPublicHoliday = (): boolean =>
    allHolidays.some((h) => {
      if (Number(h.companyID) !== Number(resolvedCompanyID)) return false;
      if (h.branchesID != null && String(h.branchesID) !== "") {
        if (Number(h.branchesID) !== Number(resolvedBranchID)) return false;
      }
      const rawStart = String(h.startDate ?? "");
      const rawEnd = String(h.endDate ?? "");
      const hs = rawStart.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || new Date(rawStart).toISOString().split("T")[0];
      const he = rawEnd.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || new Date(rawEnd).toISOString().split("T")[0] || hs;
      return !!hs && date >= hs && date <= he;
    });

  const approvedLeave = () =>
    allLeaves.find(
      (l) =>
        Number(l.manageEmployeeID) === Number(employeeId) &&
        l.status === "Approved" &&
        date >= new Date(l.fromDate ?? "").toISOString().split("T")[0] &&
        date <= new Date(l.toDate ?? "").toISOString().split("T")[0],
    );

  const calculateWorkedMinutes = (p: string[]): number => {
    if (p.length < 2) return 0;
    let st = timeToMin(p[0]);
    let et = timeToMin(p[p.length - 1]);
    if (!isFlexible && policy && shiftDay) {
      const ss = timeToMin(shiftDay.startTime ?? "");
      const se = timeToMin(shiftDay.endTime ?? "");
      const pol = policy as {
        checkin_begin_before_min?: number;
        overtimeApplicable?: boolean;
        checkout_end_after_min?: number;
        trimPreshiftMin?: number;
        trimPostshiftMin?: number;
      };
      if (st < ss - (pol.checkin_begin_before_min || 0)) st = ss;
      if (!pol.overtimeApplicable) {
        const maxEnd = se + (pol.checkout_end_after_min || 0);
        if (et > maxEnd) et = se;
      }
    }
    let worked = et - st;
    if (worked < 0) worked += 24 * 60;
    if (shiftDay?.breakStart && shiftDay?.breakEnd) {
      const bs = timeToMin(shiftDay.breakStart);
      const be = timeToMin(shiftDay.breakEnd);
      if (bs > 0 && be > 0 && st <= bs && et >= be) worked -= be - bs;
    }
    if (!isFlexible && policy) {
      const pol = policy as { trimPreshiftMin?: number; trimPostshiftMin?: number };
      worked -= pol.trimPreshiftMin || 0;
      worked -= pol.trimPostshiftMin || 0;
    }
    return Math.max(0, worked);
  };

  if (punches.length === 0) {
    if (isPublicHoliday()) return build("PUBLIC_HOLIDAY");
    if (isWeekOff()) return build("WEEK_OFF");
    const leave = approvedLeave();
    if (leave) return build(leave.appliedLeaveType ?? "LEAVE");
    return build("ABSENT");
  }

  if (isPublicHoliday()) return build("PUBLIC_HOLIDAY");
  if (isWeekOff()) return build("WEEK_OFF");
  const leave = approvedLeave();
  if (leave) return build(leave.appliedLeaveType ?? "LEAVE");

  if (punches.length === 1) {
    const pol = policy as { markAs?: string } | null;
    return build(pol?.markAs === "Absent" ? "ABSENT" : "HALFDAY");
  }

  if (shiftDay && policy) {
    const firstMin = timeToMin(punches[0]);
    const lastMin = timeToMin(punches[punches.length - 1]);
    const shiftStartMin = timeToMin(shiftDay.startTime ?? "");
    const shiftEndMin = timeToMin(shiftDay.endTime ?? "");
    const pol = policy as {
      max_late_check_in_time?: number;
      maxLateCheckinMarkAs?: string;
      min_work_hours_half_day_min?: number;
      checkin_grace_time_min?: number;
      earlyCheckoutBeforeEndMin?: number;
    };
    const graceTime = pol.checkin_grace_time_min || 0;
    const maxLateWindow = pol.max_late_check_in_time || 0;
    const graceEnd = shiftStartMin + graceTime;
    const maxLateCutoff = graceEnd + maxLateWindow;
    const workedMinutes = calculateWorkedMinutes(punches);
    const totalShiftMinutes = shiftDay.totalMinutes || 480;
    const halfDayMin = pol.min_work_hours_half_day_min || 0;
    const earlyAllow = pol.earlyCheckoutBeforeEndMin || 0;

    if (isFlexible) {
      if (workedMinutes < halfDayMin) return build("ABSENT");
      if (workedMinutes < totalShiftMinutes) return build("HALFDAY");
      return build("FULLDAY");
    }

    if (workedMinutes < halfDayMin) return build("ABSENT");
    if (firstMin > maxLateCutoff) {
      const markAs = pol.maxLateCheckinMarkAs || "Absent";
      return build(markAs === "Absent" ? "ABSENT" : "HALFDAY");
    }
    if (lastMin < shiftEndMin - earlyAllow) return build("HALFDAY");
    if (firstMin > graceEnd && firstMin <= maxLateCutoff) return build("LATE_MARK");
    return build("FULLDAY");
  }

  return build(punches.length >= 2 ? "FULLDAY" : "HALFDAY");
}

export const ATTENDANCE_REQUESTED_STATUS_OPTIONS = [
  { value: "PRESENT", label: "Present" },
  { value: "SL", label: "Late Mark" },
  { value: "SL", label: "Half Day" },
  { value: "SL", label: "Sick Leave (SL)" },
  { value: "CL", label: "Casual Leave (CL)" },
  { value: "PL", label: "Privilege Leave (PL)" },
  { value: "LOP", label: "Loss of Pay (LOP)" },
] as const;
