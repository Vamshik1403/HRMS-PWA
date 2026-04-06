"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { FormDrawer } from "../components/ui/form-drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Icon } from "@iconify/react";
import { Plus, Search, Edit, Trash2, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useCurrentUser } from "../hooks/useCurrentUser"
import { toast } from "sonner";

/* =======================
   Types (aligned to API)
   ======================= */

interface SP { id: number; companyName?: string }
interface CO { id: number; companyName?: string; financialYearStart?: string; serviceProviderID?: number }
interface BR { id: number; branchName?: string; companyID?: number; serviceProviderID?: number }
interface Emp {
  id: number
  employeeID?: string
  employeeFirstName?: string
  employeeLastName?: string
  attendancePolicyID?: number
  workShiftID?: number
  monthlyPayGradeID?: number
  companyID?: number
  branchesID?: number
  joiningDate?: string
  exitDate?: string
  // salary fields (various names supported)
  monthlyGrossSalary?: number
  grossSalary?: number
  monthlySalary?: number
  ctcMonthly?: number
  ctc?: number
  salary?: number
  totalSalary?: number
  payrollSalary?: number
  departments?: {
    id: number
    serviceProviderID?: number
    companyID?: number
    branchesID?: number
    departmentName?: string
  }
  designations?: {
    id: number
    serviceProviderID?: number
    companyID?: number
    branchesID?: number
    designation?: string
  }
  employeeBankDetails?: Array<{
    bankName?: string
    bankBranchName?: string
    accNumber?: string
    ifscCode?: string
    upi?: string
  }>
}

interface SalaryAdvanceRepayment {
  id: number;
  salaryAdvanceID: number;
  approvedAmount: string;
  startMonth: string;
  amount: string;
  createdAt: string;
  updatedAt: string;
  salaryAdvance: {
    id: number;
    serviceProviderID: number;
    companyID: number;
    branchesID: number;
    manageEmployeeID: number;
    previousAdvancesDue: string;
    advanceAmount: string;
    reason: string;
    repaymentTanure: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
}

interface GenerateSalaryDTO {
  serviceProviderID?: number | null
  companyID?: number | null
  branchesID?: number | null
  employeeID: number
  monthPeriod: string
}

interface GenerateSalaryRow {
  id: number
  serviceProviderID?: number | null
  companyID?: number | null
  branchesID?: number | null
  employeeID: number
  monthPeriod: string
  status?: string
  serviceProvider?: { companyName?: string }
  company?: { companyName?: string }
  branches?: { branchName?: string }
  manageEmployee?: Emp
  createdAt?: string
}

type SalaryCycleRow = {
  id: number
  companyID: number
  monthStartDay?: string | number | null
  salaryCycleName?: string | null
}

/* =======================
   Constants / helpers
   ======================= */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

const API = {
  sp: "/backend/service-provider",
  co: "/backend/company",
  br: "/backend/branches",
  emp: "/backend/manage-emp",
  salaryCycleByCompany: (companyId: number) => `/backend/salary-cycle/company/${companyId}`,
  generateSalary: "/backend/generate-salary",
  salaryAdvanceRepayment: "/backend/salary-advance-repayment",
  reimbursement: "/backend/reimbursement",
  users: "/backend/users",
  monthlyPayGrade: "/backend/monthly-pay-grade",
  workShift: "/backend/work-shift",
  attendancePolicy: "/backend/attendance-policy",
  publicHoliday: "/backend/public-holiday",
  leaveApplication: "/backend/leave-application",
  empAttendanceRegularise: "/backend/emp-attendance-regularise",
  empAttendanceLogs: "/backend/emp-attendance-logs",
};

const MIN_CHARS = 1;

function empName(e?: Emp | null) {
  const f = (e?.employeeFirstName ?? "").trim();
  const l = (e?.employeeLastName ?? "").trim();
  return [f, l].filter(Boolean).join(" ");
}

const monthsFull = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function clampDay(d: number) {
  if (!Number.isFinite(d)) return 1;
  return Math.max(1, Math.min(28, Math.floor(d)));
}

function buildSalaryPeriodLabels(fyStart?: string | null, dayStr?: string | number | null): string[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const day = clampDay(Number(dayStr ?? 1));
  const fyIsJan = (fyStart ?? "").trim().toLowerCase() === "1st jan";
  const fyIsApr = (fyStart ?? "").trim().toLowerCase() === "1st april";

  const addMonths = (y: number, m: number, delta: number) => {
    const n = m + delta;
    const y2 = y + Math.floor(n / 12);
    const m2 = ((n % 12) + 12) % 12;
    return { y: y2, m: m2 };
  };

  const makeDate = (y: number, m: number, d: number) => new Date(y, m, d);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")} ${monthsFull[d.getMonth()]} ${d.getFullYear()}`;

  if (day === 1) {
    if (fyIsJan) {
      return Array.from({ length: 12 }).map((_, i) => `${monthsFull[i]} ${currentYear}`);
    }
    const out: string[] = [];
    for (let i = 3; i <= 11; i++) out.push(`${monthsFull[i]} ${currentYear}`);
    out.push(`January ${currentYear + 1}`, `February ${currentYear + 1}`, `March ${currentYear + 1}`);
    return out;
  }

  const periods: string[] = [];

  if (fyIsJan) {
    const start0 = makeDate(currentYear - 1, 11, day);
    for (let i = 0; i < 12; i++) {
      const start = addMonths(start0.getFullYear(), start0.getMonth(), i);
      const startDate = makeDate(start.y, start.m, day);
      const end = addMonths(startDate.getFullYear(), startDate.getMonth(), 1);
      const endDate = makeDate(end.y, end.m, day - 1);
      periods.push(`${fmt(startDate)} to ${fmt(endDate)}`);
    }
    return periods;
  }

  const start0 = makeDate(currentYear, 2, day); // March
  for (let i = 0; i < 12; i++) {
    const start = addMonths(start0.getFullYear(), start0.getMonth(), i);
    const startDate = makeDate(start.y, start.m, day);
    const end = addMonths(startDate.getFullYear(), startDate.getMonth(), 1);
    const endDate = makeDate(end.y, end.m, day - 1);
    periods.push(`${fmt(startDate)} to ${fmt(endDate)}`);
  }
  return periods;
}

/* =======================
   Utility functions
   ======================= */

function roundToNearestRupee(amount: number): number {
  return Math.round(amount);
}

const ymd2 = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function parseCycle(label?: string) {
  if (!label || typeof label !== "string") {
    throw new Error(`Invalid month label: ${label}`);
  }

  const monthNum = (name: string) => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const idx = months.findIndex(
      (m) => m.toLowerCase() === name.toLowerCase()
    );
    if (idx === -1) throw new Error(`Unknown month name: ${name}`);
    return String(idx + 1).padStart(2, "0");
  };

