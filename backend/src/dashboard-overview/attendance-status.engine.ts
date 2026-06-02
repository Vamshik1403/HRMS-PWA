import { formatDevicePunchStorage } from '../common/device-punch-time';

/** Mirrors Attendance Marking Logs logic from the web reports (actual mode). */

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export type DayStatusResult = {
  type: string;
  label: string;
  hasPunches: boolean;
  workedMinutes?: number;
};

export type AttendancePolicyLike = {
  checkin_begin_before_min?: number | null;
  checkout_end_after_min?: number | null;
  checkin_grace_time_min?: number | null;
  earlyCheckoutBeforeEndMin?: number | null;
  min_work_hours_half_day_min?: number | null;
  max_late_check_in_time?: number | null;
  markAs?: string | null;
  lateMarkCount?: string | null;
  lateMarkMarkAs?: string | null;
  lateMarkMarkCount?: string | null;
  maxLateCheckinMarkAs?: string | null;
  overtimeApplicable?: boolean | null;
  trimPreshiftMin?: number | null;
  trimPostshiftMin?: number | null;
};

export function parsePunchTime(punchTime: string): { dateKey: string; timeStr: string } | null {
  return formatDevicePunchStorage(punchTime);
}

/**
 * Minimum gap (minutes) between two consecutive punches for the later one to be
 * treated as a distinct attendance event. Punches closer than this are accidental
 * re-taps (an employee punching twice/thrice in quick succession on the device)
 * and are collapsed into a single punch so a stray morning punch is never paired
 * as the check-out.
 */
export const MIN_PUNCH_GAP_MIN = 10;

/**
 * Collapse consecutive punches that fall within `gapMin` minutes of the previous
 * kept punch. Input must be sorted ascending. Genuinely separated punches (a real
 * check-out hours later) are preserved; rapid duplicate taps are merged.
 */
export function collapsePunchBursts(sortedTimes: string[], gapMin = MIN_PUNCH_GAP_MIN): string[] {
  const out: string[] = [];
  for (const t of sortedTimes) {
    if (out.length === 0) {
      out.push(t);
      continue;
    }
    const prev = timeToMinutes(out[out.length - 1]);
    if (timeToMinutes(t) - prev >= gapMin) out.push(t);
  }
  return out;
}

export function dedupeSortedPunchList(times: string[]): string[] {
  const sorted = [...times].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  const exactDeduped: string[] = [];
  for (const t of sorted) {
    if (exactDeduped.length === 0 || exactDeduped[exactDeduped.length - 1] !== t) {
      exactDeduped.push(t);
    }
  }
  return collapsePunchBursts(exactDeduped);
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const cleanTime = timeStr.includes(':') ? timeStr : `${timeStr}:00`;
  const parts = cleanTime.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const seconds = parseInt(parts[2], 10) || 0;
  return hours * 60 + minutes + seconds / 60;
}

