export type LeaveDayStatus = {
  date: string;
  status: "Sick" | "Casual" | "Privileged" | "ShortLeave" | "CompOff" | "LoP" | "MtL" | "PtL" | "";
  dayType?: "Present" | "LateMark" | "Halfday" | "Absent" | "";
};

export type LeaveBalanceEntry = { used: number; total: number; remaining: number };

export type LeaveBalance = {
  sick: LeaveBalanceEntry;
  casual: LeaveBalanceEntry;
  privileged: LeaveBalanceEntry;
  compOff: LeaveBalanceEntry;
  maternity: LeaveBalanceEntry;
  paternity: LeaveBalanceEntry;
};

const BALANCE_LIMITED_LEAVE_TYPES: Record<string, keyof LeaveBalance> = {
  Sick: "sick",
  Casual: "casual",
  Privileged: "privileged",
  CompOff: "compOff",
  MtL: "maternity",
  PtL: "paternity",
};

export function leaveTypeLabel(type: string) {
  const map: Record<string, string> = {
    Sick: "Sick Leave",
    Casual: "Casual Leave",
    Privileged: "Privileged Leave",
    ShortLeave: "Short Leave",
    CompOff: "Comp Off",
    LoP: "Loss of Pay (LoP)",
    MtL: "Maternity Leave (MtL)",
    PtL: "Paternity Leave (PtL)",
  };
  return map[type] || type;
}

