"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Icon } from "@iconify/react";
import { Plus, Search, Edit, Trash2, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useCurrentUser } from "../hooks/useCurrentUser"


/* =======================
   Types (aligned to API)
   ======================= */

interface SP { id: number; companyName?: string }
interface CO { id: number; companyName?: string; financialYearStart?: string }
interface BR { id: number; branchName?: string }
interface Emp {
  id: number
  employeeID?: string
  employeeFirstName?: string
  employeeLastName?: string
  attendancePolicyID?: number
  workShiftID?: number
  monthlyPayGradeID?: number
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
    designation?: string  // Note: typo in API field name
  }
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

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const API = {
  sp: "http://localhost:8000/service-provider",
  co: "http://localhost:8000/company",
  br: "http://localhost:8000/branches",
  emp: "http://localhost:8000/manage-emp",
  salaryCycleByCompany: (companyId: number) => `http://localhost:8000/salary-cycle/company/${companyId}`,
  generateSalary: "http://localhost:8000/generate-salary",
  salaryAdvanceRepayment: "http://localhost:8000/salary-advance-repayment", // Add this
  reimbursement: "http://localhost:8000/reimbursement", // Add this
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

/**
 * Build 12 salary-period labels based on FY start and cycle day.
 */
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

/** Parse "DD Month YYYY to DD Month YYYY" → start/end Date */
/**
 * parseCycle() — safely handles both "Month YYYY" and "DD Month YYYY to DD Month YYYY"
 */
function parseCycle(label?: string) {
  if (!label || typeof label !== "string") {
    throw new Error(`Invalid month label: ${label}`);
  }

  // Helper: month name → number
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

  // ✅ Case 1: Label like "October 2025"
  if (!label.includes(" to ")) {
    const [monthName, yearStr] = label.trim().split(" ");
    const year = Number(yearStr);
    if (!monthName || !year) {
      throw new Error(`Invalid month label format: ${label}`);
    }

    // start: first day of month, end: last day of same month
    const start = new Date(`${year}-${monthNum(monthName)}-01T00:00:00`);
    const end = new Date(year, start.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
  }

  // ✅ Case 2: Label like "01 October 2025 to 31 October 2025"
  const [left, right] = label.split(" to ").map((s) => s.trim());
  const [sDay, sMonth, sYear] = left.split(" ");
  const [eDay, eMonth, eYear] = right.split(" ");
  const start = new Date(`${sYear}-${monthNum(sMonth)}-${sDay}T00:00:00`);
  const end = new Date(`${eYear}-${monthNum(eMonth)}-${eDay}T23:59:59`);
  return { start, end };
}



/** SAFE inclusive date iterator returning array (avoids generator/downlevel issues) */
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

/* =======================
   Salary calculation helpers
   ======================= */


async function getSalaryAdvanceRepayments(
  employeeId: number,
  selectedMonthLabel: string
): Promise<{ name: string; amount: number }[]> {
  try {
    // Parse the selected month to get the start date
    const { start } = parseCycle(selectedMonthLabel);
    const selectedMonthStart = new Date(start.getFullYear(), start.getMonth(), 1); // First day of the month

    // Fetch all repayments
    const repayments: SalaryAdvanceRepayment[] = await robustGet(API.salaryAdvanceRepayment);

    // Filter repayments for this employee and matching month
    const employeeRepayments = repayments.filter(repayment =>
      repayment.salaryAdvance.manageEmployeeID === employeeId
    );

    if (employeeRepayments.length === 0) {
      return [];
    }

    // Group by startMonth and sum amounts for the same month
    const monthlyRepayments = new Map<string, number>();

    employeeRepayments.forEach(repayment => {
      const repaymentDate = new Date(repayment.startMonth);
      const repaymentMonthStart = new Date(repaymentDate.getFullYear(), repaymentDate.getMonth(), 1);

      // Check if this repayment matches the selected month
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

    // Convert to deduction format
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
    return [];
  }
}

/** Find a monthly pay grade for company + branch (or by emp.monthlyPayGradeID if present) */
async function getMonthlyPayGrade(companyId: number, branchId: number, emp?: any) {
  const grades: any[] = await robustGet("http://localhost:8000/monthly-pay-grade");
  if (emp?.monthlyPayGradeID) {
    const g = grades.find(x => x.id === emp.monthlyPayGradeID);
    if (g) return g;
  }
  const g2 = grades.find(x => x.companyID === companyId && x.branchesID === branchId);
  if (!g2) throw new Error("Monthly Pay Grade not found for this company/branch.");
  return g2;
}

/** Get company + branch names */
async function getCompanyAndBranch(companyId: number, branchId: number) {
  const companies: any[] = await robustGet("http://localhost:8000/company");
  const branches: any[] = await robustGet("http://localhost:8000/branches");
  const company = companies.find((c: any) => c.id === companyId) || {};
  const branch = branches.find((b: any) => b.id === branchId) || {};
  return {
    companyName: company.companyName || company.name || `Company #${companyId}`,
    branchName: branch.branchName || branch.name || `Branch #${branchId}`
  };
}

/** Get shift-days for an employee (to count weekly-off occurrences) */
async function getShiftDays(emp: any) {
  const workShifts: any[] = await robustGet("http://localhost:8000/work-shift");
  const empShift = workShifts.find(ws => ws.id === emp.workShiftID);
  return empShift?.workShiftDay || [];
}

/** Count weekly-off occurrences in the cycle (these are paid) */
function countWeeklyOffOccurrences(shiftDays: any[], start: Date, end: Date) {
  const offNames = new Set(shiftDays.filter((d: any) => d.weeklyOff).map((d: any) => d.weekDay));
  let count = 0;
  for (const d of daysIterArray(start, end)) {
    const wd = d.toLocaleString("en-US", { weekday: "long" });
    if (offNames.has(wd)) count++;
  }
  return count;
}

/** Public holiday days for branch within cycle */
async function getHolidayCount(branchId: number, start: Date, end: Date) {
  const holidays: any[] = await robustGet("http://localhost:8000/public-holiday");
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

/** Split approved leaves to Non-LoP vs LoP (in days) within cycle */
async function getLeaveBreakdown(employeeId: number, start: Date, end: Date) {
  const leaves: any[] = await robustGet("http://localhost:8000/leave-application");
  const empLeaves = leaves.filter(l => l.manageEmployeeID === employeeId && l.status === "Approved");
  let nonLoP = 0, lop = 0;
  empLeaves.forEach(l => {
    const ls = new Date(l.fromDate), le = new Date(l.toDate);
    for (let d = new Date(ls); d <= le; d.setDate(d.getDate() + 1)) {
      if (d >= start && d <= end) {
        if (String(l.appliedLeaveType).toLowerCase() === "lop") lop++;
        else nonLoP++;
      }
    }
  });
  return { nonLoPDays: nonLoP, lopDays: lop };
}

/** Get employee gross monthly salary from common fields */
/** Get employee gross monthly salary from multiple possible sources (emp + grade) */
function getGrossFromEmp(emp: any, grade?: any): number {
  // 1) Preferred: nested monthlyPayGrade from backend include
  if (emp?.monthlyPayGrade?.grossSalary) {
    const v = Number(emp.monthlyPayGrade.grossSalary);
    if (Number.isFinite(v) && v > 0) {
      alert("✅ Using gross from emp.monthlyPayGrade.grossSalary = " + v);
      return v;
    }
  }

  // 2) Fallbacks on employee object (many APIs use different names)
  const fields = [
    "monthlyGrossSalary", "grossSalary", "monthlySalary", "ctcMonthly",
    "ctc", "salary", "totalSalary", "payrollSalary"
  ];
  for (const f of fields) {
    const v = Number(emp?.[f]);
    if (Number.isFinite(v) && v > 0) {
      alert(`✅ Using gross from emp.${f} = ${v}`);
      return v;
    }
  }

  // 3) Final fallback: if we fetched Monthly Pay Grade separately
  if (grade?.grossSalary) {
    const v = Number(grade.grossSalary);
    if (Number.isFinite(v) && v > 0) {
      alert("✅ Using gross from fetched MonthlyPayGrade.grossSalary = " + v);
      return v;
    }
  }

  // Nothing found – show a precise alert to help you spot the data shape
  alert(
    "❌ Gross salary not found.\n" +
    "Checked:\n- emp.monthlyPayGrade.grossSalary\n- emp.monthlyGrossSalary/grossSalary/monthlySalary/ctcMonthly/ctc/salary/totalSalary/payrollSalary\n- grade.grossSalary"
  );
  throw new Error("Gross salary not found (expected on employee or monthly pay grade).");
}


/** Get total reimbursement amount for employee in selected period */
/** Get total reimbursement amount for employee in selected period */
/** Get total reimbursement amount for employee in selected period */
async function getReimbursementAmount(employeeId: number, selectedMonthLabel: string): Promise<number> {
  try {
    const reimbursements: any[] = await robustGet(`${BACKEND_URL}/reimbursement`);

    // Parse the selected salary period to get start and end dates
    const { start: periodStart, end: periodEnd } = parseCycle(selectedMonthLabel);

    // Filter reimbursements for this employee where the reimbursement date falls within salary period
    const employeeReimbursements = reimbursements.filter(reimbursement => {
      // Check if reimbursement has a date field
      if (!reimbursement.date || typeof reimbursement.date !== 'string') return false;

      try {
        // Parse the reimbursement date (simple YYYY-MM-DD format)
        const reimbDate = new Date(reimbursement.date);
        if (isNaN(reimbDate.getTime())) return false;

        // Check if reimbursement date falls within salary period
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
        return false;
      }
    });

    if (employeeReimbursements.length === 0) {
      return 0;
    }

    // Sum all amounts from all items across all matching reimbursements
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
    return 0;
  }
}


/** Compute earnings from Pay Grade + Reimbursements */
async function computeEarnings(gross: number, grade: any, employeeId: number, selectedMonthLabel: string) {
  const basic = Math.round(gross * 0.50);
  const allowances: { name: string, amount: number }[] = [];
  const list = grade?.monthlyPayGradeAllowanceList || [];

  // Add regular allowances from pay grade
  list.forEach((item: any) => {
    const a = item.salaryAllowance || {};
    const name = (a.salaryAllowanceName || "").trim();
    const type = (a.salaryAllowanceType || "").toLowerCase();
    const value = Number(a.salaryAllowanceValue || 0);
    let amt = 0;
    if (type === "fixed") amt = value;
    else {
      const base = name.toLowerCase().includes("hra") ? basic : gross;
      amt = Math.round((base * value) / 100);
    }
    allowances.push({ name, amount: amt });
  });

  // Add reimbursements as a separate earning item
  const reimbursementAmount = await getReimbursementAmount(employeeId, selectedMonthLabel);

  // Create the final earnings array that includes both allowances and reimbursement
  const earningsForPDF = [...allowances];

  // Add reimbursement as a separate earning item if it exists
  // Show reimbursement only when present (> 0)
  if (reimbursementAmount > 0) {
    earningsForPDF.push({
      name: "Reimbursement",
      amount: reimbursementAmount
    });
  }

  const earningsTotal = basic + earningsForPDF.reduce((s, x) => s + x.amount, 0);

  return {
    basic,
    allowances: earningsForPDF, // Return the updated array with reimbursement
    earningsTotal
  };
}

/** Compute grade deductions (PF % on Basic by name, otherwise % on Gross) */
async function computeDeductions(
  gross: number,
  basic: number,
  grade: any,
  employeeId: number,
  selectedMonthLabel: string
) {
  const list = grade?.monthlyPayGradeDeductionList || [];
  const deductions: { name: string; amount: number }[] = [];

  // Add regular deductions from pay grade
  list.forEach((item: any) => {
    const d = item.salaryDeduction || {};
    const name = (d.salaryDeductionName || "").trim();
    const type = (d.salaryDeductionType || "").toLowerCase();
    const value = Number(d.salaryDeductionValue || 0);
    let amt = 0;
    if (type === "fixed") amt = value;
    else {
      const base = name.toLowerCase().includes("pf") ? basic : gross;
      amt = Math.round((base * value) / 100);
    }
    deductions.push({ name, amount: amt });
  });

  // Add salary advance repayments as deductions
  const advanceRepayments = await getSalaryAdvanceRepayments(employeeId, selectedMonthLabel);
  deductions.push(...advanceRepayments);

  const deductionsTotal = deductions.reduce((s, x) => s + x.amount, 0);
  return { deductions, deductionsTotal };
}

/* =======================
   Attendance counter (MUST be above usage)
   ======================= */

async function fetchAllLogs(): Promise<any[]> {
  const all: any[] = [];
  try {
    const res: any[] = await robustGet(`http://localhost:8000/emp-attendance-logs`);
    all.push(...res);
  } catch (err) {
    console.error("Failed to fetch /emp-attendance-logs", err);
  }
  return all;
}

async function calculateSalaryCounts(
  employeeId: number,
  monthLabel: string,
  companyId: number,
  branchId: number
) {
  try {
    alert("[STEP-1] Calculating salary counts for employee: " + employeeId);

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

    // === EMPLOYEE ===
    const empList: any[] = await robustGet(API.emp);
    let emp = empList.find((e) => e.id === employeeId) ??
      empList.find((e) => [e.employeeID, e.empId, e.employeeId].includes(employeeId as any));
    if (!emp) throw new Error("Employee not found: " + employeeId);

    // === PERIOD ===
    let startDate: Date, endDate: Date;
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

    // === ATTENDANCE POLICY ===
    const policies: any[] = await robustGet("http://localhost:8000/attendance-policy");
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

    // === SHIFT ===
    const workShifts: any[] = await robustGet("http://localhost:8000/work-shift");
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

    // === HOLIDAY / LEAVE / REGULARISE MAPS ===
    const holidays: any[] = await robustGet("http://localhost:8000/public-holiday");
    const branchHolidays = holidays.filter((h: any) => h.branchesID === branchId);
    const holidaySet = new Set<string>();
    for (const h of branchHolidays) {
      const hs = new Date(h.startDate), he = new Date(h.endDate);
      for (let d = new Date(hs); d <= he; d.setDate(d.getDate() + 1)) if (d >= startDate && d <= endDate) holidaySet.add(ymd(d));
    }

    const leaves: any[] = await robustGet("http://localhost:8000/leave-application");
    const empLeaves = leaves.filter((l) => l.manageEmployeeID === employeeId);
    const leaveMap = new Map<string, any>();
    for (const lv of empLeaves) {
      const ls = new Date(lv.fromDate), le = new Date(lv.toDate);
      for (let d = new Date(ls); d <= le; d.setDate(d.getDate() + 1))leaveMap.set(ymd(d), lv);
    }

    const regs: any[] = await robustGet("http://localhost:8000/emp-attendance-regularise");
    const empRegs = regs.filter((r) => r.manageEmployeeID === employeeId && r.status === "Approved");
    const regulariseMap = new Map<string, any>();
    for (const r of empRegs) regulariseMap.set(ymd(new Date(r.attendanceDate)), r);

    // === LOGS ===
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

    // === COUNTERS ===
    let flex_fullDayPresent = 0, flex_halfDayPresent = 0, flex_absent = 0, lateMarksUsed = 0;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = ymd(d);
      const todayWeekDay = dayName(d);
      if (weeklyOffDays.has(todayWeekDay)) continue;

      const frame = getShiftFrame(d);
      if (!frame) continue;

      // Public holiday
      if (holidaySet.has(key)) { flex_fullDayPresent++; continue; }

      // Regularise
      if (regulariseMap.has(key)) {
        const r = regulariseMap.get(key);
        if (r.day === "fullday") flex_fullDayPresent++;
        else if (r.day === "Half Day") flex_halfDayPresent++;
        else flex_absent++;
        continue;
      }

      // Leave
      if (leaveMap.has(key)) {
        const lv = leaveMap.get(key);
        if (lv.status === "Approved" && (lv.appliedLeaveType ?? "").toLowerCase() !== "lop") flex_fullDayPresent++;
        else flex_absent++;
        continue;
      }

      const dayLogs = (logsByDate.get(key) || []).filter(t => t >= frame.earliestIn && t <= frame.latestOut);
      let dayStatus: "full" | "half" | "absent" = "absent";

      // === FLEXIBLE WORKING LOGIC ===
      if (isFlexible) {
        if (dayLogs.length < 2) {
          dayStatus = "absent";
          alert(`❌ [ABSENT-FLEX-NO-LOGS] ${key} | ${dayLogs.length} punch`);
        } else {
          dayLogs.sort((a, b) => a.getTime() - b.getTime());
          const totalWorkedMinutes = Math.round((dayLogs[dayLogs.length - 1].getTime() - dayLogs[0].getTime()) / 60000);
          if (totalWorkedMinutes < halfDayMin) {
            dayStatus = "absent";
            alert(`❌ [ABSENT-FLEX-LOW-HOURS] ${key} | Worked ${totalWorkedMinutes}min < ${halfDayMin}`);
          } else if (totalWorkedMinutes >= frame.fullMinutes) {
            dayStatus = "full";
            alert(`✅ [FULL-FLEX] ${key} | Worked ${totalWorkedMinutes}min >= ${frame.fullMinutes}`);
          } else {
            dayStatus = "half";
            alert(`⚠️ [HALF-FLEX] ${key} | Worked ${totalWorkedMinutes}min (>=${halfDayMin} but <${frame.fullMinutes})`);
          }
        }
      }
      // === FIXED WORKING LOGIC ===
      else {
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

      if (dayStatus === "full") flex_fullDayPresent++;
      else if (dayStatus === "half") flex_halfDayPresent++;
      else flex_absent++;
    }

    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    alert(`[RESULT] Type=${isFlexible ? "Flexible" : "Fixed"} | Full=${flex_fullDayPresent} | Half=${flex_halfDayPresent} | Absent=${flex_absent}`);
    return { startDate: startDate.toDateString(), endDate: endDate.toDateString(), totalDays, flex_fullDayPresent, flex_halfDayPresent, flex_absent, lateMarksUsed, lateMarkCount };
  } catch (err) {
    alert("❌ Error calculating salary counts: " + (err as any).message);
    console.error(err);
    return null;
  }
}


/* =======================
   PDF generation
   ======================= */


function numberToWords(num: number): string {
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred " + inWords(n % 100);
    if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand " + inWords(n % 1000);
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh " + inWords(n % 100000);
    return inWords(Math.floor(n / 10000000)) + " Crore " + inWords(n % 10000000);
  };

  return inWords(Math.floor(num)) + " Rupees Only";
}



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
    // ========== HEADER ==========
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.width;
    const gray: [number, number, number] = [100, 60, 150];
    let y = 15;

    const companyName = payload.companyName || payload.employee?.company?.companyName;
    const companyAddress = payload.employee?.company?.address || "Head Office";


    // Company Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text(companyName, pageWidth / 2, 20, { align: "center" });

    // Address line (below company name)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(companyAddress, pageWidth / 2, 25, { align: "center" });

    // Tagline
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);

    // Salary Slip Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("Salary Slip", pageWidth / 2, 38, { align: "center" });

    // Branch & Period
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Branch: ${payload.branchName}`, 15, 45);
    doc.text(
      `Period: ${payload.start.toDateString()} - ${payload.end.toDateString()}`,
      pageWidth - 15,
      45,
      { align: "right" }
    );

    // ========== EMPLOYEE DETAILS ==========
    const empName = `${payload.employee.employeeFirstName || ""} ${payload.employee.employeeLastName || ""}`.trim();
    const dept = payload.employee.departments?.departmentName || "N/A";
    const desg = payload.employee.designations?.designation || "N/A";

    // CORRECTED: Calculate actual paid days (Total Cycle - LOP Days)
    const actualPaidDays = payload.cycleDays - payload.lopDays;

    // Validate that the calculation makes sense
    if (actualPaidDays < 0) {
      console.warn("Invalid paid days calculation: LOP days exceed cycle days");
    }

    autoTable(doc, {
      startY: 47,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, lineWidth: 0.1 },
      headStyles: { fillColor: gray, textColor: [255, 255, 255], halign: "center" },
      body: [
        ["Employee ID", payload.employee.employeeID || "-", "Name", empName],
        ["Department", dept, "designation", desg],
        ["Total Paid Days", actualPaidDays.toFixed(2), "Approved Leaves", payload.nonLoPLeaveDays],
        ["Cycle Days", payload.cycleDays, "LOP Days", payload.lopDays.toFixed(2)],
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

    // ========== EARNINGS / DEDUCTIONS ==========
    const earningsRows = [
      ["Basic Pay", ` ${payload.basic.toFixed(2)}`],
      ...payload.earnings.map((e: any) => [e.name, ` ${e.amount.toFixed(2)}`]),
      ["Total Earnings", ` ${payload.earningsTotal.toFixed(2)}`],
    ];
    const dedRows = [
      ...payload.deductions.map((d: any) => [d.name, ` ${d.amount.toFixed(2)}`]),
      ["Loss of Pay", ` ${payload.lopAmount.toFixed(2)}`],
      ["Total Deductions", ` ${(payload.deductionsTotal + payload.lopAmount).toFixed(2)}`],
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

    // ========== NET PAY SECTION ==========
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 10, lineWidth: 0.1, halign: "center" },
      headStyles: { fillColor: gray, textColor: [255, 255, 255] },
      head: [["Net Pay (Rounded)", "Amount"]],
      body: [[`Net Payable`, ` ${payload.netPay.toFixed(0)}`]],
      margin: { left: 15 },
      tableWidth: pageWidth - 30,
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // ========== NET PAY IN WORDS ==========
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(
      `Net Payable (in words): ${numberToWords(payload.netPay)}`, // This will use the rounded value
      15,
      y
    );

    // ========== DAYS BREAKDOWN ==========
    y += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Days Breakdown: Total Cycle (${payload.cycleDays}) - LOP Days (${payload.lopDays.toFixed(2)}) = Paid Days (${actualPaidDays.toFixed(2)})`, 15, y);

    // ========== SIGNATURES ==========
    y += 20;
    doc.setDrawColor(0);
    doc.line(30, y, 80, y);
    doc.line(pageWidth - 80, y, pageWidth - 30, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Employer's Signature", 35, y + 5);
    doc.text("Employee's Signature", pageWidth - 85, y + 5);

    // ========== FOOTER ==========
    y += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text("This is a system generated document.", pageWidth / 2, y, { align: "center" });
    doc.text(`Generated on: ${new Date().toLocaleDateString("en-IN")}`, pageWidth / 2, y + 4, { align: "center" });

    // ========== SAVE ==========
    const fn = `Salary_Slip_${payload.employee.employeeID || payload.employee.id}_${payload.start.getFullYear()}_${(
      payload.start.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}.pdf`;
    doc.save(fn);
  }
  catch (err) {
    console.error("Error generating salary slip:", err);
    alert("Error generating salary slip. Please check console for details.");
  }
}

/* =======================
   Component
   ======================= */

export function EmpGenerateSalary() {
  // table + UI
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GenerateSalaryRow | null>(null);
  const [salaryPeriod, setSalaryPeriod] = useState("");

const user = useCurrentUser()
const [items, setItems] = useState<GenerateSalaryRow[]>([])
const canManage = user?.role === "SUPERADMIN" || user?.role === "MANAGER"

  // suggestion states
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

  // company-driven salary cycle
  const [selectedCompanyFYStart, setSelectedCompanyFYStart] = useState<string | null>(null);
  const [selectedCompanyStartDay, setSelectedCompanyStartDay] = useState<string>("1");
  const [salaryPeriodOptions, setSalaryPeriodOptions] = useState<string[]>([]);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedSalaryRow, setSelectedSalaryRow] = useState<GenerateSalaryRow | null>(null);

  // Payment form
  const [paymentMode, setPaymentMode] = useState<string>("Cash");
  const [paymentType, setPaymentType] = useState<string>("Cash");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [paymentRemark, setPaymentRemark] = useState<string>("");
  const [paymentProof, setPaymentProof] = useState<string>("");
  const [employeeBankDetails, setEmployeeBankDetails] = useState<any | null>(null);
  const [isLoadingBankDetails, setIsLoadingBankDetails] = useState(false);


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

      // ✅ Fetch from manage-emp and find employee by ID
      const allEmployees = await robustGet("http://localhost:8000/manage-emp");
      const employee = allEmployees.find((e: any) => e.id === row.manageEmployee?.id);

      // Extract the first bank details entry if exists
      if (employee && employee.employeeBankDetails?.length > 0) {
        const bankDetails = employee.employeeBankDetails[0];
        setEmployeeBankDetails(bankDetails);

        // ✅ Auto-select paymentType if UPI exists
        if (bankDetails.upi) {
          setPaymentMode("Bank");
          setPaymentType("UPI");
        }
      } else {
        setEmployeeBankDetails(null);
      }

    } catch (err) {
      console.error("Error fetching employee bank details from manage-emp:", err);
    } finally {
      setIsLoadingBankDetails(false);
    }
  }
}


  async function handlePaymentSubmit(e?: React.FormEvent) {
  if (e) e.preventDefault();
  if (!selectedSalaryRow) return;

  // Keep existing data + add payment fields
  const payload = {
    ...selectedSalaryRow, // keep everything that already exists
    paymentMode,
    paymentType,
    paymentDate,
    paymentRemark,
    paymentProof,
  };

  // Remove nested relations before sending to API (optional but clean)
  delete payload.manageEmployee;
  delete payload.serviceProvider;
  delete payload.company;
  delete payload.branches;

  try {
    const res = await fetch(`http://localhost:8000/generate-salary/${selectedSalaryRow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(await res.text());
    alert("✅ Payment marked successfully!");
    setIsPaymentDialogOpen(false);
    fetchAll(); // reload table
  } catch (error) {
    console.error("Payment update failed:", error);
    alert("❌ Payment update failed: " + (error as any).message);
  }
}


  // form
  const [formData, setFormData] = useState({
    serviceProviderID: null as number | null,
    companyID: null as number | null,
    branchesID: null as number | null,
    spAutocomplete: "",
    coAutocomplete: "",
    brAutocomplete: "",
    employeeDbID: null as number | null,
    employeeAutocomplete: "",
    monthLabel: "",
  });

  // close popovers on outside click
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

  useEffect(() => {
    if (formData.companyID) {
      (async () => {
        const res = await robustGet("http://localhost:8000/salary-cycle");
        const filtered = res
          .filter((c: any) => c.companyID === Number(formData.companyID))
          .map((c: any) => `${c.startDay} ${c.startMonth} ${c.startYear} to ${c.endDay} ${c.endMonth} ${c.endYear}`);
        setSalaryPeriodOptions(filtered);
      })();
    }
  }, [formData.companyID]);


  /* ====== CRUD ====== */
  async function fetchAll() {
  try {
    const raw = await robustGet(API.generateSalary)
    const allItems: GenerateSalaryRow[] = Array.isArray(raw) ? raw : (raw?.data ?? [])

    // === SUPERADMIN → all entries
    if (user?.role === "SUPERADMIN") {
      setItems(allItems)
      return
    }

    // === MANAGER → match companyID + branchesID from /users
    if (user?.role === "MANAGER") {
      const users = await robustGet(`${BACKEND_URL}/users`)
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

   // === EMPLOYEE → only own entries that are already Paid ===
const creds = await robustGet(`${BACKEND_URL}/manage-emp/credentials/all`);
const emp = user ? creds.find((c: any) => c.username === user.username) : null;

if (emp) {
  const filtered = allItems.filter((r: any) =>
    r.companyID === emp.companyID &&
    r.branchesID === emp.branchesID &&
    (
      // match employee linkage (cover both shapes your API might return)
      r.manageEmployeeID === emp.employeeID ||
      r.manageEmployee?.id === emp.employeeID ||
      r.employeeID === emp.employeeID
    ) &&
    r.status === "Paid" // <-- show ONLY Paid
  );
  setItems(filtered);
} else {
  setItems([]);
}

  } catch (e) {
    console.error("Failed to load GenerateSalary:", e)
  }
}

useEffect(() => {
  if (user) fetchAll()
}, [user])

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
    } catch (err) {
      console.error("Save failed:", err);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this record?")) return;
    try {
      const res = await fetch(`${API.generateSalary}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await fetchAll();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }

  function resetForm() {
    setFormData({
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
    setEditing(null);
    setSelectedCompanyFYStart(null);
    setSelectedCompanyStartDay("1");
    setSalaryPeriodOptions([]);
    setSpList([]); setCoList([]); setBrList([]); setEmpList([]);
  }

  async function beginEdit(row: GenerateSalaryRow) {
    setEditing(row);

    // Set all form data first
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

    // Now refresh company options if company exists
    if (row.companyID) {
      try {
        await refreshCompanyDrivenOptions(row.companyID);
      } catch (error) {
        console.error("Failed to refresh company options:", error);
      }
    } else {
      // Reset company-driven options if no company
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
      const filtered = data.filter((sp) => (sp.companyName ?? "").toLowerCase().includes(q.toLowerCase()));
      setSpList(filtered);
    } catch { /* noop */ }
    finally { setSpLoading(false); }
  };

  const runFetchCO = async (q: string) => {
    if (!q || q.length < MIN_CHARS) return setCoList([]);
    setCoLoading(true);
    try {
      const data: CO[] = await robustGet(API.co);
      const filtered = data.filter((co) => (co.companyName ?? "").toLowerCase().includes(q.toLowerCase()));
      setCoList(filtered);
    } catch { /* noop */ }
    finally { setCoLoading(false); }
  };

  const runFetchBR = async (q: string) => {
    setBrLoading(true);
    try {
      const url = formData.companyID ? `${API.br}?companyID=${formData.companyID}` : API.br;
      const data: BR[] = await robustGet(url);
      const filtered = (q?.length ? data.filter((b) => (b.branchName ?? "").toLowerCase().includes(q.toLowerCase())) : data);
      setBrList(filtered);
    } catch { /* noop */ }
    finally { setBrLoading(false); }
  };

  const runFetchEmp = async (q: string) => {
    if (!q || q.length < MIN_CHARS) return setEmpList([]);
    setEmpLoading(true);
    try {
      const data: Emp[] = await robustGet(API.emp);
      const low = q.toLowerCase();
      const filtered = data.filter((e) =>
        (empName(e)).toLowerCase().includes(low) ||
        (e.employeeID ?? "").toLowerCase().includes(low)
      );
      setEmpList(filtered);
    } catch { /* noop */ }
    finally { setEmpLoading(false); }
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
      setSelectedCompanyFYStart(null);
      setSelectedCompanyStartDay("1");
      setSalaryPeriodOptions([]);
      setFormData((p) => ({ ...p, monthLabel: "" }));
    }
  }

  /* ====== Generate / Download Salary Slip (single copy) ====== */
  async function handleDownloadSalarySlipForRow(row: GenerateSalaryRow) {
    try {
      const employeeId = Number(row.employeeID);
      const companyId = Number(row.companyID);
      const branchId = Number(row.branchesID);
      const monthLabel = row.monthPeriod;

      alert(`[STEP-0] Generating slip for Emp=${employeeId}, Company=${companyId}, Branch=${branchId}, Month=${monthLabel}`);

      // === EMPLOYEE DATA ===
      const empList: any[] = await robustGet(API.emp);
      const emp = empList.find((e: any) => e.id === employeeId);
      if (!emp) throw new Error("Employee not found");

      // === DATE RANGE ===
      const { start, end } = parseCycle(monthLabel);
      const totalDaysInCycle = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

      // === ATTENDANCE COUNTS ===
      const counts = await calculateSalaryCounts(employeeId, monthLabel, companyId, branchId);
      if (!counts) throw new Error("Could not compute attendance counts");

      alert(`[STEP-1] Attendance Counts → Full Days: ${counts.flex_fullDayPresent}, Half Days: ${counts.flex_halfDayPresent}, Absent Days: ${counts.flex_absent}`);
      // === SHIFT AND HOLIDAY INFO ===
      const shiftDays = await getShiftDays(emp);
      const weeklyOffDays = countWeeklyOffOccurrences(shiftDays, start, end);
      const holidays = await getHolidayCount(branchId, start, end);

      // === LEAVES (Approved) ===
      const { nonLoPDays, lopDays } = await getLeaveBreakdown(employeeId, start, end);

      // === CALCULATE PAID + LOP DAYS ===
      const fullDays = Number(counts.flex_fullDayPresent || 0);
      const halfDays = Number(counts.flex_halfDayPresent || 0);
      const absentDays = Number(counts.flex_absent || 0);

      // Debug: Check what calculateSalaryCounts returned
      alert(`[STEP-2] Calculated Days → Full Days: ${fullDays}, Half Days: ${halfDays}, Absent Days: ${absentDays}, LOP Days from Leaves: ${lopDays ?? 0}`);
      // CORRECTED: Working days should exclude only weekly offs and holidays
      const workingDaysInCycle = totalDaysInCycle - weeklyOffDays - holidays;

      // CORRECTED: Calculate paid days (excluding LOP)
      const totalPaidDays = fullDays + (halfDays * 0.5);

      // CORRECTED: LOP days calculation
      const totalLopDays = absentDays + (halfDays * 0.5) + (lopDays ?? 0);

      // Validation
      const calculatedTotal = totalPaidDays + totalLopDays;

      alert(`[CORRECTED-LOP-CALCULATION] 
      Total Days in Cycle: ${totalDaysInCycle}
      Weekly Off Days: ${weeklyOffDays}
      Holidays: ${holidays}
      Working Days: ${workingDaysInCycle}
      
      Full Days: ${fullDays}
      Half Days: ${halfDays} (counts as ${halfDays * 0.5} paid days)
      Absent Days: ${absentDays}
      LOP Leaves: ${lopDays ?? 0}
      
      Total Paid Days: ${totalPaidDays}
      Total LOP Days: ${totalLopDays}
      Validation: ${totalPaidDays} + ${totalLopDays} = ${calculatedTotal} (should equal ${workingDaysInCycle})`);

      const expectedTotal = workingDaysInCycle + holidays; // Include holidays in expected total
      if (Math.abs((totalPaidDays + totalLopDays) - expectedTotal) > 0.1) {
        alert(`⚠️ [DAY-MISMATCH] Paid(${totalPaidDays}) + LOP(${totalLopDays}) = ${totalPaidDays + totalLopDays}, Expected: ${expectedTotal} (Working Days: ${workingDaysInCycle} + Holidays: ${holidays})`);
      } else {

        alert(`✅ [DAY-MATCH] Paid(${totalPaidDays}) + LOP(${totalLopDays}) = ${totalPaidDays + totalLopDays}, Expected: ${expectedTotal}`);
      }

      // === PAY GRADE AND COMPANY INFO ===
      const grade = await getMonthlyPayGrade(companyId, branchId, emp);
      const { companyName, branchName } = await getCompanyAndBranch(companyId, branchId);

      // === SALARY STRUCTURE ===
      const gross = getGrossFromEmp(emp);
      if (!gross || isNaN(gross)) throw new Error("Gross salary not found on employee record");

      const { basic, allowances, earningsTotal } = await computeEarnings(gross, grade, employeeId, monthLabel);
      const { deductions, deductionsTotal } = await computeDeductions(gross, basic, grade, employeeId, monthLabel);

      // === CORRECTED LOP CALCULATION - EXCLUDE REIMBURSEMENT & USE CALENDAR DAYS ===
      // Calculate total for LOP (basic + all allowances EXCLUDING reimbursement)
      let totalForLOP = basic;
      allowances.forEach(allowance => {
        if (allowance.name.toLowerCase() !== "reimbursement") {
          totalForLOP += allowance.amount;
        }
      });

      // DEBUG: Show what's included in LOP calculation
      alert(`[LOP-BREAKDOWN] 
      Basic: ${basic}
      Allowances for LOP: ${allowances.filter(a => a.name.toLowerCase() !== 'reimbursement').map(a => `${a.name}: ${a.amount}`).join(', ')}
      Total for LOP: ${totalForLOP}
      Reimbursement excluded: ${allowances.find(a => a.name.toLowerCase() === 'reimbursement')?.amount || 0}`);

      // ✅ FIXED: Use CALENDAR DAYS (totalDaysInCycle) instead of working days for LOP calculation
      const daysForLOPCalculation = totalDaysInCycle; // Changed from workingDaysInCycle to totalDaysInCycle
      const perDaySalary = totalForLOP / daysForLOPCalculation;

      // Calculate LOP amount based on different types of LOP days
      const fullDayLOP = absentDays + (lopDays ?? 0); // Full day LOP (absent days + LOP leaves)
      const halfDayLOP = halfDays * 0.5; // Half days count as 0.5 LOP days

      const lopAmount = (perDaySalary * fullDayLOP) + (perDaySalary * 0.5 * halfDays);

      alert(`[CORRECTED-SALARY-CALCULATION] 
      Total for LOP: ${totalForLOP}
      Days for LOP Calculation: ${daysForLOPCalculation} (using calendar days)
      Per Day Salary: ${perDaySalary.toFixed(2)}
      
      Full Day LOP: ${fullDayLOP} days
      Half Day LOP: ${halfDayLOP} days (${halfDays} half days)
      Total LOP Days: ${totalLopDays}
      
      LOP Amount Breakdown:
      - Full Day LOP: ${perDaySalary.toFixed(2)} × ${fullDayLOP} = ${(perDaySalary * fullDayLOP).toFixed(2)}
      - Half Day LOP: ${(perDaySalary * 0.5).toFixed(2)} × ${halfDays} = ${(perDaySalary * 0.5 * halfDays).toFixed(2)}
      Total LOP Amount: ${lopAmount.toFixed(2)}`);

      const netPayBeforeRounding = Math.max(0, earningsTotal - (deductionsTotal + lopAmount));
      const netPay = roundToNearestRupee(netPayBeforeRounding);

      alert(`[STEP-3] 
      Gross=${gross}
      Total for LOP=${totalForLOP}
      Days for LOP Calculation=${daysForLOPCalculation}
      Per Day Salary=${perDaySalary.toFixed(2)}
      Half Day Salary=${(perDaySalary * 0.5).toFixed(2)}
      LOP Amount=${lopAmount.toFixed(2)}
      Net Pay Before Rounding=${netPayBeforeRounding.toFixed(2)}
      Net Pay Rounded=${netPay}`);

      // === GENERATE PDF ===
      downloadSalarySlipPDF({
        companyName,
        branchName,
        employee: emp,
        monthLabel,
        start,
        end,
        cycleDays: totalDaysInCycle,
        paidUnits: Number(totalPaidDays.toFixed(2)),
        lopDays: Number(totalLopDays.toFixed(2)),
        nonLoPLeaveDays: Number(nonLoPDays.toFixed(2)),
        weeklyOffDays,
        holidays,
        halfDaysUnits: Number((halfDays * 0.5).toFixed(2)),
        gross,
        basic,
        earnings: allowances,
        deductions,
        lopAmount,
        earningsTotal,
        deductionsTotal,
        netPay,
      });

      alert(`[STEP-4 ✅] Salary Slip generated successfully for ${emp.employeeFirstName ?? emp.firstName ?? emp.empName ?? emp.name ?? ""}`);

    } catch (err) {
      console.error("Error generating salary slip:", err);
      alert("❌ Error generating salary slip: " + (err instanceof Error ? err.message : String(err)));
    }
  }


  /* ====== Filter for table ====== */
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

  /* =======================
     UI
     ======================= */
  return (
    <>


<Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
  <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
    <DialogHeader className="px-6 py-4 border-b bg-white sticky top-0 z-10">
      <DialogTitle className="text-xl font-semibold text-green-800">
        Make Payment
      </DialogTitle>
    </DialogHeader>

    <div className="flex-1 overflow-y-auto px-6 py-4">
      {selectedSalaryRow && (
        <form onSubmit={handlePaymentSubmit} className="space-y-6">
          {/* Employee Info */}
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

          {/* Payment Mode */}
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
                      const allEmployees = await robustGet("http://localhost:8000/manage-emp");
                      const employee = allEmployees.find(
                        (e: any) => e.id === selectedSalaryRow.manageEmployee?.id
                      );

                      if (employee && employee.employeeBankDetails?.length > 0) {
                        const bankDetails = employee.employeeBankDetails[0];
                        setEmployeeBankDetails(bankDetails);

                        // ✅ Auto-select UPI if available
                        if (bankDetails.upi) {
                          setPaymentType("UPI");
                        }
                      } else {
                        setEmployeeBankDetails(null);
                      }
                    } catch (err) {
                      console.error("Error fetching employee bank details:", err);
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

          {/* Payment Type (for Bank mode) */}
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

          {/* Loading State */}
          {paymentMode === "Bank" && isLoadingBankDetails && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <Icon icon="mdi:loading" className="w-5 h-5 animate-spin mx-auto text-blue-600" />
              <p className="text-sm text-gray-600 mt-2">Loading employee bank details...</p>
            </div>
          )}

          {/* No Bank Details Found */}
          {paymentMode === "Bank" &&
            !isLoadingBankDetails &&
            !employeeBankDetails && (
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-sm text-yellow-800">
                No bank details found for this employee. Please contact HR to update.
              </div>
            )}

          {/* Employee Bank/UPI Details */}
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

          {/* Payment Proof */}
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

          {/* Payment Date */}
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

          {/* Remark */}
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

    {/* Footer */}
    <DialogFooter className="px-6 py-4 border-t bg-gray-50 sticky bottom-0">
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
    </DialogFooter>
  </DialogContent>
</Dialog>




      <div className="space-y-6 w-full max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between w-full">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Generate Salary</h1>
            <p className="text-gray-600 mt-1 text-sm">Generate and manage employee salary payments</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}>
            {canManage && (
  <DialogTrigger asChild>
    <Button onClick={resetForm} className="bg-blue-600 hover:bg-blue-700 flex-shrink-0 text-sm px-3 py-2">
      <Plus className="w-4 h-4 mr-1" />
      Add Salary Generation
    </Button>
  </DialogTrigger>
)}


            <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Salary Generation" : "Add New Salary Generation"}</DialogTitle>
                <DialogDescription>
                  {editing ? "Update the salary generation information below." : "Fill in the details to add a new salary generation."}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Organization Selection */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Organization Selection</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Service Provider */}
                    <div ref={spRef} className="space-y-2 relative">
                      <Label>Service Provider *</Label>
                      <Input
                        value={formData.spAutocomplete}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((p) => ({ ...p, spAutocomplete: val, serviceProviderID: null }));
                          runFetchSP(val);
                        }}
                        onFocus={(e) => {
                          const val = e.target.value;
                          if (val.length >= MIN_CHARS) runFetchSP(val);
                        }}
                        placeholder="Start typing service provider…"
                        autoComplete="off"
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
                                setFormData((p) => ({ ...p, serviceProviderID: sp.id, spAutocomplete: sp.companyName ?? "" }));
                                setSpList([]);
                              }}
                            >
                              {sp.companyName}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Company */}
                    <div ref={coRef} className="space-y-2 relative">
                      <Label>Company Name *</Label>
                      <Input
                        value={formData.coAutocomplete}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((p) => ({ ...p, coAutocomplete: val, companyID: null }));
                          runFetchCO(val);
                        }}
                        onFocus={(e) => {
                          const val = e.target.value;
                          if (val.length >= MIN_CHARS) runFetchCO(val);
                        }}
                        placeholder="Start typing company…"
                        autoComplete="off"
                      />
                      {coList.length > 0 && (
                        <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                          {coLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                          {coList.map((co) => (
                            <div
                              key={co.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={async () => {
                                setFormData((p) => ({ ...p, companyID: co.id, coAutocomplete: co.companyName ?? "" }));
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

                    {/* Branch */}
                    <div ref={brRef} className="space-y-2 relative">
                      <Label>Branch Name *</Label>
                      <Input
                        value={formData.brAutocomplete}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((p) => ({ ...p, brAutocomplete: val, branchesID: null }));
                          runFetchBR(val);
                        }}
                        onFocus={(e) => { runFetchBR(formData.brAutocomplete); }}
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
                              onClick={() => {
                                setFormData((p) => ({ ...p, branchesID: br.id, brAutocomplete: br.branchName ?? "" }));
                                setBrList([]);
                              }}
                            >
                              {br.branchName}
                            </div>
                          ))}
                        </div>
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
                      <p className="text-xs text-gray-500">Fetched from /manage-emp</p>
                    </div>
                  </div>
                </div>

                {/* Salary Period (month) */}
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
                      disabled={!formData.companyID} // ✅ only disable when company not selected
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


                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    {editing ? "Update Salary Generation" : "Add Salary Generation"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
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

        {/* Table */}
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

  {/* Always visible download button */}
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