function parseRuleCount(value: string | number | undefined | null, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function incrementTrackerAndShouldApply(
  tracker: Map<string, number>,
  key: string,
  allowedCount: number,
): boolean {
  if (allowedCount <= 0) return false;
  const nextCount = (tracker.get(key) || 0) + 1;
  if (nextCount > allowedCount) {
    tracker.set(key, 0);
    return true;
  }
  tracker.set(key, nextCount);
  return false;
}

function calculateWorkedMinutes(
  punches: string[],
  shiftStart: string,
  shiftEnd: string,
  workBreak: { breakStart: string; breakEnd: string },
  policy: AttendancePolicyLike | null,
  isFlexible: boolean,
): number {
  if (punches.length < 2) return 0;
  let startTime = timeToMinutes(punches[0]);
  let endTime = timeToMinutes(punches[punches.length - 1]);
  if (!isFlexible && policy) {
    const shiftStartMin = timeToMinutes(shiftStart);
    const shiftEndMin = timeToMinutes(shiftEnd);
    if (startTime < shiftStartMin - (policy.checkin_begin_before_min || 0)) {
      startTime = shiftStartMin;
    }
    if (!policy.overtimeApplicable) {
      const maxEndTime = shiftEndMin + (policy.checkout_end_after_min || 0);
      if (endTime > maxEndTime) endTime = shiftEndMin;
    }
  }
  let workedMinutes = endTime - startTime;
  if (workedMinutes < 0) workedMinutes += 24 * 60;
  const breakStartMin = timeToMinutes(workBreak.breakStart);
  const breakEndMin = timeToMinutes(workBreak.breakEnd);
  if (breakStartMin > 0 && breakEndMin > 0) {
    const breakDuration = breakEndMin - breakStartMin;
    if (startTime <= breakStartMin && endTime >= breakEndMin) {
      workedMinutes -= breakDuration;
    }
  }
  if (!isFlexible && policy) {
    workedMinutes -= policy.trimPreshiftMin || 0;
    workedMinutes -= policy.trimPostshiftMin || 0;
  }
  return Math.max(0, workedMinutes);
}

function calculateOTMinutes(
  punches: string[],
  shiftEndTime: string,
  otConfig: { startTime: string; endTime: string },
  policy: AttendancePolicyLike,
): number {
  if (punches.length < 2 || !policy.overtimeApplicable) return 0;
  const lastPunchMin = timeToMinutes(punches[punches.length - 1]);
  const shiftEndMin = timeToMinutes(shiftEndTime);
  const checkoutBuffer = policy.checkout_end_after_min || 0;
  if (lastPunchMin <= shiftEndMin + checkoutBuffer) return 0;
  let otStartMin = Math.max(shiftEndMin, timeToMinutes(otConfig.startTime));
  let otEndMin = Math.min(lastPunchMin, timeToMinutes(otConfig.endTime));
  return Math.max(0, otEndMin - otStartMin);
}

export type ComputeDayStatusInput = {
  date: string;
  employeeId: number;
  punches: string[];
  nextDayPunches?: string[];
  companyId: number;
  branchId: number;
  workShift?: {
    isFlexible?: boolean | null;
    isRotating?: boolean | null;
    workShiftDay?: Array<{
      weekDay: string;
      shiftType: string;
      weeklyOff?: boolean | null;
      startTime: string;
      endTime: string;
      breakStart?: string | null;
      breakEnd?: string | null;
      totalMinutes: number;
    }>;
  } | null;
  rosterDay?: { dayType?: string | null; workShift?: ComputeDayStatusInput['workShift'] } | null;
  policy?: AttendancePolicyLike | null;
  regularization?: { requestedStatus?: string | null } | null;
  leave?: { appliedLeaveType?: string | null } | null;
  publicHolidays: Array<{ companyID: number; branchesID: number | null; startDate: Date | string; endDate: Date | string }>;
  absentDeclared?: boolean;
  lateMarkTracker: Map<string, number>;
  noCheckoutTracker: Map<string, number>;
  /** Matches web Attendance Marking Logs in actual mode (not factual). */
  actualMode?: boolean;
};

export function computeDayStatus(input: ComputeDayStatusInput): DayStatusResult {
  const {
    date,
    employeeId,
    punches,
    nextDayPunches = [],
    companyId,
    branchId,
    workShift,
    rosterDay,
    policy,
    regularization,
    leave,
    publicHolidays,
    absentDeclared,
    lateMarkTracker,
    noCheckoutTracker,
    actualMode = true,
  } = input;

  if (absentDeclared && punches.length === 0) {
    return { type: 'ABSENT', label: 'Absent', hasPunches: false };
  }

  const effectiveShift =
    rosterDay?.dayType === 'WORK' && rosterDay.workShift ? rosterDay.workShift : workShift;

  const isFlexible = effectiveShift?.isFlexible || false;
  const isRotating = effectiveShift?.isRotating || false;
  const dayOfWeek = WEEKDAYS[new Date(date).getDay()];
  const shiftDay = effectiveShift?.workShiftDay?.find(
    (d) => d.weekDay === dayOfWeek && d.shiftType === 'WORK',
  );
  const otDay = effectiveShift?.workShiftDay?.find(
    (d) => d.weekDay === dayOfWeek && d.shiftType === 'OT',
  );
  const defaultWorkedMinutes = shiftDay?.totalMinutes || 480;

  if (regularization) {
    const reqStatus = String(regularization.requestedStatus || 'PRESENT');
    const regLabel =
      reqStatus === 'Present' || reqStatus === 'PRESENT'
        ? 'P'
        : reqStatus === 'Half Day' || reqStatus === 'HALF_DAY'
          ? 'HD'
          : reqStatus === 'Absent' || reqStatus === 'ABSENT' || reqStatus === 'LOP'
            ? 'A'
            : reqStatus;
    return { type: 'REGULARIZATION', label: regLabel, hasPunches: punches.length > 0 };
  }

  const isWeekOff = (): boolean => {
    if (!effectiveShift) return false;
    if (isRotating) return rosterDay?.dayType === 'WEEKLY_OFF';
    return !!shiftDay?.weeklyOff;
  };

  const isPublicHolidayDay = (): boolean =>
    publicHolidays.some((holiday) => {
      if (holiday.companyID !== companyId) return false;
      if (holiday.branchesID != null && holiday.branchesID !== branchId) return false;
      const holidayStart = new Date(holiday.startDate).toISOString().split('T')[0];
      const holidayEnd = new Date(holiday.endDate).toISOString().split('T')[0];
      return date >= holidayStart && date <= holidayEnd;
    });

  if (!actualMode && isWeekOff()) {
    return { type: 'WEEK_OFF', label: 'WO', hasPunches: punches.length > 0, workedMinutes: defaultWorkedMinutes };
  }

  if (!actualMode && leave) {
    const lt = leave.appliedLeaveType || 'Leave';
    return {
      type: 'LEAVE',
      label: punches.length > 0 ? `${lt}-P` : lt,
      hasPunches: punches.length > 0,
      workedMinutes: punches.length > 0 ? undefined : defaultWorkedMinutes,
    };
  }

  const shiftSpansMidnight = shiftDay
    ? timeToMinutes(shiftDay.endTime) < timeToMinutes(shiftDay.startTime)
    : false;
  const effectivePunches = dedupeSortedPunchList(
    shiftSpansMidnight ? [...punches, ...nextDayPunches] : [...punches],
  );
  const hasPunchesEffective = effectivePunches.length > 0;

  if (!actualMode && isPublicHolidayDay()) {
    let workedMinutes = 0;
    if (hasPunchesEffective && shiftDay) {
      workedMinutes = calculateWorkedMinutes(
        punches,
        shiftDay.startTime,
        shiftDay.endTime,
        { breakStart: shiftDay.breakStart || '', breakEnd: shiftDay.breakEnd || '' },
        policy || null,
        isFlexible,
      );
    }
    return {
      type: 'HOLIDAY',
      label: hasPunchesEffective ? 'PH-P' : 'PH',
      hasPunches: hasPunchesEffective,
      workedMinutes: workedMinutes || defaultWorkedMinutes,
    };
  }

  if (!hasPunchesEffective) {
    return { type: 'ABSENT', label: 'Absent', hasPunches: false };
  }

  const punchesForFallback = dedupeSortedPunchList(
    shiftSpansMidnight ? effectivePunches : punches,
  );

  if (!policy || !shiftDay) {
    if (punchesForFallback.length === 1) {
      return { type: 'SINGLE_PUNCH', label: 'no checkout', hasPunches: true };
    }
    if (punchesForFallback.length >= 2 && policy && !shiftDay) {
      const worked = timeToMinutes(punchesForFallback[punchesForFallback.length - 1]) -
        timeToMinutes(punchesForFallback[0]);
      const halfDayMin = policy.min_work_hours_half_day_min || 0;
      if (worked < halfDayMin) {
        return { type: 'ABSENT', label: 'Absent', hasPunches: true, workedMinutes: worked };
      }
      return { type: 'HALF_DAY', label: 'Half Day', hasPunches: true, workedMinutes: worked };
    }
    return { type: 'PRESENT', label: 'P', hasPunches: true };
  }

  if (effectivePunches.length === 1) {
    const monthKey = `${employeeId}-${date.substring(0, 7)}`;
    const maxNoCheckoutCount = parseRuleCount(policy.lateMarkCount, 3);
    if (incrementTrackerAndShouldApply(noCheckoutTracker, monthKey, maxNoCheckoutCount)) {
      const markAs = policy.markAs || 'Half Day';
      return {
        type: markAs === 'Absent' ? 'ABSENT' : 'HALF_DAY',
        label: markAs,
        hasPunches: true,
      };
    }
    return { type: 'SINGLE_PUNCH', label: 'no checkout', hasPunches: true };
  }

  const checkinBeginBefore = policy.checkin_begin_before_min || 0;
  const checkoutEndAfter = policy.checkout_end_after_min || 0;
  const shiftStartMinRaw = timeToMinutes(shiftDay.startTime);
  const shiftEndMinRaw = timeToMinutes(shiftDay.endTime);
  const earliestInMin = shiftStartMinRaw - checkinBeginBefore;
  const latestOutMin = shiftSpansMidnight
    ? shiftEndMinRaw + checkoutEndAfter
    : Math.max(shiftEndMinRaw + checkoutEndAfter, otDay ? timeToMinutes(otDay.endTime) : 0);

  const currentDayFiltered = punches.filter((p) => timeToMinutes(p) >= earliestInMin);
  const nextDayFiltered = nextDayPunches.filter((p) => timeToMinutes(p) <= latestOutMin);
  const needsNextDayCheckout =
    currentDayFiltered.length === 0 || currentDayFiltered.length % 2 !== 0;
  const filteredPunches: string[] = shiftSpansMidnight
    ? [...currentDayFiltered, ...(needsNextDayCheckout ? nextDayFiltered : [])]
    : effectivePunches.filter((p) => {
        const t = timeToMinutes(p);
        return t >= earliestInMin && t <= latestOutMin;
      });

  const toNightAware = (t: number) =>
    shiftSpansMidnight && t < earliestInMin ? t + 1440 : t;
  const sortedFiltered = shiftSpansMidnight
    ? [...filteredPunches].sort(
        (a, b) => toNightAware(timeToMinutes(a)) - toNightAware(timeToMinutes(b)),
      )
    : [...filteredPunches].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));

  const effectiveForCalc =
    sortedFiltered.length >= 2
      ? sortedFiltered
      : sortedFiltered.length === 1
        ? sortedFiltered
        : effectivePunches.length > 0
          ? [effectivePunches[0]]
          : [];

  const firstPunch = toNightAware(timeToMinutes(effectiveForCalc[0]));
  const lastPunch = toNightAware(
    timeToMinutes(effectiveForCalc[effectiveForCalc.length - 1]),
  );
  const shiftStartMin = shiftStartMinRaw;
  const shiftEndMin = shiftSpansMidnight ? shiftEndMinRaw + 1440 : shiftEndMinRaw;
  const graceTime = policy.checkin_grace_time_min || 0;
  const maxLateWindowAfterGrace = policy.max_late_check_in_time || 0;
  const graceEnd = shiftStartMin + graceTime;
  const maxLateCutoffInclusive = graceEnd + maxLateWindowAfterGrace;

  if (!isFlexible && firstPunch > maxLateCutoffInclusive) {
    const markAs = policy.maxLateCheckinMarkAs || 'Absent';
    return {
      type: markAs === 'Absent' ? 'ABSENT' : 'HALF_DAY',
      label: markAs,
      hasPunches: true,
    };
  }

  const workedMinutes = calculateWorkedMinutes(
    effectiveForCalc,
    shiftDay.startTime,
    shiftDay.endTime,
    { breakStart: shiftDay.breakStart || '', breakEnd: shiftDay.breakEnd || '' },
    policy,
    isFlexible,
  );
  const halfDayMin = policy.min_work_hours_half_day_min || 0;
  const requiredFullDayMinutes = isFlexible
    ? shiftDay.totalMinutes
    : Math.max(shiftDay.totalMinutes - graceTime, halfDayMin);

  const isLate =
    !isFlexible && firstPunch > graceEnd && firstPunch <= maxLateCutoffInclusive;

  if (isLate) {
    const monthKey = `${employeeId}-${date.substring(0, 7)}`;
    const maxLateCount = parseRuleCount(policy.lateMarkMarkCount || policy.lateMarkCount, 3);
    if (incrementTrackerAndShouldApply(lateMarkTracker, monthKey, maxLateCount)) {
      const markAs = policy.lateMarkMarkAs || policy.markAs || 'Half Day';
      return {
        type: markAs === 'Absent' ? 'ABSENT' : 'HALF_DAY',
        label: markAs,
        hasPunches: true,
        workedMinutes,
      };
    }
  }

  let otMinutes = 0;
  if (otDay && policy.overtimeApplicable) {
    otMinutes = calculateOTMinutes(
      effectiveForCalc,
      shiftDay.endTime,
      { startTime: otDay.startTime, endTime: otDay.endTime },
      policy,
    );
  }

  if (workedMinutes < halfDayMin) {
    return { type: 'ABSENT', label: 'Absent', hasPunches: true, workedMinutes };
  }

  // Early-checkout half-day penalty only applies when an early-checkout window
  // is actually configured (> 0). Previously, with the window left at 0, ANY
  // checkout even a minute before shift end was forced to Half Day — e.g. an
  // employee who worked enough net hours but left slightly early was wrongly
  // marked Half Day. Sufficient worked time is still validated below against
  // requiredFullDayMinutes.
  const earlyCheckoutWindow = policy.earlyCheckoutBeforeEndMin || 0;
  if (
    earlyCheckoutWindow > 0 &&
    effectiveForCalc.length >= 2 &&
    lastPunch < shiftEndMin - earlyCheckoutWindow
  ) {
    return { type: 'HALF_DAY', label: 'Half Day', hasPunches: true, workedMinutes };
  }
  if (workedMinutes < requiredFullDayMinutes && !isLate) {
    return { type: 'HALF_DAY', label: 'Half Day', hasPunches: true, workedMinutes };
  }
  if (otMinutes > 0) {
    return { type: 'OT', label: 'OT', hasPunches: true, workedMinutes };
  }
  if (isLate) {
    return { type: 'LATE_MARK', label: 'Late Mark', hasPunches: true, workedMinutes };
  }
  return { type: 'PRESENT', label: 'P', hasPunches: true, workedMinutes };
}

export function statusDisplayLabel(type: string, label: string): string {
  switch (type) {
    case 'PRESENT':
      return 'Present';
    case 'LATE_MARK':
      return 'Late Mark';
    case 'HALF_DAY':
      return 'Half Day';
    case 'ABSENT':
      return 'Absent';
    case 'WEEK_OFF':
      return 'Week Off';
    case 'HOLIDAY':
      return label === 'PH-P' ? 'Public Holiday (Present)' : 'Public Holiday';
    case 'LEAVE':
      return label;
    case 'REGULARIZATION':
      return `Regularized (${label})`;
    case 'SINGLE_PUNCH':
      return 'No checkout';
    case 'OT':
      return 'Present (OT)';
    default:
      return label || type;
  }
}