export function buildDayStatusesFromRange(fromDate: string, toDate: string): LeaveDayStatus[] {
  const from = new Date(fromDate.includes("T") ? fromDate : `${fromDate}T12:00:00`);
  const to = new Date(toDate.includes("T") ? toDate : `${toDate}T12:00:00`);
  const days: LeaveDayStatus[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    days.push({ date: cur.toISOString().slice(0, 10), status: "" });
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function parseDateOnly(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isDateInRange(date: string, rangeFrom: string, rangeTo: string) {
  const d = parseDateOnly(date);
  return d >= parseDateOnly(rangeFrom) && d <= parseDateOnly(rangeTo);
}

export function enforceBalanceOnDayStatuses(
  days: LeaveDayStatus[],
  baseBalance: LeaveBalance,
): { days: LeaveDayStatus[]; stripped: number } {
  let result = days.map((d) => ({ ...d }));
  let stripped = 0;
  for (const type of Object.keys(BALANCE_LIMITED_LEAVE_TYPES)) {
    const key = BALANCE_LIMITED_LEAVE_TYPES[type];
    const limit = Math.max(baseBalance[key].total - baseBalance[key].used, 0);
    const matching = result
      .map((d, i) => ({ i, status: d.status }))
      .filter((x) => x.status === type);
    for (let j = limit; j < matching.length; j++) {
      const idx = matching[j].i;
      result[idx] = { ...result[idx], status: "", dayType: undefined };
      stripped += 1;
    }
  }
  return { days: result, stripped };
}

function slotsAvailableForLeaveTypeAfterClearingRange(
  days: LeaveDayStatus[],
  rangeFrom: string,
  rangeTo: string,
  status: LeaveDayStatus["status"],
  baseBalance: LeaveBalance,
): number {
  const key = status ? BALANCE_LIMITED_LEAVE_TYPES[status] : undefined;
  if (!key) return Number.POSITIVE_INFINITY;
  const outsideCount = days.filter(
    (d) => d.status === status && !isDateInRange(d.date, rangeFrom, rangeTo),
  ).length;
  const ob = baseBalance[key];
  return Math.max(ob.total - ob.used - outsideCount, 0);
}

export function applyLeaveTypeToRange(
  days: LeaveDayStatus[],
  rangeFrom: string,
  rangeTo: string,
  status: LeaveDayStatus["status"],
  baseBalance: LeaveBalance,
  dayType?: LeaveDayStatus["dayType"],
): { days: LeaveDayStatus[]; assigned: number; skipped: number } {
  if (!status) return { days, assigned: 0, skipped: 0 };
  const inRangeSorted = days
    .filter((d) => isDateInRange(d.date, rangeFrom, rangeTo))
    .sort((a, b) => a.date.localeCompare(b.date));
  let slots = Number.POSITIVE_INFINITY;
  const balanceKey = BALANCE_LIMITED_LEAVE_TYPES[status];
  if (balanceKey) {
    slots = slotsAvailableForLeaveTypeAfterClearingRange(
      days,
      rangeFrom,
      rangeTo,
      status,
      baseBalance,
    );
  }
  const assignDates = new Set<string>();
  let skipped = 0;
  inRangeSorted.forEach((day, index) => {
    if (index < slots) assignDates.add(day.date);
    else skipped += 1;
  });
  const updated = days.map((day) => {
    if (!isDateInRange(day.date, rangeFrom, rangeTo)) return day;
    if (assignDates.has(day.date)) {
      return {
        ...day,
        status,
        dayType: status === "ShortLeave" ? dayType || day.dayType : undefined,
      };
    }
    return { ...day, status: "" as const, dayType: undefined };
  });
  return { days: updated, assigned: assignDates.size, skipped };
}

export function clearLeaveTypeInRange(
  days: LeaveDayStatus[],
  rangeFrom: string,
  rangeTo: string,
): LeaveDayStatus[] {
  return days.map((day) => {
    if (isDateInRange(day.date, rangeFrom, rangeTo)) {
      return { ...day, status: "", dayType: undefined };
    }
    return day;
  });
}

export function groupAssignedRanges(days: LeaveDayStatus[]) {
  const assigned = days.filter((d) => d.status);
  if (!assigned.length) return [] as { from: string; to: string; status: string; dayType?: string; count: number }[];
  const segments: { from: string; to: string; status: string; dayType?: string; count: number }[] = [];
  let cur = {
    from: assigned[0].date,
    to: assigned[0].date,
    status: assigned[0].status!,
    dayType: assigned[0].dayType,
    count: 1,
  };
  for (let i = 1; i < assigned.length; i++) {
    const d = assigned[i];
    const prev = parseDateOnly(cur.to);
    const next = parseDateOnly(d.date);
    const adjacent = next.getTime() - prev.getTime() === 86400000;
    const same =
      d.status === cur.status && (d.status !== "ShortLeave" || d.dayType === cur.dayType);
    if (same && adjacent) {
      cur.to = d.date;
      cur.count += 1;
    } else {
      segments.push({ ...cur });
      cur = { from: d.date, to: d.date, status: d.status!, dayType: d.dayType, count: 1 };
    }
  }
  segments.push({ ...cur });
  return segments;
}

export function buildLeaveApprovalPayload(
  balancedDays: LeaveDayStatus[],
  managerLeaveBalance: LeaveBalance,
) {
  const unassignedCount = balancedDays.filter((d) => !d.status).length;
  const finalStatus = unassignedCount > 0 ? "Partially Approved" : "Approved";
  const leaveTypeCounts: Record<string, number> = {};
  balancedDays.forEach((day) => {
    if (day.status && day.status !== "LoP" && day.status !== "ShortLeave") {
      leaveTypeCounts[day.status] = (leaveTypeCounts[day.status] || 0) + 1;
    }
  });
  let mainLeaveType = "LoP";
  let maxCount = 0;
  Object.entries(leaveTypeCounts).forEach(([type, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mainLeaveType = type;
    }
  });
  if (maxCount === 0) {
    const shortLeaveDays = balancedDays.filter((d) => d.status === "ShortLeave").length;
    const lopDays = balancedDays.filter((d) => d.status === "LoP").length;
    mainLeaveType = shortLeaveDays > 0 ? "ShortLeave" : lopDays > 0 ? "LoP" : "LoP";
  }
  const countType = (t: string) => balancedDays.filter((d) => d.status === t).length;
  return {
    status: finalStatus,
    appliedLeaveType: mainLeaveType,
    dayStatuses: balancedDays,
    remainingSickLeave: Math.max(
      managerLeaveBalance.sick.total - (managerLeaveBalance.sick.used + countType("Sick")),
      0,
    ),
    remainingCasualLeave: Math.max(
      managerLeaveBalance.casual.total - (managerLeaveBalance.casual.used + countType("Casual")),
      0,
    ),
  };
}

/** Toggle one day: assign `type` or clear if already that type. */
export function toggleDayLeaveType(
  days: LeaveDayStatus[],
  date: string,
  type: LeaveDayStatus["status"],
  dayType?: LeaveDayStatus["dayType"],
): LeaveDayStatus[] {
  if (!type) return days;
  return days.map((day) => {
    if (day.date !== date) return day;
    if (day.status === type && (type !== "ShortLeave" || day.dayType === dayType)) {
      return { ...day, status: "", dayType: undefined };
    }
    return {
      ...day,
      status: type,
      dayType: type === "ShortLeave" ? dayType || day.dayType : undefined,
    };
  });
}

export function availableLeaveTypesForEmployee(
  balance: LeaveBalance,
  gender: string | null,
): string[] {
  const types: string[] = [];
  if (balance.sick.remaining > 0) types.push("Sick");
  if (balance.casual.remaining > 0) types.push("Casual");
  if (balance.privileged.remaining > 0) types.push("Privileged");
  types.push("ShortLeave", "LoP");
  if (balance.compOff.remaining > 0) types.push("CompOff");
  if (balance.maternity.remaining > 0 && (gender === "Female" || gender === "Others")) types.push("MtL");
  if (balance.paternity.remaining > 0 && (gender === "Male" || gender === "Others")) types.push("PtL");
  return types;
}