  if (!label.includes(" to ")) {
    const [monthName, yearStr] = label.trim().split(" ");
    const year = Number(yearStr);
    if (!monthName || !year) {
      throw new Error(`Invalid month label format: ${label}`);
    }

    const start = new Date(`${year}-${monthNum(monthName)}-01T00:00:00`);
    const end = new Date(year, start.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
  }

  const [left, right] = label.split(" to ").map((s) => s.trim());
  const [sDay, sMonth, sYear] = left.split(" ");
  const [eDay, eMonth, eYear] = right.split(" ");
  const start = new Date(`${sYear}-${monthNum(sMonth)}-${sDay}T00:00:00`);
  const end = new Date(`${eYear}-${monthNum(eMonth)}-${eDay}T23:59:59`);
  return { start, end };
}

function daysIterArray(start: Date, end: Date): Date[] {
  const arr: Date[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    arr.push(new Date(d));
  }
  return arr;
}

/* =======================
   Data helpers (HTTP)
   ======================= */

async function robustGet(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// Add this interface at the top with other interfaces
interface ManagerScope {
  companyID: number | null;
  branchesID: number | null;
  serviceProviderID: number | null;
}

// Update the getManagerAssignedScope function
async function getManagerAssignedScope(username: string): Promise<ManagerScope | null> {
  try {
    const users: any[] = await robustGet(API.users);
    const currentUser = users.find((u: any) => u.username === username);

    if (currentUser && (currentUser.role === "MANAGER" || currentUser.role === "SUPERADMIN")) {
      return {
        companyID: currentUser.companyID || null,
        branchesID: currentUser.branchesID || null,
        serviceProviderID: currentUser.serviceProviderID || null
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching manager scope:", error);
    toast.error("Failed to load data.");
    return null;
  }
}

/* =======================
   Salary calculation helpers
   ======================= */

async function getSalaryAdvanceRepayments(
  employeeId: number,
  selectedMonthLabel: string
): Promise<{ name: string; amount: number }[]> {
  try {
    const { start } = parseCycle(selectedMonthLabel);
    const selectedMonthStart = new Date(start.getFullYear(), start.getMonth(), 1);

    const repayments: SalaryAdvanceRepayment[] = await robustGet(API.salaryAdvanceRepayment);

    const employeeRepayments = repayments.filter(repayment =>
      repayment.salaryAdvance.manageEmployeeID === employeeId
    );

    if (employeeRepayments.length === 0) {
      return [];
    }

    const monthlyRepayments = new Map<string, number>();

    employeeRepayments.forEach(repayment => {
      const repaymentDate = new Date(repayment.startMonth);
      const repaymentMonthStart = new Date(repaymentDate.getFullYear(), repaymentDate.getMonth(), 1);

      if (repaymentMonthStart.getTime() === selectedMonthStart.getTime()) {
        const amount = Number(repayment.amount) || 0;
        const key = repaymentMonthStart.toISOString();

        if (monthlyRepayments.has(key)) {
          monthlyRepayments.set(key, monthlyRepayments.get(key)! + amount);
        } else {
          monthlyRepayments.set(key, amount);
        }
      }
    });

    const deductions: { name: string; amount: number }[] = [];
    monthlyRepayments.forEach((amount, monthKey) => {
      if (amount > 0) {
        deductions.push({
          name: "Salary Advance Repayment",
          amount: Math.round(amount)
        });
      }
    });

    return deductions;

  } catch (error) {
    console.error("Error fetching salary advance repayments:", error);
    toast.error("Failed to load data.");
    return [];
  }
}

async function getMonthlyPayGrade(companyId: number, branchId: number, emp?: any) {
  const grades: any[] = await robustGet(API.monthlyPayGrade);
  if (emp?.monthlyPayGradeID) {
    const g = grades.find(x => x.id === emp.monthlyPayGradeID);
    if (g) return g;
  }
  const g2 = grades.find(x => x.companyID === companyId && x.branchesID === branchId);
  if (!g2) throw new Error("Monthly Pay Grade not found for this company/branch.");
  return g2;
}

async function getCompanyAndBranch(companyId: number, branchId: number) {
  const companies: any[] = await robustGet(API.co);
  const branches: any[] = await robustGet(API.br);
  const company = companies.find((c: any) => c.id === companyId) || {};
  const branch = branches.find((b: any) => b.id === branchId) || {};
  return {
    companyName: company.companyName || company.name || `Company #${companyId}`,
    branchName: branch.branchName || branch.name || `Branch #${branchId}`
  };
}

async function getShiftDays(emp: any) {
  const workShifts: any[] = await robustGet(API.workShift);
  const empShift = workShifts.find(ws => ws.id === emp.workShiftID);
  return empShift?.workShiftDay || [];
}

function countWeeklyOffOccurrences(
  shiftDays: any[],
  start: Date,
  end: Date
) {
  const offNames = new Set(
    shiftDays
      .filter((d: any) => d.weeklyOff)
      .map((d: any) => d.weekDay)
  );

  let count = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const wd = d.toLocaleString("en-US", { weekday: "long" });
    if (offNames.has(wd)) {
      count++;
    }
  }

  return count;
}

async function getHolidayCount(branchId: number, start: Date, end: Date) {
  const holidays: any[] = await robustGet(API.publicHoliday);
  const branchHolidays = holidays.filter((h: any) => h.branchesID === branchId);
  let set = new Set<string>();
  branchHolidays.forEach((h: any) => {
    const hs = new Date(h.startDate), he = new Date(h.endDate);
    for (let d = new Date(hs); d <= he; d.setDate(d.getDate() + 1)) {
      if (d >= start && d <= end) set.add(ymd2(d));
    }
  });
  return set.size;
}

function normalizeDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

async function getLeaveBreakdown(employeeId: number, start: Date, end: Date) {
  const leaves: any[] = await robustGet(API.leaveApplication);
  const empLeaves = leaves.filter(l =>
    l.manageEmployeeID === employeeId &&
    l.status === "Approved"
  );

  let nonLoP = 0, lop = 0;

  empLeaves.forEach(l => {
    const ls = new Date(l.fromDate);
    const le = new Date(l.toDate);

    // Normalize dates for comparison
    const normStart = normalizeDate(start);
    const normEnd = normalizeDate(end);

    // Check if we should use dayStatuses array
    if (l.dayStatuses && Array.isArray(l.dayStatuses)) {
      l.dayStatuses.forEach((dayStatus: any) => {
        const dayDate = normalizeDate(new Date(dayStatus.date));
        if (dayDate >= normStart && dayDate <= normEnd) {
          if (String(dayStatus.status).toLowerCase() === "lop") {
            lop++;
          } else {
            nonLoP++;
          }
        }
      });
      return; // 🔴 CRITICAL: do NOT fall back to date loop
    } else {
      // Fallback to old logic (loop through each day) - ONLY if dayStatuses doesn't exist
      for (let d = new Date(ls); d <= le; d.setDate(d.getDate() + 1)) {
        const currentDate = normalizeDate(d);
        if (currentDate >= normStart && currentDate <= normEnd) {
          if (String(l.appliedLeaveType).toLowerCase() === "lop") {
            lop++;
          } else {
            nonLoP++;
          }
        }
      }
    }
  });

  return { nonLoPDays: nonLoP, lopDays: lop };
}

function getGrossFromEmp(emp: any, grade?: any): number {
  if (emp?.monthlyPayGrade?.grossSalary) {
    const v = Number(emp.monthlyPayGrade.grossSalary);
    if (Number.isFinite(v) && v > 0) {
      return v;
    }
  }

  const fields = [
    "monthlyGrossSalary", "grossSalary", "monthlySalary", "ctcMonthly",
    "ctc", "salary", "totalSalary", "payrollSalary"
  ];
  for (const f of fields) {
    const v = Number(emp?.[f]);
    if (Number.isFinite(v) && v > 0) {
      return v;
    }
  }

  if (grade?.grossSalary) {
    const v = Number(grade.grossSalary);
    if (Number.isFinite(v) && v > 0) {
      return v;
    }
  }

  throw new Error("Gross salary not found (expected on employee or monthly pay grade).");
}

async function getReimbursementAmount(employeeId: number, selectedMonthLabel: string): Promise<number> {
  try {
    const reimbursements: any[] = await robustGet(`${BACKEND_URL}/reimbursement`);
    const { start: periodStart, end: periodEnd } = parseCycle(selectedMonthLabel);

    const employeeReimbursements = reimbursements.filter(reimbursement => {
      if (!reimbursement.date || typeof reimbursement.date !== 'string') return false;

      try {
        const reimbDate = new Date(reimbursement.date);
        if (isNaN(reimbDate.getTime())) return false;

        const overlaps = (
          reimbDate >= periodStart &&
          reimbDate <= periodEnd &&
          reimbursement.manageEmployeeID === employeeId &&
          reimbursement.status === "Approved" &&
          reimbursement.approvalType === "Salary"
        );

        return overlaps;
      } catch (error) {
        console.error("Error parsing reimbursement date:", reimbursement.date, error);
        toast.error("Operation failed. Please try again.");
        return false;
      }
    });

    if (employeeReimbursements.length === 0) {
      return 0;
    }

    let totalAmount = 0;
    employeeReimbursements.forEach(reimbursement => {
      if (reimbursement.items && Array.isArray(reimbursement.items)) {
        reimbursement.items.forEach((item: any) => {
          const amount = Number(item.amount) || 0;
          totalAmount += amount;
        });
      }
    });

    return Math.round(totalAmount);

  } catch (error) {
    console.error("Error fetching reimbursements:", error);
    toast.error("Failed to load data.");
    return 0;
  }
}

/* =======================
   Attendance counter
   ======================= */

async function fetchAllLogs(): Promise<any[]> {
  const all: any[] = [];
  try {
    const res: any[] = await robustGet(API.empAttendanceLogs);
    all.push(...res);
  } catch (err) {
    console.error("Failed to fetch /emp-attendance-logs", err);
    toast.error("Failed to load data.");
  }
  return all;
}

async function calculateSalaryCounts(
  employeeId: number,
  monthLabel: string,
  companyId: number,
  branchId: number,
  effectiveStartParam?: Date
) {
  try {
    const monthNum = (name: string) => {
      const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const idx = months.findIndex(m => m.toLowerCase() === name.toLowerCase());
      return String(idx + 1).padStart(2, "0");
    };

    const toMinutesMaybeHours = (v: any) => {
      const n = Number(v ?? 0);
      if (!Number.isFinite(n)) return 0;
      return n <= 24 ? n * 60 : n;
    };

    const readNum = (obj: any, ...keys: string[]) => {
      for (let k of keys) {
        const raw = obj ? obj[k] : undefined;
        if (raw !== undefined && raw !== null && !isNaN(Number(raw))) return Number(raw);
      }
      return undefined;
    };

    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayName = (d: Date) => d.toLocaleString("en-US", { weekday: "long" });
    const parseCDataTs = (s: string) => (!s ? new Date() : new Date(s.replace(" ", "T")));

    const empList: any[] = await robustGet(API.emp);
    let emp = empList.find((e) => e.id === employeeId) ??
      empList.find((e) => [e.employeeID, e.empId, e.employeeId].includes(employeeId as any));
    if (!emp) throw new Error("Employee not found: " + employeeId);

    let startDate: Date, endDate: Date;

    // parse salary cycle
    if (monthLabel.includes(" to ")) {
      const [l, r] = monthLabel.split(" to ");
      const [sd, sm, sy] = l.trim().split(" ");
      const [ed, em, ey] = r.trim().split(" ");

      startDate = new Date(`${sy}-${monthNum(sm)}-${sd}T00:00:00`);
      endDate = new Date(`${ey}-${monthNum(em)}-${ed}T23:59:59`);
    } else {
      const [mn, yr] = monthLabel.trim().split(" ");
      const mNum = monthNum(mn);

      startDate = new Date(`${yr}-${mNum}-01T00:00:00`);
      endDate = new Date(Number(yr), Number(mNum), 0, 23, 59, 59);
    }

    // Use effectiveStartParam if provided (from computeSalarySlipForRow)
    if (effectiveStartParam) {
      startDate = effectiveStartParam;
    }

    // Still apply joining date check for safety (if not already handled by effectiveStartParam)
    if (!effectiveStartParam && emp.joiningDate) {
      const joiningDate = new Date(emp.joiningDate + "T00:00:00");
      if (joiningDate > startDate) {
        startDate = joiningDate;
      }
    }

    // optional exit date
    if (emp.exitDate) {
      const exitDate = new Date(emp.exitDate + "T23:59:59");
      if (exitDate < endDate) {
        endDate = exitDate;
      }
    }

    const DEBUG_LOP = false; // set to false in production

    const policies: any[] = await robustGet(API.attendancePolicy);
    const policy = policies.find((p: any) => p.id === emp.attendancePolicyID) ?? {};
    const workingType = (policy?.workingHoursType ?? "").toLowerCase();
    const isFlexible = workingType.includes("flex");
    const checkinBeginBeforeMin = readNum(policy, "checkin_begin_before_min", "checkinBeginBeforeMin") ?? 0;
    const checkoutEndAfterMin = readNum(policy, "checkout_end_after_min", "checkoutEndAfterMin") ?? 0;
    const checkinGraceMin = readNum(policy, "checkin_grace_time_min", "checkinGraceTimeMin") ?? 0;
    const earlyCheckoutBeforeEndMin = readNum(policy, "early_checkout_before_end_min", "earlyCheckoutBeforeEndMin") ?? 0;
    const maxLateCheckInMin = readNum(policy, "max_late_check_in_time", "maxLateCheckInTime") ?? 0;
    const halfDayMin = toMinutesMaybeHours(readNum(policy, "min_work_hours_half_day_min", "minWorkHoursHalfDayMin") ?? 0);
    const lateMarkCount = Number(policy?.lateMarkCount ?? 0);
    const markAsAction = (policy?.markAs ?? "Half Day").toString().toLowerCase();

    const workShifts: any[] = await robustGet(API.workShift);
    const empShift = workShifts.find((ws: any) => ws.id === emp.workShiftID);
    if (!empShift) return null;
    const shiftDays: any[] = empShift.workShiftDay ?? [];
    const weeklyOffDays = new Set(shiftDays.filter((d: any) => d.weeklyOff).map((d: any) => d.weekDay));

    const getShiftFrame = (d: Date) => {
      const dayOfWeek = dayName(d);
      const sd = shiftDays.find((x: any) => x.weekDay === dayOfWeek);
      if (!sd) return null;
      const st = new Date(sd.startTime), et = new Date(sd.endTime);
      const shiftStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), st.getUTCHours(), st.getUTCMinutes());
      let shiftEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), et.getUTCHours(), et.getUTCMinutes());
      if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);
      const earliestIn = new Date(shiftStart.getTime() - checkinBeginBeforeMin * 60000);
      const latestOut = new Date(shiftEnd.getTime() + checkoutEndAfterMin * 60000);
      const graceEnd = new Date(shiftStart.getTime() + checkinGraceMin * 60000);
      const lateEnd = new Date(shiftStart.getTime() + (checkinGraceMin + maxLateCheckInMin) * 60000);
      const earlyOutStart = new Date(shiftEnd.getTime() - earlyCheckoutBeforeEndMin * 60000);
      const fullMinutes = Math.round((shiftEnd.getTime() - shiftStart.getTime()) / 60000);
      return { shiftStart, shiftEnd, earliestIn, latestOut, graceEnd, lateEnd, earlyOutStart, fullMinutes, weekDay: sd.weekDay };
    };

    const holidays: any[] = await robustGet(API.publicHoliday);
    const branchHolidays = holidays.filter((h: any) => h.branchesID === branchId);
    const holidaySet = new Set<string>();
    for (const h of branchHolidays) {
      const hs = new Date(h.startDate), he = new Date(h.endDate);
      for (let d = new Date(hs); d <= he; d.setDate(d.getDate() + 1)) if (d >= startDate && d <= endDate) holidaySet.add(ymd(d));
    }

    const leaves: any[] = await robustGet(API.leaveApplication);
    const empLeaves = leaves.filter(
      (l) =>
        l.manageEmployeeID === employeeId &&
        l.status === "Approved"   // 🔥 ONLY approved leaves affect salary
    );
    const leaveMap = new Map<string, any>();
    for (const lv of empLeaves) {
      const ls = new Date(lv.fromDate), le = new Date(lv.toDate);
      for (let d = new Date(ls); d <= le; d.setDate(d.getDate() + 1)) {
        if (d >= startDate && d <= endDate) {
          leaveMap.set(ymd(d), lv);
        }
      }
    }

    const regs: any[] = await robustGet(API.empAttendanceRegularise);
    const empRegs = regs.filter((r) => r.manageEmployeeID === employeeId && r.status === "Approved");
    const regulariseMap = new Map<string, any>();
    for (const r of empRegs) regulariseMap.set(ymd(new Date(r.attendanceDate)), r);

    const allLogs = await fetchAllLogs();
    const logs = allLogs.filter((l: any) => String(l.employeeID) === String(emp.id) || String(l.employeeID) === String(emp.employeeID))
      .map((l: any) => ({ ...l, t: parseCDataTs(l.punchTimeStamp) }))
      .filter((l: any) => l.t >= startDate && l.t <= endDate)
      .sort((a: any, b: any) => a.t.getTime() - b.t.getTime());
    const logsByDate = new Map<string, Date[]>();
    for (const l of logs) {
      const key = ymd(l.t);
      if (!logsByDate.has(key)) logsByDate.set(key, []);
      logsByDate.get(key)!.push(l.t);
    }

    let flex_fullDayPresent = 0, flex_halfDayPresent = 0, flex_absent = 0, lateMarksUsed = 0;

    // Loop through each day in the effective period
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = ymd(d);

      const debug: any = {
        date: key,
        weeklyOff: false,
        holiday: false,
        leave: null,
        regularise: null,
        logs: 0,
        final: null,
      };

      const todayWeekDay = dayName(d);
      
      // Check if it's a weekly off day
      if (weeklyOffDays.has(todayWeekDay)) {
        // ✅ Weekly off days are ALWAYS PAID (regardless of joining date)
        // The startDate is already adjusted to joining date, so any weekly off
        // within the loop range is after/before joining date
        debug.weeklyOff = true;
        flex_fullDayPresent++; // Weekly off counts as a paid day!
        debug.final = "WEEKLY_OFF → PAID (FULL DAY)";
        if (DEBUG_LOP) console.table([debug]);
        continue;
      }

      const frame = getShiftFrame(d);
      if (!frame) continue;

      // Check if it's a holiday
      if (holidaySet.has(key)) {
        debug.holiday = true;
        debug.final = "HOLIDAY → PAID";
        flex_fullDayPresent++;
        if (DEBUG_LOP) console.table([debug]);
        continue;
      }

      // Check for regularised days
      if (regulariseMap.has(key)) {
        const r = regulariseMap.get(key);
        debug.regularise = {
          status: r.status,
          day: r.day,
          source: "emp-attendance-regularise",
        };

        const dayType = String(r.day ?? "").toLowerCase();
        if (dayType === "fullday" || dayType === "full day") {
          flex_fullDayPresent++;
          debug.final = "REGULARISE → FULL PAID";
        } else if (dayType === "halfday" || dayType === "half day") {
          flex_halfDayPresent++;
          debug.final = "REGULARISE → HALF PAID";
        } else {
          flex_absent++;
          debug.final = "REGULARISE → ABSENT";
        }

        if (DEBUG_LOP) console.table([debug]);
        continue;
      }

      // Check for leaves
      if (leaveMap.has(key)) {
        const lv = leaveMap.get(key);

        // ✅ ONLY approved leaves affect salary
        if (lv.status === "Approved") {
          debug.leave = {
            status: lv.status,
            type: lv.appliedLeaveType,
            source: "leave-application",
          };

          if (String(lv.appliedLeaveType).toLowerCase() === "lop") {
            flex_absent++;              // ← COUNT AS LOP
            debug.final = "LEAVE → LOP";
          } else {
            flex_fullDayPresent++;      // ← PAID LEAVE
            debug.final = "LEAVE → PAID";
          }

          if (DEBUG_LOP) console.table([debug]);
          continue; // 🔴 STOP HERE — DO NOT FALL INTO ATTENDANCE
        }

        // ⛔ Pending / Rejected leave → IGNORE, attendance will decide
      }

      // Check attendance logs for the day
      const dayLogs = (logsByDate.get(key) || []).filter(t => t >= frame.earliestIn && t <= frame.latestOut);
      let dayStatus: "full" | "half" | "absent" = "absent";

      if (isFlexible) {
        // Flexible working hours
        if (dayLogs.length < 2) {
          dayStatus = "absent";
        } else {
          dayLogs.sort((a, b) => a.getTime() - b.getTime());
          const totalWorkedMinutes = Math.round((dayLogs[dayLogs.length - 1].getTime() - dayLogs[0].getTime()) / 60000);
          if (totalWorkedMinutes < halfDayMin) {
            dayStatus = "absent";
          } else if (totalWorkedMinutes >= frame.fullMinutes) {
            dayStatus = "full";
          } else {
            dayStatus = "half";
          }
        }
      } else {
        // Fixed working hours
        if (dayLogs.length >= 2) {
          dayLogs.sort((a, b) => a.getTime() - b.getTime());
          const totalWorkedMinutes = Math.round((dayLogs[dayLogs.length - 1].getTime() - dayLogs[0].getTime()) / 60000);
          const firstPunch = dayLogs[0];
          const lastPunch = dayLogs[dayLogs.length - 1];
          const isLateMark = firstPunch > frame.graceEnd && firstPunch <= frame.lateEnd;
          const isVeryLate = firstPunch > frame.lateEnd;
          const isEarlyCheckout = lastPunch < frame.earlyOutStart && lastPunch >= frame.shiftStart;

          if (totalWorkedMinutes < halfDayMin) dayStatus = "absent";
          else if (isEarlyCheckout) dayStatus = "half";
          else if (isVeryLate) dayStatus = totalWorkedMinutes >= halfDayMin ? "half" : "absent";
          else {
            let todayViolations = 0;
            if (isLateMark) todayViolations++;
            if (isEarlyCheckout) todayViolations++;
            if (todayViolations > 0 && lateMarkCount > 0) {
              if (lateMarksUsed + todayViolations >= lateMarkCount) {
                dayStatus = markAsAction.includes("absent") ? "absent" : "half";
                lateMarksUsed = 0;
              } else {
                lateMarksUsed += todayViolations;
                dayStatus = "full";
              }
            } else dayStatus = "full";
          }
        } else {
          dayStatus = "absent";
        }
      }

      debug.logs = (logsByDate.get(key) || []).length;
      if (dayStatus === "full") {
        flex_fullDayPresent++;
        debug.final = "ATTENDANCE → FULL";
      } else if (dayStatus === "half") {
        flex_halfDayPresent++;
        debug.final = "ATTENDANCE → HALF";
      } else {
        flex_absent++;
        debug.final = "ATTENDANCE → ABSENT";
      }

      if (DEBUG_LOP) console.table([debug]);
    }

    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    return {
      startDate: startDate.toDateString(),
      endDate: endDate.toDateString(),
      totalDays,
      flex_fullDayPresent,
      flex_halfDayPresent,
      flex_absent,
      lateMarksUsed,
      lateMarkCount
    };
  } catch (err) {
    console.error("Error in calculateSalaryCounts:", err);
    toast.error("Operation failed. Please try again.");
    return null;
  }
}

type SalarySlipComputed = {
  companyName: string
  branchName: string
  employee: any
  monthLabel: string
  start: Date
  end: Date
  cycleDays: number
  paidUnits: number
  lopDays: number
  nonLoPLeaveDays: number
  weeklyOffDays: number
  holidays: number
  halfDaysUnits: number
  gross: number
  basic: number
  earnings: { name: string; amount: number }[]
  deductions: { name: string; amount: number }[]
  lopAmount: number
  earningsTotal: number
  deductionsTotal: number
  netPay: number
  perDayGross: number
  perDayBasic: number
  proRatedGross: number
  totalWorkingDaysInCycle: number
}

/* =======================
   PDF generation
   ======================= */

function downloadSalarySlipPDF(payload: {
  companyName: string;
  branchName: string;
  employee: any;
  monthLabel: string;
  start: Date;
  end: Date;
  cycleDays: number;
  paidUnits: number;
  lopDays: number;
  nonLoPLeaveDays: number;
  weeklyOffDays: number;
  holidays: number;
  halfDaysUnits: number;
  gross: number;
  basic: number;
  earnings: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
  lopAmount: number;
  earningsTotal: number;
  deductionsTotal: number;
  netPay: number;
  perDayGross: number;
  perDayBasic: number;
  proRatedGross: number;
  totalWorkingDaysInCycle: number;
}) {

  function numberToWords(amount: number): string {
    const ones = [
      "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
      "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
      "Sixteen", "Seventeen", "Eighteen", "Nineteen"
    ];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    function numToWords(n: number): string {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
      if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + numToWords(n % 100) : "");
      if (n < 100000) return numToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + numToWords(n % 1000) : "");
      if (n < 10000000) return numToWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + numToWords(n % 100000) : "");
      return numToWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + numToWords(n % 10000000) : "");
    }

    const [rupees, paise] = amount.toFixed(2).split(".").map(Number);
    let words = `Rupees ${numToWords(rupees)}`;
    if (paise > 0) words += ` and ${numToWords(paise)} Paise`;
    return words + " Only";
  }

  try {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.width;
    const gray: [number, number, number] = [100, 60, 150];
    let y = 15;

    const companyName = payload.companyName || payload.employee?.company?.companyName;
    const companyAddress = payload.employee?.company?.address || "Head Office";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text(companyName, pageWidth / 2, 20, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(companyAddress, pageWidth / 2, 25, { align: "center" });

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("Salary Slip", pageWidth / 2, 38, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Branch: ${payload.branchName}`, 15, 45);
    doc.text(
      `Period: ${payload.start.toDateString()} - ${payload.end.toDateString()}`,
      pageWidth - 15,
      45,
      { align: "right" }
    );

    const empName = `${payload.employee.employeeFirstName || ""} ${payload.employee.employeeLastName || ""}`.trim();
    const dept = payload.employee.departments?.departmentName || "N/A";
    const desg = payload.employee.designations?.designation || "N/A";

    const actualPaidDays = payload.paidUnits;

    autoTable(doc, {
      startY: 47,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, lineWidth: 0.1 },
      headStyles: { fillColor: gray, textColor: [255, 255, 255], halign: "center" },
      body: [
        ["Employee ID", payload.employee.employeeID || "-", "Name", empName],
        ["Department", dept, "Designation", desg],
        ["Joining Date", payload.employee.joiningDate || "-", "Working Days", payload.totalWorkingDaysInCycle],
        ["Paid Days", actualPaidDays.toFixed(2), "LOP Days", payload.lopDays.toFixed(2)],
        ["Monthly Gross", `₹ ${payload.gross.toLocaleString()}`, "Per-Day Rate", `₹ ${payload.perDayGross.toFixed(2)}`],
      ],
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 60 },
        2: { cellWidth: 30 },
        3: { cellWidth: 60 },
      },
      margin: { left: 15 },
      tableWidth: pageWidth - 30,
    });

    y = (doc as any).lastAutoTable.finalY + 5;

    // Calculation Summary
    autoTable(doc, {
      startY: y,
      theme: "plain",
      styles: { fontSize: 8, cellPadding: 1 },
      body: [
        ["📊 Calculation Summary:", ""],
        ["Monthly Gross:", `₹ ${payload.gross.toLocaleString()}`],
        ["Working Days in Month:", `${payload.totalWorkingDaysInCycle}`],
        ["Paid Days:", `${payload.paidUnits.toFixed(2)}`],
        ["Pro-rate Ratio:", `${payload.paidUnits.toFixed(2)}/${payload.totalWorkingDaysInCycle} = ${((payload.paidUnits / payload.totalWorkingDaysInCycle) * 100).toFixed(1)}%`],
        ["Per-Day Rate:", `₹ ${payload.gross.toLocaleString()} ÷ ${payload.totalWorkingDaysInCycle} = ₹ ${payload.perDayGross.toFixed(2)}`],
        ["LOP Amount:", `₹ ${payload.perDayGross.toFixed(2)} × ${payload.lopDays.toFixed(2)} = ₹ ${payload.lopAmount}`],
      ],
      margin: { left: 15 },
      tableWidth: pageWidth - 30,
    });

    y = (doc as any).lastAutoTable.finalY + 5;

    const earningsRows = [
      ["Basic Pay (50%)", `₹ ${payload.basic.toFixed(2)}`],
      ...payload.earnings.map((e: any) => [e.name, `₹ ${e.amount.toFixed(2)}`]),
      ["Total Earnings", `₹ ${payload.earningsTotal.toFixed(2)}`],
    ];

    const dedRows = [
      ...payload.deductions.map((d: any) => [d.name, `₹ ${d.amount.toFixed(2)}`]),
      ["Loss of Pay", `₹ ${payload.lopAmount.toFixed(2)}`],
      ["Total Deductions", `₹ ${(payload.deductionsTotal + payload.lopAmount).toFixed(2)}`],
    ];

    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 9, lineWidth: 0.1 },
      headStyles: { fillColor: gray, textColor: [255, 255, 255], halign: "center" },
      head: [
        [
          { content: "Earnings", colSpan: 2, styles: { halign: "center" } },
          { content: "Deductions", colSpan: 2, styles: { halign: "center" } },
        ],
      ],
      body: (() => {
        const rows: any[] = [];
        const max = Math.max(earningsRows.length, dedRows.length);
        for (let i = 0; i < max; i++) {
          rows.push([
            earningsRows[i]?.[0] || "",
            earningsRows[i]?.[1] || "",
            dedRows[i]?.[0] || "",
            dedRows[i]?.[1] || "",
          ]);
        }
        return rows;
      })(),
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 40 },
        2: { cellWidth: 40 },
        3: { cellWidth: 40 },
      },
      margin: { left: 15 },
      tableWidth: pageWidth - 30,
    });

    y = (doc as any).lastAutoTable.finalY + 5;

    // Final Calculation
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 10, lineWidth: 0.1, halign: "center" },
      headStyles: { fillColor: gray, textColor: [255, 255, 255] },
      head: [["Final Calculation", "Amount"]],
      body: [
        ["Total Earnings", `₹ ${payload.earningsTotal.toFixed(2)}`],
        ["Total Deductions", `₹ ${(payload.deductionsTotal + payload.lopAmount).toFixed(2)}`],
        ["Net Pay", `₹ ${payload.netPay.toFixed(0)}`],
      ],
      margin: { left: 15 },
      tableWidth: pageWidth - 30,
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(
      `Net Payable (in words): ${numberToWords(payload.netPay)}`,
      15,
      y
    );

    y += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);

    // Calculation breakdown
    doc.text(`Calculation: Monthly Gross ₹${payload.gross.toLocaleString()} × ${payload.paidUnits.toFixed(2)}/${payload.totalWorkingDaysInCycle} = Pro-rated Amount`, 15, y);
    y += 4;
    doc.text(`Per-Day Rate: ₹${payload.gross.toLocaleString()} ÷ ${payload.totalWorkingDaysInCycle} = ₹${payload.perDayGross.toFixed(2)}`, 15, y);
    y += 4;
    doc.text(`LOP: ₹${payload.perDayGross.toFixed(2)} × ${payload.lopDays.toFixed(2)} = ₹${payload.lopAmount}`, 15, y);

    y += 15;
    doc.setDrawColor(0);
    doc.line(30, y, 80, y);
    doc.line(pageWidth - 80, y, pageWidth - 30, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Employer's Signature", 35, y + 5);
    doc.text("Employee's Signature", pageWidth - 85, y + 5);

    y += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text("This is a system generated document.", pageWidth / 2, y, { align: "center" });
    doc.text(`Generated on: ${new Date().toLocaleDateString("en-IN")}`, pageWidth / 2, y + 4, { align: "center" });

    const fn = `Salary_Slip_${payload.employee.employeeID || payload.employee.id}_${payload.start.getFullYear()}_${(
      payload.start.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}.pdf`;
    doc.save(fn);
  }
  catch (err) {
    console.error("Error generating salary slip:", err);
    toast.error("Error generating salary slip. Please check console for details.");
  }
}

/* =======================
   Salary slip computation (CORRECTED - SIMPLE PRO-RATION)
   ======================= */

async function computeSalarySlipForRow(
  row: GenerateSalaryRow
): Promise<SalarySlipComputed> {

  const employeeId = Number(row.employeeID)
  const companyId = Number(row.companyID)
  const branchId = Number(row.branchesID)
  const monthLabel = row.monthPeriod

  const empList: any[] = await robustGet(API.emp)
  const emp = empList.find((e: any) => e.id === employeeId)
  if (!emp) throw new Error("Employee not found")

  const { start: cycleStart, end: cycleEnd } = parseCycle(monthLabel)

  /* ===============================
     JOINING DATE ADJUSTMENT
  =============================== */

  let effectiveStart = cycleStart
  let effectiveEnd = cycleEnd

  if (emp.joiningDate) {
    const joiningDate = new Date(emp.joiningDate + "T00:00:00")
    if (joiningDate > cycleStart) {
      effectiveStart = joiningDate
    }
  }

  /* ===============================
     ✅ CALENDAR DAYS (NEW)
  =============================== */

  const totalCalendarDaysInMonth =
    Math.floor((cycleEnd.getTime() - cycleStart.getTime()) / 86400000) + 1

  const totalPaidCalendarDays =
    Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / 86400000) + 1

  /* ===============================
     KEEP YOUR EXISTING ATTENDANCE
  =============================== */

  const shiftDays = await getShiftDays(emp)

  const weeklyOffDaysEffective =
    countWeeklyOffOccurrences(shiftDays, effectiveStart, effectiveEnd)

  const holidaysEffective =
    await getHolidayCount(branchId, effectiveStart, effectiveEnd)

  const counts = await calculateSalaryCounts(
    employeeId,
    monthLabel,
    companyId,
    branchId,
    effectiveStart,
  )
  if (!counts) throw new Error("Could not compute attendance counts")

  const fullDays = Number(counts.flex_fullDayPresent || 0)
  const halfDays = Number(counts.flex_halfDayPresent || 0)
  const absentDays = Number(counts.flex_absent || 0)

  /* ===============================
     ✅ PAID DAYS (CALENDAR BASED)
  =============================== */

  const totalPaidDays = totalPaidCalendarDays
  const totalLopEquivalentDays = absentDays + halfDays * 0.5

  /* ===============================
     SALARY BASE
  =============================== */

  const grade = await getMonthlyPayGrade(companyId, branchId, emp)
  const { companyName, branchName } =
    await getCompanyAndBranch(companyId, branchId)

  const monthlyGross = getGrossFromEmp(emp)

  /* ===============================
     ✅ PER DAY & RATIO (CALENDAR)
  =============================== */

  const perDayGrossForLop =
    monthlyGross / totalCalendarDaysInMonth

  const proRateRatio =
    totalPaidDays / totalCalendarDaysInMonth

  /* ===============================
     FULL MONTH COMPONENTS
  =============================== */

  const fullMonthBasic = Math.round(monthlyGross * 0.50)

  const fullMonthAllowances: { name: string, amount: number }[] = []
  const allowanceList = grade?.monthlyPayGradeAllowanceList || []

  allowanceList.forEach((item: any) => {
    const a = item.salaryAllowance || {}
    const name = (a.salaryAllowanceName || "").trim()
    const type = (a.salaryAllowanceType || "").toLowerCase()
    const value = Number(a.salaryAllowanceValue || 0)
    let amt = 0

    if (type === "fixed") amt = value
    else {
      const base = name.toLowerCase().includes("hra")
        ? fullMonthBasic
        : monthlyGross
      amt = Math.round((base * value) / 100)
    }

    fullMonthAllowances.push({ name, amount: amt })
  })

  const fullMonthDeductions: { name: string; amount: number }[] = []
  const deductionList = grade?.monthlyPayGradeDeductionList || []

  deductionList.forEach((item: any) => {
    const d = item.salaryDeduction || {}
    const name = (d.salaryDeductionName || "").trim()
    const type = (d.salaryDeductionType || "").toLowerCase()
    const value = Number(d.salaryDeductionValue || 0)
    let amt = 0

    if (type === "fixed") amt = value
    else {
      const base = name.toLowerCase().includes("pf")
        ? fullMonthBasic
        : monthlyGross
      amt = Math.round((base * value) / 100)
    }

    fullMonthDeductions.push({ name, amount: amt })
  })

  /* ===============================
     PRO-RATE COMPONENTS
  =============================== */

  const proRatedBasic =
    Math.round(fullMonthBasic * proRateRatio)

  const proRatedAllowances = fullMonthAllowances.map(a => ({
    name: a.name,
    amount: Math.round(a.amount * proRateRatio)
  }))

  const reimbursementAmount =
    await getReimbursementAmount(employeeId, monthLabel)

  if (reimbursementAmount > 0) {
    proRatedAllowances.push({
      name: "Reimbursement",
      amount: reimbursementAmount
    })
  }

  const proRatedDeductions = fullMonthDeductions.map(d => ({
    name: d.name,
    amount: Math.round(d.amount * proRateRatio)
  }))

  const advanceRepayments =
    await getSalaryAdvanceRepayments(employeeId, monthLabel)

  advanceRepayments.forEach(repayment => {
    proRatedDeductions.push({
      name: repayment.name,
      amount: Math.round(repayment.amount)   // ❌ NOT prorated
    })
  })

  /* ===============================
     LOP AFTER NET
  =============================== */

  const lopAmount =
    Math.round(perDayGrossForLop * totalLopEquivalentDays)

  const totalAllowances =
    proRatedAllowances.reduce((s, a) => s + a.amount, 0)

  const totalEarnings =
    proRatedBasic + totalAllowances

  const totalDeductions =
    proRatedDeductions.reduce((s, d) => s + d.amount, 0)

  const netBeforeLop =
    totalEarnings - totalDeductions

  const netPay = roundToNearestRupee(
    Math.max(0, netBeforeLop - lopAmount)
  )

  const proRatedGross =
    monthlyGross * proRateRatio

  /* ===============================
     RETURN
  =============================== */

  return {
    companyName,
    branchName,
    employee: emp,
    monthLabel,
    start: effectiveStart,
    end: effectiveEnd,
    cycleDays: totalPaidCalendarDays,
    paidUnits: Number(totalPaidDays.toFixed(2)),
    lopDays: Number(totalLopEquivalentDays.toFixed(2)),
    nonLoPLeaveDays: 0,
    weeklyOffDays: weeklyOffDaysEffective,
    holidays: holidaysEffective,
    halfDaysUnits: Number((halfDays * 0.5).toFixed(2)),
    gross: monthlyGross,
    basic: proRatedBasic,
    earnings: proRatedAllowances,
    deductions: proRatedDeductions,
    lopAmount,
    earningsTotal: Math.round(totalEarnings),
    deductionsTotal: Math.round(totalDeductions),
    netPay,
    perDayGross: perDayGrossForLop,
    perDayBasic: perDayGrossForLop * 0.50,
    proRatedGross,
    totalWorkingDaysInCycle: totalCalendarDaysInMonth
  }
}

/* =======================
   Component (Rest of the component remains the same)
   ======================= */

export function GenerateSalaryManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GenerateSalaryRow | null>(null);
  const [salaryPeriod, setSalaryPeriod] = useState("");

  const user = useCurrentUser()
  const [items, setItems] = useState<GenerateSalaryRow[]>([])
  const canManage = user?.role === "SUPERADMIN" || user?.role === "MANAGER"

  const [spList, setSpList] = useState<SP[]>([]);
  const [coList, setCoList] = useState<CO[]>([]);
  const [brList, setBrList] = useState<BR[]>([]);
  const [empList, setEmpList] = useState<Emp[]>([]);
  const [spLoading, setSpLoading] = useState(false);
  const [coLoading, setCoLoading] = useState(false);
  const [brLoading, setBrLoading] = useState(false);
  const [empLoading, setEmpLoading] = useState(false);
  const spRef = useRef<HTMLDivElement | null>(null);
  const coRef = useRef<HTMLDivElement | null>(null);
  const brRef = useRef<HTMLDivElement | null>(null);
  const empRef = useRef<HTMLDivElement | null>(null);

  const [selectedCompanyFYStart, setSelectedCompanyFYStart] = useState<string | null>(null);
  const [selectedCompanyStartDay, setSelectedCompanyStartDay] = useState<string>("1");
  const [salaryPeriodOptions, setSalaryPeriodOptions] = useState<string[]>([]);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [viewSlipOpen, setViewSlipOpen] = useState(false)
  const [viewSlipData, setViewSlipData] = useState<SalarySlipComputed | null>(null)

  const [selectedSalaryRow, setSelectedSalaryRow] = useState<GenerateSalaryRow | null>(null);

  const [paymentMode, setPaymentMode] = useState<string>("Cash");
  const [paymentType, setPaymentType] = useState<string>("Cash");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [paymentRemark, setPaymentRemark] = useState<string>("");
  const [paymentProof, setPaymentProof] = useState<string>("");
  const [employeeBankDetails, setEmployeeBankDetails] = useState<any | null>(null);
  const [isLoadingBankDetails, setIsLoadingBankDetails] = useState(false);

  // Add manager scope state
  const [managerScope, setManagerScope] = useState<ManagerScope | null>(null);

  interface FormData {
    serviceProviderID: number | null;
    companyID: number | null;
    branchesID: number | null;
    spAutocomplete: string;
    coAutocomplete: string;
    brAutocomplete: string;
    employeeDbID: number | null;
    employeeAutocomplete: string;
    monthLabel: string;
  }

  const [formData, setFormData] = useState<FormData>({
    serviceProviderID: null,
    companyID: null,
    branchesID: null,
    spAutocomplete: "",
    coAutocomplete: "",
    brAutocomplete: "",
    employeeDbID: null,
    employeeAutocomplete: "",
    monthLabel: "",
  });

  // Fetch manager scope on component mount
  useEffect(() => {
    const fetchManagerScope = async () => {
      if (user?.username) {
        const scope = await getManagerAssignedScope(user.username);
        setManagerScope(scope);

        // Auto-fill form data for MANAGER
        if (scope && user.role === "MANAGER") {
          setFormData(prev => ({
            ...prev,
            serviceProviderID: scope.serviceProviderID,
            companyID: scope.companyID,
            branchesID: scope.branchesID
          }));

          // Fetch company and branch names for display
          if (scope.companyID) {
            try {
              const companies = await robustGet(API.co);
              const company = companies.find((c: any) => c.id === scope.companyID);
              if (company) {
                setFormData(prev => ({
                  ...prev,
                  coAutocomplete: company.companyName || ""
                }));
              }
            } catch (error) {
              console.error("Error fetching company name:", error);
              toast.error("Failed to load data.");
            }
          }

          if (scope.branchesID) {
            try {
              const branches = await robustGet(API.br);
              const branch = branches.find((b: any) => b.id === scope.branchesID);
              if (branch) {
                setFormData(prev => ({
                  ...prev,
                  brAutocomplete: branch.branchName || ""
                }));

                // Auto-populate service provider ID from branch
                if (branch.serviceProviderID) {
                  setFormData(prev => ({
                    ...prev,
                    serviceProviderID: branch.serviceProviderID
                  }));

                  // Fetch service provider name
                  const serviceProviders = await robustGet(API.sp);
                  const sp = serviceProviders.find((sp: any) => sp.id === branch.serviceProviderID);
                  if (sp) {
                    setFormData(prev => ({
                      ...prev,
                      spAutocomplete: sp.companyName || ""
                    }));
                  }
                }
              }
            } catch (error) {
              console.error("Error fetching branch name:", error);
              toast.error("Failed to load data.");
            }
          }
        }
      }
    };

    fetchManagerScope();
  }, [user]);

  // Close popovers on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (spRef.current && !spRef.current.contains(t)) setSpList([]);
      if (coRef.current && !coRef.current.contains(t)) setCoList([]);
      if (brRef.current && !brRef.current.contains(t)) setBrList([]);
      if (empRef.current && !empRef.current.contains(t)) setEmpList([]);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // Load salary periods when company is selected
  useEffect(() => {
    if (formData.companyID) {
      (async () => {
        await refreshCompanyDrivenOptions(formData.companyID!);
      })();
    }
  }, [formData.companyID]);

  // Fetch all salary records
  async function fetchAll() {
    try {
      const raw = await robustGet(API.generateSalary)
      const allItems: GenerateSalaryRow[] = Array.isArray(raw) ? raw : (raw?.data ?? [])

      if (user?.role === "SUPERADMIN") {
        setItems(allItems)
        return
      }

      if (user?.role === "MANAGER") {
        const users = await robustGet(API.users)
        const currentUser = users.find((u: any) => u.username === user.username)
        if (currentUser) {
          const filtered = allItems.filter(
            (r) =>
              r.companyID === currentUser.companyID &&
              r.branchesID === currentUser.branchesID
          )
          setItems(filtered)
          return
        }
      }

      const creds = await robustGet(`${BACKEND_URL}/manage-emp/credentials/all`);
      const emp = user ? creds.find((c: any) => c.username === user.username) : null;

      if (emp) {
        const filtered = allItems.filter((r: any) =>
          r.companyID === emp.companyID &&
          r.branchesID === emp.branchesID &&
          (
            r.manageEmployeeID === emp.employeeID ||
            r.manageEmployee?.id === emp.employeeID ||
            r.employeeID === emp.employeeID
          ) &&
          r.status === "Paid"
        );
        setItems(filtered);
      } else {
        setItems([]);
      }

    } catch (e) {
      console.error("Failed to load GenerateSalary:", e)
      toast.error("Failed to load data.");
    }
  }

  useEffect(() => {
    if (user) fetchAll()
  }, [user])

  // Payment dialog functions
  async function openPaymentDialog(row: GenerateSalaryRow) {
    setSelectedSalaryRow(row);
    setIsPaymentDialogOpen(true);
    setPaymentMode("Cash");
    setPaymentType("Cash");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentRemark("");
    setPaymentProof("");
    setEmployeeBankDetails(null);

    if (row.manageEmployee?.id) {
      try {
        setIsLoadingBankDetails(true);
        const allEmployees = await robustGet(API.emp);
        const employee = allEmployees.find((e: any) => e.id === row.manageEmployee?.id);

        if (employee && employee.employeeBankDetails?.length > 0) {
          const bankDetails = employee.employeeBankDetails[0];
          setEmployeeBankDetails(bankDetails);

          if (bankDetails.upi) {
            setPaymentMode("Bank");
            setPaymentType("UPI");
          }
        } else {
          setEmployeeBankDetails(null);
        }
      } catch (err) {
        console.error("Error fetching employee bank details from manage-emp:", err);
        toast.error("Failed to load data.");
      } finally {
        setIsLoadingBankDetails(false);
      }
    }
  }

  async function handlePaymentSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedSalaryRow) return;

    const payload = {
      ...selectedSalaryRow,
      paymentMode,
      paymentType,
      paymentDate,
      paymentRemark,
      paymentProof,
    };

    delete payload.manageEmployee;
    delete payload.serviceProvider;
    delete payload.company;
    delete payload.branches;

    try {
      const res = await fetch(`/backend/generate-salary/${selectedSalaryRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());
      toast.success("Payment marked successfully!");
      setIsPaymentDialogOpen(false);
      fetchAll();
    } catch (error) {
      console.error("Payment update failed:", error);
      toast.error("Payment update failed: " + (error as any).message);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.employeeDbID || !formData.monthLabel) return;

    const payload: GenerateSalaryDTO = {
      serviceProviderID: formData.serviceProviderID ?? undefined,
      companyID: formData.companyID ?? undefined,
      branchesID: formData.branchesID ?? undefined,
      employeeID: formData.employeeDbID,
      monthPeriod: formData.monthLabel
    };

    try {
      const res = await fetch(
        editing ? `${API.generateSalary}/${editing.id}` : API.generateSalary,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      await fetchAll();
      resetForm();
      setIsDialogOpen(false);
      toast.success(editing ? "Updated successfully" : "Created successfully");
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Failed to save. Please try again.");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this record?")) return;
    try {
      const res = await fetch(`${API.generateSalary}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await fetchAll();
      toast.success("Deleted successfully");
    } catch (e) {
      console.error("Delete failed:", e);
      toast.error("Failed to delete. Please try again.");
    }
  }

  function resetForm() {
    const baseForm: FormData = {
      serviceProviderID: null,
      companyID: null,
      branchesID: null,
      spAutocomplete: "",
      coAutocomplete: "",
      brAutocomplete: "",
      employeeDbID: null,
      employeeAutocomplete: "",
      monthLabel: "",
    };

    // Set defaults based on role
    if (user?.role === "MANAGER" && managerScope) {
      baseForm.companyID = managerScope.companyID;
      // Don't auto-set branch for MANAGER - let them choose
    }

    setFormData(baseForm);
    setEditing(null);
    setSelectedCompanyFYStart(null);
    setSelectedCompanyStartDay("1");
    setSalaryPeriodOptions([]);
    setSpList([]);
    setCoList([]);
    setBrList([]);
    setEmpList([]);
  }

  async function beginEdit(row: GenerateSalaryRow) {
    setEditing(row);

    const newFormData = {
      serviceProviderID: row.serviceProviderID ?? null,
      companyID: row.companyID ?? null,
      branchesID: row.branchesID ?? null,
      spAutocomplete: row.serviceProvider?.companyName ?? "",
      coAutocomplete: row.company?.companyName ?? "",
      brAutocomplete: row.branches?.branchName ?? "",
      employeeDbID: row.employeeID ?? null,
      employeeAutocomplete: row.manageEmployee ? `${empName(row.manageEmployee)} (${row.manageEmployee.employeeID ?? ""})` : "",
      monthLabel: row.monthPeriod,
    };

    setFormData(newFormData);

    if (row.companyID) {
      try {
        await refreshCompanyDrivenOptions(row.companyID);
      } catch (error) {
        console.error("Failed to refresh company options:", error);
        toast.error("Operation failed. Please try again.");
      }
    } else {
      setSelectedCompanyFYStart(null);
      setSelectedCompanyStartDay("1");
      setSalaryPeriodOptions([]);
    }

    setIsDialogOpen(true);
  }

  /* ====== Suggestions ====== */
  const runFetchSP = async (q: string) => {
    if (!q || q.length < MIN_CHARS) return setSpList([]);
    setSpLoading(true);
    try {
      const data: SP[] = await robustGet(API.sp);
      setSpList(
        data.filter(sp =>
          (sp.companyName ?? "").toLowerCase().includes(q.toLowerCase())
        )
      );
    } finally {
      setSpLoading(false);
    }
  };

  const runFetchCO = async (q: string) => {
    if (!q || q.length < MIN_CHARS) {
      setCoList([]);
      return;
    }

    setCoLoading(true);
    try {
      let data: CO[] = await robustGet(API.co);
      let filtered: CO[] = [];

      if (user?.role === "SUPERADMIN") {
        // SUPERADMIN: Only show companies if service provider is selected
        if (formData.serviceProviderID) {
          filtered = data.filter(co =>
            co.serviceProviderID === formData.serviceProviderID &&
            (co.companyName ?? "").toLowerCase().includes(q.toLowerCase())
          );
        } else {
          // No service provider selected, show no companies
          filtered = [];
        }
      }
      else if (user?.role === "MANAGER") {
        // MANAGER: Only show their assigned company
        if (managerScope?.companyID) {
          filtered = data.filter(co =>
            co.id === managerScope.companyID &&
            (co.companyName ?? "").toLowerCase().includes(q.toLowerCase())
          );

          // Auto-set company for MANAGER if not already set
          if (filtered.length > 0 && !formData.companyID) {
            const managerCompany = filtered[0];
            setFormData(prev => ({
              ...prev,
              companyID: managerCompany.id,
              coAutocomplete: managerCompany.companyName || ""
            }));

            // Load company options
            await refreshCompanyDrivenOptions(managerCompany.id);
          }
        }
      }
      else {
        // Other roles (if any)
        filtered = [];
      }

      setCoList(filtered);
    } finally {
      setCoLoading(false);
    }
  };

  const runFetchBR = async (q: string) => {
    if (!q || q.length < MIN_CHARS) {
      setBrList([]);
      return;
    }

    setBrLoading(true);
    try {
      let data: BR[] = await robustGet(API.br);

      // Filter based on company for SUPERADMIN
      if (user?.role === "SUPERADMIN") {
        if (formData.companyID) {
          data = data.filter(b => b.companyID === formData.companyID);
        } else {
          // If no company selected, show all but indicate company required
          setBrList([]);
          return;
        }
      }

      // For MANAGER, show branches from their assigned company only
      if (user?.role === "MANAGER" && managerScope?.companyID) {
        data = data.filter(b => b.companyID === managerScope.companyID);
      }

      const low = q.toLowerCase();
      const filtered = data.filter(b =>
        (b.branchName ?? "").toLowerCase().includes(low)
      );

      setBrList(filtered);
    } finally {
      setBrLoading(false);
    }
  };

  const runFetchEmp = async (q: string) => {
    if (q.length < 1) {
      setEmpList([]);
      return;
    }

    // Check if we have the required filters
    let shouldFetch = false;
    let companyId = null;
    let branchId = null;

    if (user?.role === "SUPERADMIN") {
      // SUPERADMIN needs both company and branch
      if (formData.companyID && formData.branchesID) {
        shouldFetch = true;
        companyId = formData.companyID;
        branchId = formData.branchesID;
      }
    } else if (user?.role === "MANAGER") {
      // MANAGER needs at least branch (company is auto-filled)
      if (formData.branchesID && managerScope?.companyID) {
        shouldFetch = true;
        companyId = managerScope.companyID;
        branchId = formData.branchesID;
      }
    }

    if (!shouldFetch) {
      setEmpList([]);
      return;
    }

    setEmpLoading(true);
    try {
      const data: Emp[] = await robustGet(API.emp);

      const filtered = data.filter(e =>
        e.companyID === companyId &&
        e.branchesID === branchId
      );

      const low = q.toLowerCase();
      const searched = filtered.filter(
        e =>
          empName(e).toLowerCase().includes(low) ||
          (e.employeeID ?? "").toLowerCase().includes(low)
      );

      setEmpList(searched);
    } finally {
      setEmpLoading(false);
    }
  };

  async function refreshCompanyDrivenOptions(companyId: number) {
    try {
      const company: CO = await robustGet(`${API.co}/${companyId}`);
      const fy = company?.financialYearStart ?? "1st April";
      setSelectedCompanyFYStart(fy);

      const rows: SalaryCycleRow[] = await robustGet(API.salaryCycleByCompany(companyId));
      const scoped = Array.isArray(rows) ? rows.filter(r => Number(r.companyID) === Number(companyId)) : [];

      if (!scoped.length) {
        setSelectedCompanyStartDay("1");
        setSalaryPeriodOptions([]);
        setFormData((p) => ({ ...p, monthLabel: "" }));
        return;
      }

      scoped.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
      const day = String(scoped[0]?.monthStartDay ?? "1");
      setSelectedCompanyStartDay(day);

      const opts = buildSalaryPeriodLabels(fy, day);
      setSalaryPeriodOptions(opts);
      setFormData((p) => (opts.includes(p.monthLabel) ? p : { ...p, monthLabel: "" }));
    } catch (e) {
      console.error("Failed to refresh company options:", e);
      toast.error("Operation failed. Please try again.");
      setSelectedCompanyFYStart(null);
      setSelectedCompanyStartDay("1");
      setSalaryPeriodOptions([]);
      setFormData((p) => ({ ...p, monthLabel: "" }));
    }
  }

  // NEW: Auto-populate service provider and company when branch is selected
  const handleBranchSelect = async (branchId: number, branchName: string) => {
    try {
      const branches: BR[] = await robustGet(API.br);
      const selectedBranch = branches.find(b => b.id === branchId);

      if (selectedBranch) {
        let serviceProviderName = "";
        let companyName = "";

        // Get service provider name
        if (selectedBranch.serviceProviderID) {
          const serviceProviders: SP[] = await robustGet(API.sp);
          const sp = serviceProviders.find((sp: SP) => sp.id === selectedBranch.serviceProviderID);
          serviceProviderName = sp?.companyName || "";
        }

        // Get company name
        if (selectedBranch.companyID) {
          const companies: CO[] = await robustGet(API.co);
          const company = companies.find((c: CO) => c.id === selectedBranch.companyID);
          companyName = company?.companyName || "";
        }

        // Update form data
        const updates: Partial<FormData> = {
          branchesID: branchId,
          brAutocomplete: branchName,
        };

        // Only update SP for SUPERADMIN
        if (user?.role === "SUPERADMIN") {
          updates.serviceProviderID = selectedBranch.serviceProviderID || null;
          updates.spAutocomplete = serviceProviderName;
        }

        // Update company for both roles
        updates.companyID = selectedBranch.companyID || null;
        updates.coAutocomplete = companyName;

        setFormData(prev => ({ ...prev, ...updates }));

        // Refresh salary periods if company is selected
        if (selectedBranch.companyID) {
          await refreshCompanyDrivenOptions(selectedBranch.companyID);
        }
      }

      setBrList([]);
    } catch (error) {
      console.error("Error handling branch selection:", error);
      toast.error("Operation failed. Please try again.");
    }
  };

  async function handleDownloadSalarySlipForRow(row: GenerateSalaryRow) {
    try {
      const computed = await computeSalarySlipForRow(row)
      downloadSalarySlipPDF({
        ...computed,
        perDayGross: computed.perDayGross || 0,
        perDayBasic: computed.perDayBasic || 0,
        proRatedGross: computed.proRatedGross || 0,
        totalWorkingDaysInCycle: computed.totalWorkingDaysInCycle || 0
      })
    } catch (err) {
      console.error(err)
      toast.error("Error generating salary slip")
    }
  }

  async function handleViewSalarySlip(row: GenerateSalaryRow) {
    try {
      const computed = await computeSalarySlipForRow(row)
      setViewSlipData(computed)
      setViewSlipOpen(true)
    } catch (err) {
      console.error(err)
      toast.error("Unable to preview salary slip")
    }
  }

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return items;
    return items.filter((g) =>
      (g.serviceProvider?.companyName ?? "").toLowerCase().includes(q) ||
      (g.company?.companyName ?? "").toLowerCase().includes(q) ||
      (g.branches?.branchName ?? "").toLowerCase().includes(q) ||
      empName(g.manageEmployee).toLowerCase().includes(q) ||
      (g.monthPeriod ?? "").toLowerCase().includes(q)
    );
  }, [items, searchTerm]);

  function SalarySlipPreview({ data }: { data: SalarySlipComputed }) {
    const actualPaidDays = data.paidUnits
    const fullMonthDays = data.totalWorkingDaysInCycle
    const perDayRateForLop = data.gross / fullMonthDays
    const proRateRatio = actualPaidDays / fullMonthDays

    return (
      <div className="space-y-4 text-sm">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-lg font-bold">{data.companyName}</h2>
          <p className="text-xs text-gray-600">{data.branchName}</p>
          <p className="font-semibold mt-1">Salary Slip</p>
        </div>

        {/* Employee Info */}
        <table className="w-full border text-sm">
          <tbody>
            <tr>
              <td className="border p-2 font-medium">Employee</td>
              <td className="border p-2">
                {data.employee.employeeFirstName} {data.employee.employeeLastName}
              </td>
              <td className="border p-2 font-medium">Period</td>
              <td className="border p-2">{data.monthLabel}</td>
            </tr>
            <tr>
              <td className="border p-2 font-medium">Joining Date</td>
              <td className="border p-2">
                {data.employee.joiningDate || "N/A"}
              </td>
              <td className="border p-2 font-medium">Working Days</td>
              <td className="border p-2">
                {fullMonthDays} (Full Month)
              </td>
            </tr>
            <tr>
              <td className="border p-2 font-medium">Paid Days</td>
              <td className="border p-2">{actualPaidDays.toFixed(2)}</td>
              <td className="border p-2 font-medium">LOP Days</td>
              <td className="border p-2">{data.lopDays.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="border p-2 font-medium">Pro-rate Ratio</td>
              <td className="border p-2">
                {actualPaidDays.toFixed(2)} / {fullMonthDays} = {(proRateRatio * 100).toFixed(1)}%
              </td>
              <td className="border p-2 font-medium">Monthly Gross</td>
              <td className="border p-2">₹ {data.gross.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        {/* Calculation Summary */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">📊 Salary Calculation Breakdown</h3>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <p><span className="font-medium">Monthly Gross:</span> ₹ {data.gross.toLocaleString()}</p>
                <p><span className="font-medium">Full Month Working Days:</span> {fullMonthDays}</p>
                <p><span className="font-medium">Paid Days Ratio:</span> {(proRateRatio * 100).toFixed(1)}%</p>
              </div>
              <div>
                <p><span className="font-medium">Per-Day Rate (for LOP):</span> ₹ {perDayRateForLop.toFixed(2)}</p>
                <p><span className="font-medium">LOP Amount:</span> ₹ {data.lopAmount}</p>
                <p><span className="font-medium">Net Pay:</span> ₹ {data.netPay}</p>
              </div>
            </div>
            <div className="border-t pt-2">
              <p className="font-medium">Salary Calculation Formula:</p>
              <p className="text-green-600">
                All salary components pro-rated by {(proRateRatio * 100).toFixed(1)}%
              </p>
              <p className="font-medium mt-1">LOP Deduction:</p>
              <p className="text-red-600">
                Full Day LOP: ₹ {perDayRateForLop.toFixed(2)} × {data.lopDays.toFixed(2)} days = ₹ {data.lopAmount}
              </p>
              <p className="text-red-600 text-sm">
                (Half days count as 0.5 day × per-day rate)
              </p>
            </div>
          </div>
        </div>

        {/* Earnings & Deductions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <table className="w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Earnings</th>
                <th className="border p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-2">Basic (50% of pro-rated gross)</td>
                <td className="border p-2 text-right">₹ {data.basic}</td>
              </tr>
              {data.earnings.map((e, i) => (
                <tr key={i}>
                  <td className="border p-2">{e.name}</td>
                  <td className="border p-2 text-right">₹ {e.amount}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="border p-2">Total Earnings</td>
                <td className="border p-2 text-right">₹ {data.earningsTotal}</td>
              </tr>
            </tbody>
          </table>

          <table className="w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Deductions</th>
                <th className="border p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.deductions.map((d, i) => (
                <tr key={i}>
                  <td className="border p-2">{d.name}</td>
                  <td className="border p-2 text-right">₹ {d.amount}</td>
                </tr>
              ))}
              <tr>
                <td className="border p-2">Loss of Pay</td>
                <td className="border p-2 text-right">₹ {data.lopAmount}</td>
              </tr>
              <tr className="font-semibold">
                <td className="border p-2">Total Deductions</td>
                <td className="border p-2 text-right">
                  ₹ {data.deductionsTotal + data.lopAmount}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Final Calculation */}
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-700">Total Earnings</p>
              <p className="text-lg">₹ {data.earningsTotal}</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">Minus</p>
              <p className="text-lg">-</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Total Deductions</p>
              <p className="text-lg">₹ {data.deductionsTotal + data.lopAmount}</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">Equals</p>
              <p className="text-lg">=</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Net Pay</p>
              <p className="text-2xl font-bold text-green-700">₹ {data.netPay}</p>
            </div>
          </div>
        </div>

        {/* Verification Calculation */}
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">✅ CALCULATION VERIFICATION</h3>
          <div className="text-xs space-y-1">
            <p>Full Month Gross: <span className="font-medium">₹ {data.gross.toLocaleString()}</span></p>
            <p>Paid days ratio: <span className="font-medium">{actualPaidDays.toFixed(2)} / {fullMonthDays} = {(proRateRatio * 100).toFixed(1)}%</span></p>
            <p>All salary components pro-rated by: <span className="font-medium">{(proRateRatio * 100).toFixed(1)}%</span></p>
            <p>Per-day rate for LOP: <span className="font-medium">₹ {data.gross.toLocaleString()} ÷ {fullMonthDays} = ₹ {perDayRateForLop.toFixed(2)}</span></p>
            <p>LOP deduction: <span className="font-medium">₹ {perDayRateForLop.toFixed(2)} × {data.lopDays.toFixed(2)} = ₹ {data.lopAmount}</span></p>
            <p className="font-bold text-green-700">Final Net Pay: ₹ {data.netPay} ✅</p>
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center">
          This is a system generated salary slip.
        </p>
      </div>
    )
  }

  return (
    <>
      <FormDrawer open={viewSlipOpen} onOpenChange={setViewSlipOpen} title={"Salary Slip Preview"} description={""}>
          {viewSlipData ? (
            <SalarySlipPreview data={viewSlipData} />
          ) : (
            <div className="text-sm text-gray-500">Loading…</div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setViewSlipOpen(false)}>
              Close
            </Button>
            {viewSlipData && (
              <Button onClick={() => downloadSalarySlipPDF(viewSlipData)}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            )}
          </div>
        
      </FormDrawer>

      <FormDrawer open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen} title={"Make Payment"} description={""}>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {selectedSalaryRow && (
              <form onSubmit={handlePaymentSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <Label>Employee</Label>
                    <p className="font-semibold">{empName(selectedSalaryRow.manageEmployee)}</p>
                  </div>
                  <div>
                    <Label>Month</Label>
                    <p className="font-semibold">{selectedSalaryRow.monthPeriod}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Payment Mode *</Label>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant={paymentMode === "Cash" ? "default" : "outline"}
                      onClick={() => {
                        setPaymentMode("Cash");
                        setPaymentType("Cash");
                      }}
                      className="flex-1"
                    >
                      Cash
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMode === "Bank" ? "default" : "outline"}
                      onClick={async () => {
                        setPaymentMode("Bank");
                        setPaymentType("Bank Transfer");

                        if (selectedSalaryRow.manageEmployee?.id) {
                          try {
                            setIsLoadingBankDetails(true);
                            const allEmployees = await robustGet(API.emp);
                            const employee = allEmployees.find(
                              (e: any) => e.id === selectedSalaryRow.manageEmployee?.id
                            );

                            if (employee && employee.employeeBankDetails?.length > 0) {
                              const bankDetails = employee.employeeBankDetails[0];
                              setEmployeeBankDetails(bankDetails);

                              if (bankDetails.upi) {
                                setPaymentType("UPI");
                              }
                            } else {
                              setEmployeeBankDetails(null);
                            }
                          } catch (err) {
                            console.error("Error fetching employee bank details:", err);
                            toast.error("Failed to load data.");
                          } finally {
                            setIsLoadingBankDetails(false);
                          }
                        }
                      }}
                      className="flex-1"
                    >
                      Bank
                    </Button>
                  </div>
                </div>

                {paymentMode === "Bank" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Payment Type *</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {["Cheque", "UPI", "Bank Transfer"].map((type) => (
                        <Button
                          key={type}
                          type="button"
                          variant={paymentType === type ? "default" : "outline"}
                          onClick={() => setPaymentType(type)}
                          className="py-2"
                        >
                          {type}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {paymentMode === "Bank" && isLoadingBankDetails && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
                    <Icon icon="mdi:loading" className="w-5 h-5 animate-spin mx-auto text-blue-600" />
                    <p className="text-sm text-gray-600 mt-2">Loading employee bank details...</p>
                  </div>
                )}

                {paymentMode === "Bank" &&
                  !isLoadingBankDetails &&
                  !employeeBankDetails && (
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-sm text-yellow-800">
                      No bank details found for this employee. Please contact HR to update.
                    </div>
                  )}

                {paymentMode === "Bank" && employeeBankDetails && (
                  <>
                    {paymentType === "Bank Transfer" && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h4 className="font-semibold text-green-800 mb-3">
                          Employee Bank Details
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label>Bank Name</Label>
                            <p className="font-semibold text-green-900">
                              {employeeBankDetails.bankName || "N/A"}
                            </p>
                          </div>
                          <div>
                            <Label>Branch Name</Label>
                            <p className="font-semibold text-green-900">
                              {employeeBankDetails.bankBranchName || "N/A"}
                            </p>
                          </div>
                          <div>
                            <Label>Account Number</Label>
                            <p className="font-semibold text-green-900">
                              {employeeBankDetails.accNumber || "N/A"}
                            </p>
                          </div>
                          <div>
                            <Label>IFSC Code</Label>
                            <p className="font-semibold text-green-900">
                              {employeeBankDetails.ifscCode || "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {paymentType === "UPI" && (
                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <h4 className="font-semibold text-purple-800 mb-3">
                          Employee UPI Details
                        </h4>
                        <Label>UPI ID</Label>
                        <p className="text-lg font-semibold text-purple-900">
                          {employeeBankDetails.upi || "N/A"}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {paymentMode === "Bank" && (
                  <div>
                    <Label>
                      {paymentType === "Cheque"
                        ? "Cheque Number *"
                        : paymentType === "UPI"
                          ? "UTR Number *"
                          : "Transaction Reference *"}
                    </Label>
                    <Input
                      value={paymentProof}
                      onChange={(e) => setPaymentProof(e.target.value)}
                      required={paymentMode === "Bank"}
                      placeholder="Enter reference / cheque / UTR number"
                      className="border-gray-300 focus:border-blue-500"
                    />
                  </div>
                )}

                <div>
                  <Label>Payment Date *</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="border-gray-300 focus:border-blue-500"
                  />
                </div>

                <div>
                  <Label>Remark</Label>
                  <Input
                    value={paymentRemark}
                    onChange={(e) => setPaymentRemark(e.target.value)}
                    placeholder="Optional remark"
                    className="border-gray-300 focus:border-blue-500"
                  />
                </div>
              </form>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsPaymentDialogOpen(false)}
              className="border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePaymentSubmit}
              className="bg-green-600 hover:bg-green-700"
              disabled={paymentMode === "Bank" && !employeeBankDetails}
            >
              <Icon icon="mdi:check-circle" className="w-4 h-4 mr-2" />
              Mark as Paid
            </Button>
          </div>
        
      </FormDrawer>

      <div className="space-y-6 w-full max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between w-full">
          <div className="min-w-0 flex-1">
            <p className="text-gray-600 mt-1 text-sm">Generate and manage employee salary payments</p>
          </div>

          {canManage && (
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="bg-gray-900 hover:bg-gray-800 flex-shrink-0 text-sm px-3 py-2">
              <Plus className="w-4 h-4 mr-1" />
              Add Salary Generation
            </Button>
          )}

          <FormDrawer open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }} title={editing ? "Edit Salary Generation" : "Add New Salary Generation"} description={editing ? "Update the salary generation information below." : "Fill in the details to add a new salary generation."}>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Organization Selection</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Service Provider - Only for SUPERADMIN */}
                    {user?.role === "SUPERADMIN" && (
                      <div ref={spRef} className="space-y-2 relative">
                        <Label>Service Provider *</Label>
                        <Input
                          value={formData.spAutocomplete}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((p) => ({
                              ...p,
                              spAutocomplete: val,
                              serviceProviderID: null,
                              // Clear dependent fields when SP changes
                              companyID: null,
                              coAutocomplete: "",
                              branchesID: null,
                              brAutocomplete: "",
                              employeeDbID: null,
                              employeeAutocomplete: "",
                            }));
                            runFetchSP(val);
                          }}
                          onFocus={(e) => {
                            const val = e.target.value;
                            if (val.length >= MIN_CHARS) runFetchSP(val);
                          }}
                          placeholder="Start typing service provider…"
                          autoComplete="off"
                          required
                        />
                        {spList.length > 0 && (
                          <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                            {spLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                            {spList.map((sp) => (
                              <div
                                key={sp.id}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setFormData((p) => ({
                                    ...p,
                                    serviceProviderID: sp.id,
                                    spAutocomplete: sp.companyName ?? ""
                                  }));
                                  setSpList([]);
                                }}
                              >
                                {sp.companyName}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Company - ONLY for SUPERADMIN */}
                    {user?.role === "SUPERADMIN" && (
                      <div ref={coRef} className="space-y-2 relative">
                        <Label>Company Name *</Label>
                        <Input
                          value={formData.coAutocomplete}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((p) => ({
                              ...p,
                              coAutocomplete: val,
                              companyID: null,
                              // Clear dependent fields when company changes
                              branchesID: null,
                              brAutocomplete: "",
                              employeeDbID: null,
                              employeeAutocomplete: "",
                            }));
                            runFetchCO(val);
                          }}
                          onFocus={(e) => {
                            const val = e.target.value;
                            if (val.length >= MIN_CHARS) runFetchCO(val);
                          }}
                          placeholder="Start typing company…"
                          autoComplete="off"
                          required
                        />

                        {coList.length > 0 && (
                          <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                            {coLoading && (
                              <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>
                            )}
                            {coList.map((co) => (
                              <div
                                key={co.id}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={async () => {
                                  setFormData((p) => ({
                                    ...p,
                                    companyID: co.id,
                                    coAutocomplete: co.companyName ?? ""
                                  }));
                                  setCoList([]);
                                  await refreshCompanyDrivenOptions(co.id);
                                }}
                              >
                                {co.companyName}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Branch - Always visible, but MANAGER can only see their assigned branch */}
                    <div
                      ref={brRef}
                      className="space-y-2 relative"
                      style={{
                        gridColumn: user?.role === "MANAGER" ? "span 3" : "span 1"
                      }}
                    >
                      <Label>Branch Name *</Label>
                      <Input
                        value={formData.brAutocomplete}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((p) => ({ ...p, brAutocomplete: val, branchesID: null }));

                          // Only fetch suggestions when user types (minimum 1 character)
                          if (val.length >= 1) {
                            runFetchBR(val);
                          } else {
                            setBrList([]); // Clear suggestions when input is empty
                          }
                        }}
                        onFocus={(e) => {
                          // Only show suggestions if there's already text in the input
                          if (formData.brAutocomplete.length >= 1) {
                            runFetchBR(formData.brAutocomplete);
                          }
                        }}
                        placeholder="Start typing branch…"
                        autoComplete="off"
                      />
                      {brList.length > 0 && (
                        <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                          {brLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                          {brList.map((br) => (
                            <div
                              key={br.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={async () => {
                                await handleBranchSelect(br.id, br.branchName || "");
                                setBrList([]); // Clear suggestions after selection
                              }}
                            >
                              {br.branchName}
                            </div>
                          ))}
                        </div>
                      )}
                      {user?.role === "MANAGER" && (
                        <p className="text-xs text-gray-500">You can only select from your assigned branches</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Employee Selection</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                    <div ref={empRef} className="space-y-2 col-span-3 md:col-span-3 relative">
                      <Label>Select Employee *</Label>
                      <Input
                        value={formData.employeeAutocomplete}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((p) => ({ ...p, employeeAutocomplete: val, employeeDbID: null }));
                          runFetchEmp(val);
                        }}
                        onFocus={(e) => {
                          const val = e.target.value;
                          if (val.length >= MIN_CHARS) runFetchEmp(val);
                        }}
                        placeholder="Type name or employee code…"
                        autoComplete="off"
                        required
                      />
                      {empList.length > 0 && (
                        <div className="absolute z-10 bg-white border rounded w-full shadow max-h-56 overflow-y-auto">
                          {empLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                          {empList.map((emp) => {
                            const name = empName(emp) || "(No name)";
                            return (
                              <div
                                key={emp.id}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setFormData((p) => ({
                                    ...p,
                                    employeeDbID: emp.id,
                                    employeeAutocomplete: `${name} (${emp.employeeID ?? ""})`,
                                  }));
                                  setEmpList([]);
                                }}
                              >
                                {name} <span className="text-gray-500">({emp.employeeID})</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-xs text-gray-500">
                        {user?.role === "MANAGER"
                          ? "Employees from your assigned branch only"
                          : "Fetched from /manage-emp"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Salary Period</h3>
                  <div className="space-y-2">
                    <Label htmlFor="month">Select Month *</Label>
                    <select
                      id="month"
                      value={formData.monthLabel}
                      onChange={(e) => setFormData((p) => ({ ...p, monthLabel: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      disabled={!formData.companyID}
                    >
                      <option value="">
                        {formData.companyID
                          ? (salaryPeriodOptions.length ? "Select Period" : "No cycle found for company")
                          : "Select Company first"}
                      </option>
                      {salaryPeriodOptions.map((lbl) => (
                        <option key={lbl} value={lbl}>{lbl}</option>
                      ))}
                    </select>

                    {formData.companyID ? (
                      <p className="text-xs text-gray-500">
                        FY start: <b>{selectedCompanyFYStart ?? "-"}</b>; Day: <b>{selectedCompanyStartDay}</b>
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">Pick a company to load its salary periods.</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-gray-900 hover:bg-gray-800">
                    {editing ? "Update Salary Generation" : "Add Salary Generation"}
                  </Button>
                </div>
              </form>
            
          </FormDrawer>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4 w-full">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search generated salaries…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
              <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
                {filtered.length} records
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon icon="mdi:cash-check" className="w-5 h-5" />
              Salary Generation List
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 w-full">
            <div className="overflow-x-auto w-full">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Service Provider</TableHead>
                    <TableHead className="w-[160px]">Company</TableHead>
                    <TableHead className="w-[160px]">Branch</TableHead>
                    <TableHead className="w-[180px]">Employee</TableHead>
                    <TableHead className="w-[160px]">Month Period</TableHead>
                    <TableHead className="w-[100px] text-center">Status</TableHead>
                    <TableHead className="w-[140px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <Icon icon="mdi:cash-check" className="w-12 h-12 text-gray-300" />
                          <p>No records found</p>
                          <p className="text-sm">Try adjusting your search criteria</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">{row.serviceProvider?.companyName ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.company?.companyName ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.branches?.branchName ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {row.manageEmployee ? `${empName(row.manageEmployee)} (${row.manageEmployee.employeeID ?? ""})` : "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{row.monthPeriod}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={row.status === "Paid" ? "default" : "secondary"}>
                            {row.status || "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {canManage && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openPaymentDialog(row)}
                                  className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <Icon icon="mdi:credit-card-outline" className="w-4 h-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => beginEdit(row)}
                                  className="h-7 w-7 p-0"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(row.id)}
                                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            )}

                            <Button
                              onClick={() => handleViewSalarySlip(row)}
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                            >
                              <Icon icon="mdi:eye-outline" className="w-4 h-4" />
                            </Button>

                            <Button
                              onClick={() => handleDownloadSalarySlipForRow(row)}
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                            >
                              <Download className="w-3 h-3" />
                            </Button>

                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}