"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Search, Download, FileText, ChevronDown, X } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import * as XLSX from "xlsx-js-style";
import { formatDevicePunchForDisplay } from "../utils/devicePunchTime";
import { formatWorkedDuration } from "../utils/attendanceDuration";
import { getSidebarContext } from "@/app/utils/sidebarContext";
import { canViewModule } from "@/lib/companyAccess";
import { PageHeader } from "../components/app/page-header";

type ReportMode = "actual" | "factual";

// ==================== INTERFACES ====================

interface ProcessAttLog {
  id: number;
  device_sn: string;
  user_id: string;
  username: string;
  punch_time: string;
  company_name: string;
  branch_name: string;
  department_name: string;
  device_emp_code: string;
  manage_employee_id: number;
  device_id: number;
  raw_body: string;
  processed_at: string;
  status: string;
  device_name: string;
  device_type: string;
  auth_type: string | null;
}

interface Employee {
  id: number;
  employeeID: string;
  employeeFirstName: string;
  employeeLastName: string;
  companyID: number;
  branchesID: number;
  departmentNameID?: number | null;
  designationID?: number | null;
  username?: string;
  workShiftID?: number;
}

interface Company {
  id: number;
  companyName: string;
}

interface Branch {
  id: number;
  branchName: string;
  companyID: number;
}

interface Department {
  id: number;
  companyID: number;
  branchesID: number;
  departmentName: string;
}

interface Designation {
  id: number;
  companyID: number;
  branchesID: number;
  designation: string;
  departmentID: number;
}

interface PublicHoliday {
  id: number;
  companyID: number;
  branchesID: number;
  startDate: string;
  endDate: string;
}

interface WorkShiftDay {
  id: number;
  workShiftID: number;
  weekDay: string;
  shiftType: string;
  weeklyOff: boolean;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  totalMinutes: number;
}

interface WorkShift {
  id: number;
  serviceProviderID: number;
  companyID: number;
  branchesID: number;
  workShiftName: string;
  isActive: string;
  isFlexible: boolean;
  isRotating: boolean;
  breakTimeMin: number;
  workShiftDay: WorkShiftDay[];
}

interface AttendanceRegularize {
  id: number;
  companyID: number;
  branchesID: number;
  manageEmployeeID: number;
  attendanceDate: string;
  status: string;
  requestedStatus: string;
}

interface LeaveApplication {
  id: number;
  companyID: number;
  branchesID: number;
  manageEmployeeID: number;
  appliedLeaveType: string;
  fromDate: string;
  toDate: string;
  status: string;
  dayStatuses?: { date: string; status: string }[];
}

interface RosterEmployee {
  id: number;
  rosterID: number;
  employeeID: number;
  days: RosterDay[];
}

interface RosterDay {
  id: number;
  rosterEmployeeID: number;
  workDate: string;
  workShiftID: number | null;
  dayType: string;
  leaveType: string | null;
  isLocked: boolean;
  workShift: WorkShift | null;
}

interface AttendancePolicy {
  id: number;
  serviceProviderID: number;
  companyID: number;
  branchesID: number;
  attendancePolicyName: string;
  workingHoursType: string;
  checkin_begin_before_min: number;
  checkout_end_after_min: number;
  checkin_grace_time_min: number;
  earlyCheckoutBeforeEndMin: number;
  min_work_hours_half_day_min: number;
  max_late_check_in_time: number;
  markAs: string;
  lateMarkCount: string;
  lateMarkMarkAs: string;
  lateMarkMarkCount: string;
  maxLateCheckinMarkAs: string;
  allow_self_mark_attendance: boolean;
  allow_manager_update_ot: boolean;
  max_ot_hours_per_day_min: number;
  checkoutGracePeriodForOvertimeTrimming: number;
  breakTimeForOT: number;
  otMealApply: boolean;
  maxOvertimeHrs: number;
  minOvertimeHrs: number;
  countWorkhoursInMinutes: boolean;
  weekoffCompulsory?: boolean;
  overtimeApplicable: boolean;
  overtimeTrimmingApply: boolean;
  minsForOTMealToken: number;
  minsForBreakTimeForMeal: number;
  leaveAroundHolidayCounted: boolean;
  trimPreshiftMin: number;
  trimPostshiftMin: number;
}

interface EmpWorkShift {
  id: number;
  manageEmployeeID: number;
  workShiftID: number;
  workShift: WorkShift;
}

interface ReportData {
  employee: Employee;
  punches: { [dateISO: string]: string[] };
  companyName: string;
  branchName: string;
  departmentName: string;
}

type AttendanceStatus = {
  type: string;
  label: string;
  hasPunches: boolean;
  workedMinutes?: number;
  otMinutes?: number;
  totalShiftMinutes?: number;
  rosterShiftName?: string;
};

type ReportMasterData = {
  reportRows: ReportData[];
  empWorkShifts: EmpWorkShift[];
  workShifts: WorkShift[];
  rosters: RosterEmployee[];
  publicHolidays: PublicHoliday[];
  attendanceRegularizations: AttendanceRegularize[];
  leaveApplications: LeaveApplication[];
  attendancePolicy: AttendancePolicy | null;
  factualWeekoffOverrides: Map<number, Set<string>>;
  isFactualMode: boolean;
};

// ==================== CONSTANTS ====================

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

const getStoredActiveCompanyID = (): number | null => {
  if (typeof window === "undefined") return null;

  try {
    const sessionId = Number(sessionStorage.getItem("activeCompanyID") || 0);
    if (sessionId) return sessionId;

    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const localId = Number(userData?.activeCompanyID || userData?.companyID || 0);

    return localId || null;
  } catch {
    return null;
  }
};

const getUserAssignedCompanyIDs = (user: any): number[] => {
  const ids = new Set<number>();

  if (user?.companyID) ids.add(Number(user.companyID));

  if (Array.isArray(user?.userCompanies)) {
    user.userCompanies.forEach((uc: any) => {
      if (uc?.companyID) ids.add(Number(uc.companyID));
    });
  }

  return Array.from(ids);
};

const getTodayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getFirstDayOfMonth = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
};

const LEFT_WIDTHS = {
  sno: 50,
  company: 140,
  branch: 130,
  dept: 120,
  emp: 160
};

// Mobile responsive widths - much narrower for better horizontal scrolling
const LEFT_WIDTHS_MOBILE = {
  sno: 30,
  company: 0, // Hide on mobile
  branch: 0, // Hide on mobile
  dept: 0, // Hide on mobile
  emp: 110
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Global cache for status calculations
const globalStatusCache = new Map<string, any>();

// ==================== HELPER FUNCTIONS ====================

/** Device punches are stored as UTC wall-clock; do not use local getHours(). */
const parsePunchTime = (punchTime: string): { dateKey: string; timeStr: string } | null => {
  const formatted = formatDevicePunchForDisplay(punchTime);
  if (!formatted) return null;
  return { dateKey: formatted.dateKey, timeStr: formatted.timeStr };
};

const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const cleanTime = timeStr.includes(':') ? timeStr : timeStr + ':00';
  const parts = cleanTime.split(':');
  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  const seconds = parseInt(parts[2]) || 0;
  return hours * 60 + minutes + seconds / 60;
};

const toIsoDate = (value: string | Date): string => {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().split("T")[0];
};

const addDaysToIso = (date: string, days: number): string => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return toIsoDate(next);
};

const normalizeWorkShift = (shift: any): WorkShift => ({
  ...shift,
  workShiftName: shift?.workShiftName || shift?.shiftName || "",
  workShiftDay: (shift?.workShiftDay || shift?.factualWorkShiftDay || []).map((day: any) => ({
    ...day,
    workShiftID: day?.workShiftID ?? day?.factualWorkShiftID ?? shift?.id ?? 0,
  })),
});

const normalizeRosterEmployee = (rosterEmployee: any, shiftById: Map<number, WorkShift>): RosterEmployee => ({
  ...rosterEmployee,
  days: (rosterEmployee?.days || []).map((day: any) => {
    const workShiftID = day?.workShiftID ?? day?.factualWorkShiftID ?? null;
    const relatedShift = workShiftID != null
      ? shiftById.get(workShiftID) || normalizeWorkShift(day?.workShift || day?.factualWorkShift)
      : null;

    return {
      ...day,
      rosterEmployeeID: day?.rosterEmployeeID ?? day?.factualRosterEmployeeID ?? rosterEmployee?.id,
      workShiftID,
      workShift: relatedShift,
    };
  }),
});

const extractEmpWorkShiftMappings = (
  employees: any[],
  isFactualMode: boolean,
  shiftById: Map<number, WorkShift>
): EmpWorkShift[] => {
  const mappingKey = isFactualMode ? "empFactualWorkShift" : "empWorkShift";
  const shiftKey = isFactualMode ? "factualWorkShift" : "workShift";

  return employees.flatMap((employee: any) => {
    const mappings = Array.isArray(employee?.[mappingKey]) ? employee[mappingKey] : [];
    if (isFactualMode && mappings.length === 0 && employee?.workShiftID) {
      const fallbackShift = shiftById.get(employee.workShiftID) || normalizeWorkShift(employee?.workShift);
      if (fallbackShift?.id) {
        return [{
          id: Number(employee.id),
          manageEmployeeID: employee.id,
          workShiftID: employee.workShiftID,
          workShift: fallbackShift,
        }];
      }
    }

    return mappings
      .map((mapping: any) => {
        const workShiftID = mapping?.workShiftID ?? mapping?.factualWorkShiftID ?? mapping?.[shiftKey]?.id;
        if (!workShiftID) return null;

        return {
          id: mapping.id,
          manageEmployeeID: mapping.manageEmployeeID ?? employee.id,
          workShiftID,
          workShift: shiftById.get(workShiftID) || normalizeWorkShift(mapping?.[shiftKey]),
        };
      })
      .filter(Boolean) as EmpWorkShift[];
  });
};

const parseRuleCount = (value: string | number | undefined, fallback: number): number => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const incrementTrackerAndShouldApply = (
  tracker: Map<string, number>,
  key: string,
  allowedCount: number,
): boolean => {
  if (allowedCount <= 0) return false;

  const nextCount = (tracker.get(key) || 0) + 1;

  // Apply rule only on the violation AFTER the configured count.
  // Example: count=3 => apply on 4th, then start a fresh cycle.
  if (nextCount > allowedCount) {
    tracker.set(key, 0);
    return true;
  }

  tracker.set(key, nextCount);
  return false;
};

const buildStatusCacheKey = (date: string, employeeID: number, punches: string[]) =>
  `${date}-${employeeID}-${punches.join(",")}`;

const formatSummaryPunchTime = (timeStr: string) => {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
};

const getSummaryStatusBadge = (status: AttendanceStatus) => {
  switch (status.type) {
    case "ABSENT":
      return { badge: "A", badgeClass: "bg-red-100 text-red-800" };
    case "WEEK_OFF":
      return { badge: status.label === "WO-P" ? "WO-P" : "WO", badgeClass: "bg-orange-100 text-orange-800" };
    case "HOLIDAY":
      return { badge: status.label === "PH-P" ? "PH-P" : "PH", badgeClass: "bg-purple-100 text-purple-800" };
    case "LEAVE":
      return { badge: status.label === "Leave-P" ? "L-P" : "L", badgeClass: "bg-pink-100 text-pink-800" };
    case "HALF_DAY":
      return { badge: "HD", badgeClass: "bg-yellow-100 text-yellow-800" };
    case "LATE_MARK":
      return { badge: "L", badgeClass: "bg-blue-100 text-blue-800" };
    case "LATE_MARK_LIMIT":
      return { badge: "L+", badgeClass: "bg-red-200 text-red-900" };
    case "OT":
      return { badge: "OT", badgeClass: "bg-indigo-100 text-indigo-800" };
    case "REGULARIZATION":
      return { badge: "AR", badgeClass: "bg-teal-100 text-teal-800" };
    case "SANDWICH":
      return { badge: "SW", badgeClass: "bg-amber-100 text-amber-800" };
    case "SINGLE_PUNCH":
      return { badge: "no checkout", badgeClass: "bg-gray-100 text-gray-800" };
    case "PRESENT":
    default:
      return { badge: "P", badgeClass: "bg-green-100 text-green-800" };
  }
};

const formatMarkingExcelCell = (status: AttendanceStatus): string => {
  if (status.type === "OT" && status.workedMinutes && status.totalShiftMinutes && status.otMinutes) {
    return `P (${formatWorkedDuration(status.totalShiftMinutes)} + ${formatWorkedDuration(status.otMinutes)} OT)`;
  }
  if (status.type === "PRESENT" && status.workedMinutes) {
    return `P (${formatWorkedDuration(status.workedMinutes)})`;
  }
  if (status.type === "HALF_DAY" && status.workedMinutes) {
    return `HD (${formatWorkedDuration(status.workedMinutes)})`;
  }
  if (status.type === "LATE_MARK" && status.workedMinutes) {
    return `L (${formatWorkedDuration(status.workedMinutes)})`;
  }
  if ((status.type === "WEEK_OFF" || status.type === "HOLIDAY" || status.type === "LEAVE") && status.workedMinutes) {
    return `${status.label}\n${formatWorkedDuration(status.workedMinutes)}`;
  }
  return status.label;
};

const formatSummaryExcelCell = (punches: string[], status: AttendanceStatus): string => {
  const { badge } = getSummaryStatusBadge(status);
  const lines: string[] = [`Marking: ${badge}`];

  if (punches.length > 0) {
    const first = formatSummaryPunchTime(punches[0]);
    const last = punches.length >= 2 ? formatSummaryPunchTime(punches[punches.length - 1]) : "--:--";
    lines.push(`FILO: ${first} - ${last}`);
  }

  const workedMinutes = status.workedMinutes || 0;
  const otMinutes = status.otMinutes || 0;

  if (
    workedMinutes > 0 &&
    status.type !== "ABSENT" &&
    status.type !== "WEEK_OFF" &&
    status.type !== "HOLIDAY" &&
    status.type !== "LEAVE"
  ) {
    lines.push(`Work: ${formatWorkedDuration(workedMinutes)}`);
  }

  if (otMinutes > 0) {
    lines.push(`OT: ${formatWorkedDuration(otMinutes)}`);
  }

  if (
    workedMinutes > 0 &&
    status.type !== "WEEK_OFF" &&
    status.type !== "HOLIDAY" &&
    status.type !== "LEAVE"
  ) {
    lines.push(`Total: ${formatWorkedDuration(workedMinutes + otMinutes)}`);
  }

  if (punches.length === 0) {
    if (status.type === "WEEK_OFF") lines.push("Weekly Off");
    else if (status.type === "HOLIDAY") lines.push("Public Holiday");
    else if (status.type === "LEAVE") lines.push(status.label);
    else if (status.type === "ABSENT") lines.push("Absent");
  }

  return lines.join("\n");
};

const formatFILOExcelCell = (punches: string[]): string => {
  if (punches.length === 0) return "";
  if (punches.length === 1) return punches[0];
  return `${punches[0]}\n${punches[punches.length - 1]}`;
};

// ==================== MULTI SELECT COMPONENT ====================

const MultiSelect = ({ options, selectedValues, onChange, placeholder, disabled = false }: { 
  options: { value: string; label: string }[], 
  selectedValues: string[], 
  onChange: (values: string[]) => void, 
  placeholder: string,
  disabled?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };
  
  const selectAll = () => {
    const allValues = filteredOptions.map(opt => opt.value);
    onChange([...new Set([...selectedValues, ...allValues])]);
  };
  
  const clearAll = () => {
    onChange([]);
  };
  
  const getSelectedLabels = () => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) {
      const opt = options.find(o => o.value === selectedValues[0]);
      return opt?.label || placeholder;
    }
    return `${selectedValues.length} selected`;
  };
  
  return (
    <div className="relative" ref={dropdownRef}>
      <div 
        className={`w-full px-3 py-2 border rounded-md bg-white ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'cursor-pointer'} flex items-center justify-between`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="text-sm truncate">{getSelectedLabels()}</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </div>
      
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-80 overflow-hidden">
          <div className="p-2 border-b">
            <Input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-sm"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="flex gap-2 p-2 border-b">
            <Button type="button" variant="outline" size="sm" onClick={selectAll}>Select All</Button>
            <Button type="button" variant="outline" size="sm" onClick={clearAll}>Clear</Button>
          </div>
          <div className="max-h-48 overflow-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No options available</div>
            ) : (
              filteredOptions.map(opt => (
                <label key={opt.value} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(opt.value)}
                    onChange={() => toggleOption(opt.value)}
                    className="mr-2"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))
            )}
          </div>
          <div className="p-2 border-t">
            <Button type="button" size="sm" className="w-full" onClick={() => setIsOpen(false)}>Done</Button>
          </div>
        </div>
      )}
      
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedValues.slice(0, 2).map(v => {
            const opt = options.find(o => o.value === v);
            return opt ? (
              <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                {opt.label.length > 20 ? opt.label.substring(0, 20) + '...' : opt.label}
                <X className="w-3 h-3 cursor-pointer hover:text-blue-600" onClick={() => toggleOption(v)} />
              </span>
            ) : null;
          })}
          {selectedValues.length > 2 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
              +{selectedValues.length - 2} more
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ==================== DATE CELL COMPONENT ====================

const DateCell = ({ punches, date, employeeID, formData, reportData, selectedCompanyID, selectedBranchID, getComprehensiveStatus }: any) => {
  const punchesKey = punches.join(',');
  const cacheKey = buildStatusCacheKey(date, employeeID, punches);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      if (globalStatusCache.has(cacheKey)) {
        setStatus(globalStatusCache.get(cacheKey));
      } else {
        const statusesMap = new Map<string, string>();
        const result = await getComprehensiveStatus(date, employeeID, punches, selectedCompanyID, selectedBranchID, statusesMap);
        globalStatusCache.set(cacheKey, result);
        setStatus(result);
      }
    };
    fetchStatus();
  }, [cacheKey, date, employeeID, punchesKey, selectedCompanyID, selectedBranchID]);

  if (!status) {
    return <td className="px-2 py-1 border-b min-w-[80px] text-center align-top"><div className="text-[10px] text-gray-400">...</div></td>;
  }

  // ALL PUNCHES LOGS
  if (formData.reportType === "All Punches Logs") {
    if (status.type === "WEEK_OFF") {
      return (
        <td className="px-2 py-1 border-b min-w-[100px] text-center align-top">
          <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-800 text-[9px] font-medium rounded-full">WO</span>
        </td>
      );
    }
    return (
      <td className="px-2 py-1 border-b min-w-[100px] text-center align-top">
        {punches.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-1">
            {punches.map((time: string, idx: number) => (
              <span key={idx} className="inline-block px-2 py-0.5 bg-gray-800 text-white text-[9px] font-medium rounded-full">
                {time}
              </span>
            ))}
          </div>
       ) : status.type === "LEAVE" ? (
  <div className="text-[10px] font-medium text-pink-700">{status.label}</div>
) : (
  <div className="text-[10px] font-medium text-red-600">Absent</div>
)}
      </td>
    );
  }

  // FILO PUNCHES LOGS
  if (formData.reportType === "FILO Punches Logs") {
    if (status.type === "WEEK_OFF") {
      return (
        <td className="px-2 py-1 border-b min-w-[100px] text-center align-top">
          <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-800 text-[9px] font-medium rounded-full">WO</span>
        </td>
      );
    }
   if (punches.length === 0) {
  return (
    <td className="px-2 py-1 border-b min-w-[100px] text-center align-top">
      <div className={`text-[10px] font-medium ${status.type === "LEAVE" ? "text-pink-700" : "text-red-600"}`}>
        {status.type === "LEAVE" ? status.label : "Absent"}
      </div>
    </td>
  );
}
    const firstPunch = punches[0];
    const lastPunch = punches.length >= 2 ? punches[punches.length - 1] : null;
    return (
      <td className="px-2 py-1 border-b min-w-[100px] text-center align-top">
        <div className="flex flex-col gap-1">
          <span className="inline-block px-2 py-0.5 bg-green-600 text-white text-[9px] font-medium rounded-full">{firstPunch}</span>
          {lastPunch && <span className="inline-block px-2 py-0.5 bg-red-600 text-white text-[9px] font-medium rounded-full">{lastPunch}</span>}
        </div>
      </td>
    );
  }

  // ATTENDANCE MARKING LOGS
  if (formData.reportType === "Attendance Marking Logs") {
    let statusClass = "";
    if (status.type === "WEEK_OFF") statusClass = "bg-orange-100 text-orange-800";
    else if (status.type === "HOLIDAY") statusClass = "bg-purple-100 text-purple-800";
    else if (status.type === "LEAVE") statusClass = "bg-pink-100 text-pink-800";
    else if (status.type === "REGULARIZATION") statusClass = "bg-teal-100 text-teal-800";
    else if (status.type === "SANDWICH") statusClass = "bg-amber-100 text-amber-800";
    else if (status.type === "ABSENT") statusClass = "bg-red-100 text-red-800";
    else if (status.type === "PRESENT") statusClass = "bg-green-100 text-green-800";
    else if (status.type === "HALF_DAY") statusClass = "bg-yellow-100 text-yellow-800";
    else if (status.type === "LATE_MARK") statusClass = "bg-blue-100 text-blue-800";
    else if (status.type === "LATE_MARK_LIMIT") statusClass = "bg-red-200 text-red-900";
    else if (status.type === "OT") statusClass = "bg-indigo-100 text-indigo-800";
    else if (status.type === "SINGLE_PUNCH") statusClass = "bg-gray-100 text-gray-800";
    else statusClass = "bg-gray-100 text-gray-800";

    // Special status with punches - show status + working hours (WO-P, PH-P, Leave-P)
    if (status.hasPunches && punches.length > 0 && 
        (status.type === "WEEK_OFF" || status.type === "HOLIDAY" || status.type === "LEAVE")) {
      const workedMinutes = status.workedMinutes || 0;
      return (
        <td className="px-2 py-1 border-b min-w-[100px] text-center align-top">
          <div className={`text-[9px] font-bold py-1 px-2 rounded mb-1 ${statusClass}`}>{status.label}</div>
          <div className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-medium rounded-full">{formatWorkedDuration(workedMinutes)}</div>
        </td>
      );
    }

    // Regularization - always show AR badge + status label + hours
    if (status.type === "REGULARIZATION") {
      const workedMinutes = status.workedMinutes || 0;
      const regLabel = status.label || "P";
      const regStatusClass = regLabel === "P" ? "bg-green-100 text-green-800"
        : regLabel === "HD" ? "bg-yellow-100 text-yellow-800"
        : regLabel === "A" ? "bg-red-100 text-red-800"
        : "bg-teal-100 text-teal-800";
      return (
        <td className="px-2 py-1 border-b min-w-[100px] text-center align-top">
          <div className="inline-block px-2 py-0.5 bg-teal-100 text-teal-800 text-[9px] font-bold rounded-full mb-1">AR</div>
          <div className={`inline-block px-2 py-0.5 text-[9px] font-medium rounded-full mb-1 ${regStatusClass}`}>{regLabel}</div>
          {workedMinutes > 0 && <div className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-medium rounded-full">{formatWorkedDuration(workedMinutes)}</div>}
        </td>
      );
    }
    
    // OT - show total worked hours → OT badge → OT hours
    if (status.type === "OT") {
      return (
        <td className="px-2 py-1 border-b min-w-[100px] text-center align-top">
          <div className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-medium rounded-full mb-1">{formatWorkedDuration(status.workedMinutes || 0)}</div>
          <div className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[9px] font-medium rounded-full mb-1">OT</div>
          <div className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] font-medium rounded-full">+{formatWorkedDuration(status.otMinutes || 0)}</div>
          {status.rosterShiftName && <div className="block mt-0.5 text-[8px] font-medium text-gray-500">{status.rosterShiftName}</div>}
        </td>
      );
    }
    
    // Present - show P badge + working hours
    if (status.type === "PRESENT" && status.workedMinutes) {
      return (
        <td className="px-2 py-1 border-b min-w-[80px] text-center align-top">
          <div className="inline-block px-2 py-0.5 bg-green-100 text-green-800 text-[9px] font-medium rounded-full mb-1">P</div>
          <div className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-medium rounded-full">{formatWorkedDuration(status.workedMinutes)}</div>
          {status.rosterShiftName && <div className="block mt-0.5 text-[8px] font-medium text-gray-500">{status.rosterShiftName}</div>}
        </td>
      );
    }

    // Half Day - show HD badge + working hours
    if (status.type === "HALF_DAY" && status.workedMinutes) {
      return (
        <td className="px-2 py-1 border-b min-w-[80px] text-center align-top">
          <div className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[9px] font-medium rounded-full mb-1">HD</div>
          <div className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-medium rounded-full">{formatWorkedDuration(status.workedMinutes)}</div>
          {status.rosterShiftName && <div className="block mt-0.5 text-[8px] font-medium text-gray-500">{status.rosterShiftName}</div>}
        </td>
      );
    }
    
    // Late Mark - show L badge + working hours
    if (status.type === "LATE_MARK") {
      return (
        <td className="px-2 py-1 border-b min-w-[80px] text-center align-top">
          <div className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-medium rounded-full mb-1">L</div>
          <div className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-medium rounded-full">{formatWorkedDuration(status.workedMinutes || 0)}</div>
          {status.rosterShiftName && <div className="block mt-0.5 text-[8px] font-medium text-gray-500">{status.rosterShiftName}</div>}
        </td>
      );
    }

    // Single punch: show only punch-in time in Attendance Marking Logs.
    if (status.type === "SINGLE_PUNCH" && punches.length > 0) {
      return (
        <td className="px-2 py-1 border-b min-w-[80px] text-center align-top">
          <div className="inline-block px-2 py-0.5 bg-gray-100 text-gray-800 text-[9px] font-medium rounded-full">{punches[0]}</div>
        </td>
      );
    }
    
    // Sandwich - show Absent + SW badge
    if (status.type === "SANDWICH") {
      return (
        <td className="px-2 py-1 border-b min-w-[80px] text-center align-top">
          <div className="inline-block px-2 py-0.5 bg-red-100 text-red-800 text-[9px] font-medium rounded-full mb-1">Absent</div>
          <div className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold rounded-full">SW</div>
        </td>
      );
    }

    return (
      <td className="px-2 py-1 border-b min-w-[80px] text-center align-top">
        <div className={`text-[10px] font-bold py-1 px-2 rounded ${statusClass}`}>{status.label}</div>
      </td>
    );
  }

  // ==================== ATTENDANCE SUMMARY LOGS (ENHANCED FOR PAYROLL) ====================
  if (formData.reportType === "Attendance Summary Logs") {
    const firstPunch = punches.length > 0 ? formatSummaryPunchTime(punches[0]) : "";
    const lastPunch = punches.length >= 2 ? formatSummaryPunchTime(punches[punches.length - 1]) : "";
    const workedMinutes = status.workedMinutes || 0;
    const otMinutes = status.otMinutes || 0;
    const { badge: statusBadge, badgeClass } = getSummaryStatusBadge(status);
    
    return (
      <td className="px-2 py-1 border-b min-w-[140px] text-center align-top bg-white">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-center">
            <span className={`inline-block px-2 py-0.5 ${badgeClass} text-[9px] font-bold rounded-full`}>
              {statusBadge}
            </span>
            <span className="text-[8px] text-gray-400 ml-1">Marking</span>
          </div>
          
          {/* Row 2: FILO Punches (First In - Last Out) */}
          {punches.length > 0 && (
            <div className="flex items-center justify-center gap-1">
              <span className="text-[9px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                {firstPunch || "--:--"}
              </span>
              <span className="text-[8px] text-gray-400">-</span>
              <span className="text-[9px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                {lastPunch || "--:--"}
              </span>
            </div>
          )}
          
          {/* Row 3: Working Hours (in minutes) */}
          {status.type !== "ABSENT" && status.type !== "WEEK_OFF" && status.type !== "HOLIDAY" && 
           status.type !== "LEAVE" && !(status.type === "WEEK_OFF" && !status.hasPunches) && 
           !(status.type === "HOLIDAY" && !status.hasPunches) && workedMinutes > 0 && (
            <div className="flex items-center justify-center">
              <span className="text-[9px] font-semibold text-blue-700">
                {formatWorkedDuration(workedMinutes)}
              </span>
              <span className="text-[7px] text-gray-400 ml-1">Work</span>
            </div>
          )}
          
          {/* Row 4: OT Hours (in minutes) - Only show if OT exists */}
          {otMinutes > 0 && (
            <div className="flex items-center justify-center">
              <span className="text-[9px] font-semibold text-indigo-700">
                {formatWorkedDuration(otMinutes)}
              </span>
              <span className="text-[7px] text-gray-400 ml-1">OT</span>
            </div>
          )}
          
          {/* Row 5: Total Payable Hours (Work + OT) - For payroll quick reference */}
          {workedMinutes > 0 && status.type !== "WEEK_OFF" && status.type !== "HOLIDAY" && status.type !== "LEAVE" && (
            <div className="flex items-center justify-center border-t border-gray-200 pt-0.5 mt-0.5">
              <span className="text-[8px] font-bold text-gray-600">
                Total: {formatWorkedDuration(workedMinutes + otMinutes)}
              </span>
            </div>
          )}
          
          {/* Show label for non-working days without punches */}
          {punches.length === 0 && (
            <div className="text-[9px] text-gray-500 font-medium">
              {status.type === "WEEK_OFF" ? "Weekly Off" : 
               status.type === "HOLIDAY" ? "Holiday" : 
               status.type === "LEAVE" ? status.label : 
               status.type === "ABSENT" ? "Absent" : ""}
            </div>
          )}
          
        </div>
      </td>
    );
  }

  return <td className="px-2 py-1 border-b min-w-[100px] text-center align-top"><div className="text-[10px] text-gray-400"></div></td>;
};

// ==================== MAIN COMPONENT ====================

export function AttendanceReportsManagement({ mode = "actual" }: { mode?: ReportMode }) {
  const user = useCurrentUser();
  const isFactualMode = mode === "factual";
  const [searchTerm, setSearchTerm] = useState("");
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const [attendanceRegularizations, setAttendanceRegularizations] = useState<AttendanceRegularize[]>([]);
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([]);
  const [rosters, setRosters] = useState<RosterEmployee[]>([]);
  const [attendancePolicy, setAttendancePolicy] = useState<AttendancePolicy | null>(null);
  const [empWorkShifts, setEmpWorkShifts] = useState<EmpWorkShift[]>([]);
  const [sandwichOverrides, setSandwichOverrides] = useState<Map<number, Set<string>>>(new Map());
  const [factualWeekoffOverrides, setFactualWeekoffOverrides] = useState<Map<number, Set<string>>>(new Map());

  const [managerData, setManagerData] = useState<any>(null);
  const [empCreds, setEmpCreds] = useState<any>(null);

  const [formData, setFormData] = useState({
    companyID: null as number | null,
    branchName: "",
    reportType: "All Punches Logs",
    dateFrom: getFirstDayOfMonth(),
    dateTo: getTodayStr()
  });
  
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedDesignations, setSelectedDesignations] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport and update state
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get responsive widths based on viewport
  const responsiveLeftWidths = isMobile ? LEFT_WIDTHS_MOBILE : LEFT_WIDTHS;

  const lateMarkTracker = useRef(new Map<string, number>());
  const noCheckoutTracker = useRef(new Map<string, number>());
  const masterDataRef = useRef<ReportMasterData | null>(null);
  const canGenerateReports = !user
    ? true
    : isFactualMode
      ? ["SUPERADMIN", "COMPANY_ADMIN", "BRANCH_ADMIN", "ADMIN"].includes(user.role) ||
        canViewModule("REPORTS")
      : ["SUPERADMIN", "COMPANY_ADMIN", "BRANCH_ADMIN"].includes(user.role) ||
        canViewModule("REPORTS");

  const getActiveReportContext = () => {
    const ctx = getSidebarContext();
    const userAny = user as any;

    const assignedCompanyIDs = getUserAssignedCompanyIDs(userAny);

    const isCompanyScopedUser =
      user?.role === "COMPANY_ADMIN" ||
      user?.role === "ADMIN" ||
      user?.role === "BRANCH_ADMIN";

    const hasMultiCompany = assignedCompanyIDs.length > 1;
    const storedActiveCompanyID = getStoredActiveCompanyID();

    let companyID: number | null = null;

    if (user?.role === "SUPERADMIN") {
      companyID =
        formData.companyID ??
        ctx?.companyID ??
        null;
    } else if (isCompanyScopedUser) {
      if (
        hasMultiCompany &&
        storedActiveCompanyID &&
        assignedCompanyIDs.includes(Number(storedActiveCompanyID))
      ) {
        companyID = storedActiveCompanyID;
      } else if (
        hasMultiCompany &&
        ctx?.companyID &&
        assignedCompanyIDs.includes(Number(ctx.companyID))
      ) {
        companyID = Number(ctx.companyID);
      } else {
        companyID =
          managerData?.companyID ??
          user?.companyID ??
          assignedCompanyIDs[0] ??
          null;
      }
    } else if (user?.role === "SERVICE_PROVIDER") {
      companyID = managerData?.companyID ?? user?.companyID ?? null;
    } else if (user?.role === "EMPLOYEE") {
      companyID = empCreds?.companyID ?? user?.companyID ?? null;
    } else {
      companyID = formData.companyID ?? ctx?.companyID ?? user?.companyID ?? null;
    }

    let branchID: number | null =
      branches.find((b) => b.branchName === formData.branchName)?.id ?? null;

    if (user?.role === "BRANCH_ADMIN") {
      branchID = managerData?.branchesID ?? branchID;
    } else if (user?.role === "EMPLOYEE") {
      branchID = empCreds?.branchesID ?? branchID;
    }

    return {
      companyID: companyID ? Number(companyID) : null,
      branchID: branchID ? Number(branchID) : null,
    };
  };

  // ==================== LOAD BRANCH DATA ON SELECTION ====================  
 useEffect(() => {
  const loadBranchData = async () => {
    if (!formData.branchName || !formData.companyID) return;
    
    const branch = branches.find(b => b.branchName === formData.branchName);
    if (!branch) return;

    try {
      const deptsRes = await fetch(`${BACKEND_URL}/departments`);
      const deptsData = await deptsRes.json();
      const branchDepts = deptsData.filter((d: Department) => 
        d.branchesID === branch.id && d.companyID === formData.companyID
      );
      setDepartments(branchDepts);

      const desigsRes = await fetch(`${BACKEND_URL}/designations`);
      const desigsData = await desigsRes.json();
      const branchDesigs = desigsData.filter((d: Designation) => 
        d.branchesID === branch.id && d.companyID === formData.companyID
      );
      setDesignations(branchDesigs);

      const empsRes = await fetch(`${BACKEND_URL}/manage-emp`);
      const empsData = await empsRes.json();
      const branchEmps = empsData.filter((e: Employee) => 
        e.branchesID === branch.id && e.companyID === formData.companyID
      );
      setAllEmployees(branchEmps);

    } catch (error) {}
  };

  loadBranchData();
}, [formData.branchName, formData.companyID, branches]);

  // ==================== LOAD MASTER DATA ====================

  useEffect(() => {
    const loadCompanies = async () => {
      const res = await fetch(`${BACKEND_URL}/company`);
      const data = await res.json();
      setCompanies(data);
    };
    loadCompanies();
  }, []);

  useEffect(() => {
    const loadAllBranches = async () => {
      const res = await fetch(`${BACKEND_URL}/branches`);
      const data = await res.json();
      setAllBranches(data);
    };
    loadAllBranches();
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadUserData = async () => {
      try {
        if (user.role === "SERVICE_PROVIDER" || user.role === "COMPANY_ADMIN" || user.role === "ADMIN" || user.role === "BRANCH_ADMIN") {
          const usersRes = await fetch(`${BACKEND_URL}/users`);
          const users = await usersRes.json();
          const me = users.find((u: any) => u.username === user.username);
          setManagerData(me || null);
        } else if (user.role === "EMPLOYEE") {
          const credsRes = await fetch(`${BACKEND_URL}/manage-emp/credentials/all`);
          const creds = await credsRes.json();
          const me = creds.find((u: any) => u.username === user.username);
          setEmpCreds(me || null);
        }
      } catch (err) {}
    };
    loadUserData();
  }, [user]);

  // ==================== BRANCH FILTERING ====================

    useEffect(() => {
    if (!user) return;

    const ctx = getActiveReportContext();
    let data = [...allBranches];

    if (ctx.companyID) {
      data = data.filter((b) => Number(b.companyID) === Number(ctx.companyID));
    } else {
      data = [];
    }

    if (user.role === "BRANCH_ADMIN" && managerData?.branchesID) {
      data = data.filter((b) => Number(b.id) === Number(managerData.branchesID));
    }

    if (user.role === "EMPLOYEE" && empCreds?.branchesID) {
      data = data.filter((b) => Number(b.id) === Number(empCreds.branchesID));
    }

    setBranches(data);

    if (user.role !== "SUPERADMIN" && data.length > 0 && !formData.branchName) {
      const b = data[0];
      setFormData((prev) => ({
        ...prev,
        companyID: Number(b.companyID),
        branchName: b.branchName,
      }));
    }
  }, [
    user,
    managerData,
    empCreds,
    formData.companyID,
    formData.branchName,
    allBranches,
  ]);

const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  const branchName = e.target.value;
  const branch = branches.find((b) => b.branchName === branchName);

  setFormData(prev => ({
    ...prev,
    branchName,
    companyID: branch?.companyID ? Number(branch.companyID) : prev.companyID,
  }));

  // Clear filters and data — loadBranchData will repopulate for the new branch
  setDepartments([]);
  setDesignations([]);
  setAllEmployees([]);
  setSelectedDepartments([]);
  setSelectedDesignations([]);
  setSelectedEmployees([]);
};

  // ==================== FILTERED OPTIONS ====================

const filteredDesignations = designations.filter((d: Designation) => 
  selectedDepartments.length === 0 || selectedDepartments.includes(d.departmentID.toString())
);

const filteredEmployees = allEmployees.filter((e: Employee) => {
  if (selectedDesignations.length > 0) {
    if (!e.designationID || !selectedDesignations.includes(e.designationID.toString())) {
      return false;
    }
  }
  if (selectedDepartments.length > 0) {
    if (!e.departmentNameID || !selectedDepartments.includes(e.departmentNameID.toString())) {
      return false;
    }
  }
  return true;
});

const departmentOptions = departments.map((d: Department) => ({ 
  value: d.id.toString(), 
  label: d.departmentName 
}));
const designationOptions = filteredDesignations.map((d: Designation) => ({ 
  value: d.id.toString(), 
  label: d.designation 
}));

const employeeOptions = filteredEmployees.map((e: Employee) => ({ 
  value: e.id.toString(), 
  label: `${e.employeeFirstName} ${e.employeeLastName} (${e.employeeID})` 
}));

  // ==================== CALCULATION FUNCTIONS ====================

  const calculateWorkedMinutes = (
    punches: string[], 
    shiftStart: string, 
    shiftEnd: string, 
    workBreak: { breakStart: string; breakEnd: string },
    policy: AttendancePolicy | null, 
    isFlexible: boolean
  ): number => {
    if (punches.length < 2) return 0;
    
    const firstPunch = punches[0];
    const lastPunch = punches[punches.length - 1];
    
    let startTime = timeToMinutes(firstPunch);
    let endTime = timeToMinutes(lastPunch);
    
    if (!isFlexible && policy) {
      const shiftStartMin = timeToMinutes(shiftStart);
      const shiftEndMin = timeToMinutes(shiftEnd);
      
      // Cap early check-in
      if (startTime < shiftStartMin - (policy.checkin_begin_before_min || 0)) {
        startTime = shiftStartMin;
      }
      
      // Cap late check-out if OT not applicable
      if (!policy.overtimeApplicable) {
        const maxEndTime = shiftEndMin + (policy.checkout_end_after_min || 0);
        if (endTime > maxEndTime) endTime = maxEndTime;
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
      workedMinutes -= (policy.trimPreshiftMin || 0);
      workedMinutes -= (policy.trimPostshiftMin || 0);
    }
    
    return Math.round(Math.max(0, workedMinutes));
  };

  const calculateOTMinutes = (
    punches: string[], 
    shiftEndTime: string, 
    otConfig: { startTime: string; endTime: string; breakStart: string; breakEnd: string },
    policy: AttendancePolicy
  ): number => {
    if (punches.length < 2) return 0;
    if (!policy.overtimeApplicable) return 0;
    if (!otConfig.startTime || !otConfig.endTime) return 0;
    
    const lastPunch = punches[punches.length - 1];
    const lastPunchMin = timeToMinutes(lastPunch);
    const shiftEndMin = timeToMinutes(shiftEndTime);
    
    const checkoutBuffer = policy.checkout_end_after_min || 0;
    if (lastPunchMin <= shiftEndMin + checkoutBuffer) return 0;
    
    let otStartMin = Math.max(shiftEndMin, timeToMinutes(otConfig.startTime));
    let otEndMin = Math.min(lastPunchMin, timeToMinutes(otConfig.endTime));
    let totalOTMinutes = otEndMin - otStartMin;
    
    // Deduct OT break time
    if (policy.breakTimeForOT > 0) {
      totalOTMinutes -= policy.breakTimeForOT;
    }
    
    // Apply OT meal break deduction
    if (policy.otMealApply && policy.minsForBreakTimeForMeal > 0) {
      totalOTMinutes -= policy.minsForBreakTimeForMeal;
    }
    
    // Apply overtime trimming
    if (policy.overtimeTrimmingApply && policy.checkoutGracePeriodForOvertimeTrimming > 0) {
      totalOTMinutes = Math.max(0, totalOTMinutes - policy.checkoutGracePeriodForOvertimeTrimming);
    }
    
    // Apply min/max OT limits
    if (totalOTMinutes < (policy.minOvertimeHrs || 0)) return 0;
    if (policy.maxOvertimeHrs > 0 && totalOTMinutes > policy.maxOvertimeHrs) {
      totalOTMinutes = policy.maxOvertimeHrs;
    }
    
    return Math.max(0, totalOTMinutes);
  };

  // ==================== SANDWICH RULE DETECTION ====================

  const detectSandwichDates = (
    row: ReportData,
    dates: string[],
    localShifts: EmpWorkShift[],
    localLeaves: LeaveApplication[],
    localHolidays: PublicHoliday[],
    localRosters: RosterEmployee[]
  ): Set<string> => {
    const result = new Set<string>();

    const isWODay = (date: string): boolean => {
      const empShift = localShifts.find(ws => ws.manageEmployeeID === row.employee.id);
      const workShift = empShift?.workShift;
      if (!workShift?.workShiftDay?.length) return false;
      if (workShift.isRotating) {
        const roster = localRosters.find(r => r.employeeID === row.employee.id);
        const rosterDay = roster?.days?.find((d: RosterDay) => new Date(d.workDate).toISOString().split('T')[0] === date);
        return rosterDay?.dayType === "WEEKLY_OFF";
      }
      const dayOfWeek = WEEKDAYS[new Date(date).getDay()];
      const shiftDay = workShift.workShiftDay.find((d: WorkShiftDay) => d.weekDay === dayOfWeek && d.shiftType === "WORK");
      return shiftDay?.weeklyOff === true;
    };

    const isPHDay = (date: string): boolean => {
      return localHolidays.some((h: PublicHoliday) => {
        const start = new Date(h.startDate).toISOString().split('T')[0];
        const end = new Date(h.endDate).toISOString().split('T')[0];
        return date >= start && date <= end;
      });
    };

    const isSandwichTrigger = (date: string): boolean => {
      if (isWODay(date) || isPHDay(date)) return false;
      const punches = row.punches[date] || [];
      const hasLeave = localLeaves.some((l: LeaveApplication) =>
        l.manageEmployeeID === row.employee.id &&
        date >= new Date(l.fromDate).toISOString().split('T')[0] &&
        date <= new Date(l.toDate).toISOString().split('T')[0]
      );
      return punches.length === 0 || hasLeave;
    };

    let i = 0;
    while (i < dates.length) {
      const date = dates[i];
      if (isWODay(date)) {
        const woStart = i;
        while (i < dates.length && isWODay(dates[i])) i++;
        const woEnd = i - 1;

        if (woStart > 0 && woEnd + 1 < dates.length) {
          const dayBefore = dates[woStart - 1];
          const dayAfter = dates[woEnd + 1];
          if (isSandwichTrigger(dayBefore) && isSandwichTrigger(dayAfter)) {
            result.add(dayBefore);
            for (let j = woStart; j <= woEnd; j++) result.add(dates[j]);
            result.add(dayAfter);
          }
        }
      } else {
        i++;
      }
    }
    return result;
  };

  const detectFactualWeekoffDates = (
    row: ReportData,
    dates: string[],
    localShifts: EmpWorkShift[],
    localRosters: RosterEmployee[]
  ): Set<string> => {
    const result = new Set<string>();
    if (!isFactualMode) return result;

    for (const date of dates) {
      const empShift = localShifts.find(ws => ws.manageEmployeeID === row.employee.id);
      const workShift = empShift?.workShift;
      if (!workShift) continue;

      if (workShift.isRotating) {
        const roster = localRosters.find(r => r.employeeID === row.employee.id);
        const rosterDay = roster?.days?.find((day: RosterDay) => toIsoDate(day.workDate) === date);
        if (rosterDay?.dayType === "WEEKLY_OFF") {
          result.add(date);
        }
        continue;
      }

      if (!workShift.workShiftDay?.length) continue;

      const dayOfWeek = WEEKDAYS[new Date(date).getDay()];
      const shiftDay = workShift.workShiftDay.find(
        (day: WorkShiftDay) => day.weekDay === dayOfWeek && day.shiftType === "WORK"
      );
      if (shiftDay?.weeklyOff) {
        result.add(date);
      }
    }

    return result;
  };

  const applySandwichRule = (
    date: string, 
    employeeID: number, 
    statuses: Map<string, string>
  ): string | null => {
    if (!attendancePolicy?.leaveAroundHolidayCounted) return null;
    
    const currentDate = new Date(date);
    const prevDate = new Date(currentDate); prevDate.setDate(prevDate.getDate() - 1);
    const nextDate = new Date(currentDate); nextDate.setDate(nextDate.getDate() + 1);
    
    const prevDateStr = prevDate.toISOString().split('T')[0];
    const nextDateStr = nextDate.toISOString().split('T')[0];
    
    const prevStatus = statuses.get(prevDateStr) || "";
    const nextStatus = statuses.get(nextDateStr) || "";
    
    const isLeaveOrAbsent = (s: string) => 
      s.includes("Leave") || s.includes("SL") || s.includes("CL") || 
      s.includes("PL") || s.includes("LOP") || s === "Absent" || s === "A";
    
    if (isLeaveOrAbsent(prevStatus) && isLeaveOrAbsent(nextStatus)) {
      return "CL (Sandwich)";
    }
    return null;
  };

  // ==================== COMPREHENSIVE STATUS CALCULATION ====================
  
  const getComprehensiveStatus = async (
    date: string, 
    employeeID: number, 
    punches: string[], 
    selectedCompanyID: number, 
    selectedBranchID: number,
    statusesMap: Map<string, string>
  ): Promise<AttendanceStatus> => {
    const md = masterDataRef.current;
    const dataSource = md?.reportRows ?? reportData;
    const sourceEmpWorkShifts = md?.empWorkShifts ?? empWorkShifts;
    const sourceWorkShifts = md?.workShifts ?? workShifts;
    const sourceRosters = md?.rosters ?? rosters;
    const sourcePublicHolidays = md?.publicHolidays ?? publicHolidays;
    const sourceRegularizations = md?.attendanceRegularizations ?? attendanceRegularizations;
    const sourceLeaveApplications = md?.leaveApplications ?? leaveApplications;
    const sourceAttendancePolicy = md?.attendancePolicy ?? attendancePolicy;
    const sourceFactualWeekoffOverrides = md?.factualWeekoffOverrides ?? factualWeekoffOverrides;
    const sourceIsFactualMode = md?.isFactualMode ?? isFactualMode;
    
    const hasPunches = punches.length > 0;
    
    if (!dataSource || dataSource.length === 0) {
      if (!hasPunches) return { type: "ABSENT", label: "Absent", hasPunches: false };
      if (punches.length === 1) return { type: "SINGLE_PUNCH", label: "no checkout", hasPunches: true };
      return { type: "PRESENT", label: "P", hasPunches: true };
    }
    
    const employee = dataSource.find(r => r.employee.id === employeeID)?.employee;
    if (!employee) return { type: "ABSENT", label: "Absent", hasPunches: false };

    // Get work shift
    const empShift = sourceEmpWorkShifts.find(ws => ws.manageEmployeeID === employeeID);
    let workShift: WorkShift | undefined = empShift?.workShift;
    
    if (workShift && (!workShift.workShiftDay || workShift.workShiftDay.length === 0)) {
      try {
        const shiftEndpoint = sourceIsFactualMode ? "factual-work-shift" : "work-shift";
        const res = await fetch(`${BACKEND_URL}/${shiftEndpoint}/${workShift.id}`);
        if (res.ok) workShift = normalizeWorkShift(await res.json());
      } catch (err) {}
    }

    // Check roster for a date-specific work shift override.
    // rosters state is already flattened to RosterEmployee[] in generateReport.
    const rosterEmp = sourceRosters.find(r => r.employeeID === employeeID);
    const rosterDayEntry = rosterEmp?.days?.find((d: RosterDay) => new Date(d.workDate).toISOString().split('T')[0] === date);
    let rosterShiftName: string | undefined;
    if (rosterDayEntry?.dayType === "WORK" && rosterDayEntry?.workShiftID != null) {
      // Prefer the fully-enriched shift from workShifts state (has workShiftDay loaded).
      // workShifts state is populated from /work-shift in generateReport.
      const overrideShift = sourceWorkShifts.find(ws => ws.id === rosterDayEntry.workShiftID);
      if (overrideShift) {
        workShift = overrideShift;
        rosterShiftName = overrideShift.workShiftName;
      } else if (rosterDayEntry.workShift) {
        workShift = rosterDayEntry.workShift;
        rosterShiftName = rosterDayEntry.workShift.workShiftName;
      }
    }

    const isRotating = workShift?.isRotating || false;
    const isFlexible = workShift?.isFlexible || false;
    const dayOfWeek = WEEKDAYS[new Date(date).getDay()];
    const dayConfig = workShift?.workShiftDay?.find((d) => d.weekDay === dayOfWeek);
    const shiftDay =
      dayConfig?.shiftType === "WORK"
        ? dayConfig
        : workShift?.workShiftDay?.find(
            (d) => d.weekDay === dayOfWeek && d.shiftType === "WORK",
          );
    const otDay = workShift?.workShiftDay?.find(d => d.weekDay === dayOfWeek && d.shiftType === "OT");
    const defaultWorkedMinutes = shiftDay?.totalMinutes || 480;

    if (sourceIsFactualMode && sourceFactualWeekoffOverrides.get(employeeID)?.has(date)) {
      return { type: "WEEK_OFF", label: "WO", hasPunches: false, workedMinutes: defaultWorkedMinutes };
    }

    // For night shifts that span midnight, include next-day punches (checkout is on next calendar date).
    const shiftSpansMidnight = shiftDay
      ? timeToMinutes(shiftDay.endTime) < timeToMinutes(shiftDay.startTime)
      : false;
    let nextDayShiftPunches: string[] = [];
    let effectivePunchesForDate = [...punches];
    if (shiftSpansMidnight) {
      const nextDateObj = new Date(date);
      nextDateObj.setDate(nextDateObj.getDate() + 1);
      const nextDateKey = nextDateObj.toISOString().split('T')[0];
      const empRow = dataSource.find((r: ReportData) => r.employee.id === employeeID);
      nextDayShiftPunches = empRow?.punches[nextDateKey] || [];
      effectivePunchesForDate = [...punches, ...nextDayShiftPunches];
    }
    const hasPunchesEffective = effectivePunchesForDate.length > 0;

    // PRIORITY 1: Approved Regularization — placed here so we have shiftDay to compute actual hours
    const regularization = sourceRegularizations.find(reg =>
      reg.manageEmployeeID === employeeID &&
      reg.status === "Approved" &&
      new Date(reg.attendanceDate).toISOString().split('T')[0] === date
    );
    if (regularization) {
      let regWorkedMinutes: number | undefined;
      if (hasPunches && shiftDay && punches.length >= 2) {
        const sortedP = [...punches].sort();
        regWorkedMinutes = calculateWorkedMinutes(
          sortedP, shiftDay.startTime, shiftDay.endTime,
          { breakStart: shiftDay.breakStart || "", breakEnd: shiftDay.breakEnd || "" },
          null, isFlexible
        );
      } else {
        regWorkedMinutes = hasPunches ? undefined : defaultWorkedMinutes;
      }
      const reqStatus = regularization.requestedStatus;
      const regLabel = reqStatus === "PRESENT" ? "P" : reqStatus === "Half Day" ? "HD" : reqStatus === "Absent" ? "A" : reqStatus;
      return { type: "REGULARIZATION", label: regLabel, hasPunches, workedMinutes: regWorkedMinutes };
    }

    // Week off check
    const isWeekOff = (): boolean => {
      if (!workShift) return false;
      if (isRotating) {
        const roster = sourceRosters.find(r => r.employeeID === employeeID);
        const rosterDay = roster?.days?.find(d => new Date(d.workDate).toISOString().split('T')[0] === date);
        return rosterDay?.dayType === "WEEKLY_OFF";
      }
      if (dayConfig?.weeklyOff) return true;
      return shiftDay?.weeklyOff || false;
    };

    // Public holiday check
    const isPublicHolidayDay = (): boolean => {
      return sourcePublicHolidays.some(holiday => {
        if (holiday.companyID !== selectedCompanyID || holiday.branchesID !== selectedBranchID) return false;
        const holidayStart = new Date(holiday.startDate).toISOString().split('T')[0];
        const holidayEnd = new Date(holiday.endDate).toISOString().split('T')[0];
        return date >= holidayStart && date <= holidayEnd;
      });
    };

    // Leave check
// Leave check - supports dayStatuses also
const getLeaveDay = (): { leave: LeaveApplication; leaveLabel: string } | null => {
  const leave = sourceLeaveApplications.find((leave) => {
    if (
      Number(leave.manageEmployeeID) !== Number(employeeID) ||
      leave.status !== "Approved"
    ) {
      return false;
    }

    const dayStatusMatch = leave.dayStatuses?.find((d) => d.date === date);
    if (dayStatusMatch) return true;

    const from = new Date(leave.fromDate).toISOString().split("T")[0];
    const to = new Date(leave.toDate).toISOString().split("T")[0];

    return date >= from && date <= to;
  });

  if (!leave) return null;

  const dayStatus = leave.dayStatuses?.find((d) => d.date === date);

  return {
    leave,
    leaveLabel: dayStatus?.status || leave.appliedLeaveType || "Leave",
  };
};

    // PRIORITY 2: Week Off
    if (isWeekOff()) {
      return { type: "WEEK_OFF", label: "WO", hasPunches: false, workedMinutes: defaultWorkedMinutes };
    }

    // PRIORITY 3: Public Holiday (factual mode only)
    if (sourceIsFactualMode && isPublicHolidayDay()) {
      let workedMinutes = 0;
      if (hasPunches && shiftDay) {
        workedMinutes = calculateWorkedMinutes(punches, shiftDay.startTime, shiftDay.endTime, 
          { breakStart: shiftDay.breakStart || "", breakEnd: shiftDay.breakEnd || "" }, sourceAttendancePolicy, isFlexible);
      }
      return { type: "HOLIDAY", label: hasPunches ? "PH-P" : "PH", hasPunches, workedMinutes: workedMinutes || defaultWorkedMinutes };
    }

 // PRIORITY 4: Approved Leave
const approvedLeave = getLeaveDay();
if (approvedLeave) {
  return {
    type: "LEAVE",
    label: hasPunchesEffective ? `${approvedLeave.leaveLabel}-P` : approvedLeave.leaveLabel,
    hasPunches: hasPunchesEffective,
    workedMinutes: hasPunchesEffective ? undefined : defaultWorkedMinutes,
  };
}

// PRIORITY 5: Calculate based on punches
// Use effectivePunchesForDate (includes next-day punches for night shifts) for presence check.
if (!hasPunchesEffective) return { type: "ABSENT", label: "Absent", hasPunches: false };
    
    let policy = sourceAttendancePolicy;
    if (!policy) {
      try {
        const policyEndpoint = sourceIsFactualMode ? "factual-attendance-policy" : "attendance-policy";
        const res = await fetch(`${BACKEND_URL}/${policyEndpoint}?companyID=${selectedCompanyID}&branchesID=${selectedBranchID}`);
        if (res.ok) {
          const policies = await res.json();
          policy = policies.find((p: AttendancePolicy) => p.companyID === selectedCompanyID && p.branchesID === selectedBranchID) || null;
        }
      } catch (err) {}
    }

    // Handle single punch (No Check-out Punch Rule with count conditioning)
    if (!hasPunchesEffective) return { type: "ABSENT", label: "Absent", hasPunches: false };
    if (effectivePunchesForDate.length === 1) {
      if (policy) {
        const monthKey = `${employeeID}-${date.substring(0, 7)}`;
        const currentTracker = noCheckoutTracker.current;
        const maxNoCheckoutCount = parseRuleCount(policy.lateMarkCount, 3);
        const shouldApplyNoCheckoutRule = incrementTrackerAndShouldApply(currentTracker, monthKey, maxNoCheckoutCount);

        if (shouldApplyNoCheckoutRule) {
          const markAs = policy.markAs || "Half Day";
          return { type: markAs === "Absent" ? "ABSENT" : "HALF_DAY", label: markAs, hasPunches: true };
        }
      }

      return { type: "SINGLE_PUNCH", label: "no checkout", hasPunches: true };
    }

    if (shiftDay && policy) {
      // Filter punches to the valid attendance window [earliestIn, latestOut]
      // For night shifts spanning midnight, use OR logic (t >= earliestIn OR t <= latestOut)
      const checkinBeginBefore = policy.checkin_begin_before_min || 0;
      const checkoutEndAfter = policy.checkout_end_after_min || 0;
      const shiftStartMinRaw = timeToMinutes(shiftDay.startTime);
      const shiftEndMinRaw = timeToMinutes(shiftDay.endTime);
      const earliestInMin = shiftStartMinRaw - checkinBeginBefore;
      // If OT applicable and an OT shift exists for this day, allow punches up to OT end
      const otEndMin = (policy.overtimeApplicable && otDay)
        ? timeToMinutes(otDay.endTime)
        : 0;
      const latestOutMin = shiftSpansMidnight
        ? shiftEndMinRaw + checkoutEndAfter       // e.g. 05:00 + 120min = 07:00 (420)
        : Math.max(shiftEndMinRaw + checkoutEndAfter, otEndMin);
      // For night shifts, filter each part separately to avoid the previous night's checkout
      // (stored under the current calendar date key) from polluting this shift's window.
      // Current-day punches = check-in portion only (must be >= earliestIn, i.e. before midnight).
      // Next-day punches = check-out portion only (must be <= latestOut, i.e. after midnight).
      // Only pull next-day checkout when the employee hasn't fully checked out on the current night:
      //   - odd current-day punch count → last punch is a check-in without a matching check-out
      //   - zero current-day punches → need next-day data
      // Even current-day count means the punches are already paired (check-in + check-out on same night),
      // so the next-day punch would be from a different shift and must NOT be included.
      const currentDayFiltered = punches.filter((p: string) => timeToMinutes(p) >= earliestInMin);
      const nextDayFiltered = nextDayShiftPunches.filter((p: string) => timeToMinutes(p) <= latestOutMin);
      const needsNextDayCheckout = currentDayFiltered.length === 0 || currentDayFiltered.length % 2 !== 0;
      const filteredPunches: string[] = shiftSpansMidnight
        ? [...currentDayFiltered, ...(needsNextDayCheckout ? nextDayFiltered : [])]
        : effectivePunchesForDate.filter(p => {
            const t = timeToMinutes(p);
            return t >= earliestInMin && t <= latestOutMin;
          });
      // Sort: for night shifts, times after midnight (0-latestOut) are logically AFTER times before midnight
      const sortedFiltered = shiftSpansMidnight
        ? [...filteredPunches].sort((a, b) => {
            const ta = timeToMinutes(a), tb = timeToMinutes(b);
            // Times < earliestInMin are post-midnight (next day), treat as +1440
            const wa = ta < earliestInMin ? ta + 1440 : ta;
            const wb = tb < earliestInMin ? tb + 1440 : tb;
            return wa - wb;
          })
        : [...filteredPunches].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
      let effectivePunchesList = sortedFiltered;
      if (effectivePunchesForDate.length >= 2 && sortedFiltered.length < 2) {
        effectivePunchesList = [
          effectivePunchesForDate[0],
          effectivePunchesForDate[effectivePunchesForDate.length - 1],
        ];
      }
      const effectivePunches =
        effectivePunchesList.length >= 2
          ? effectivePunchesList
          : effectivePunchesList.length === 1
            ? effectivePunchesList
            : effectivePunchesForDate.length > 0
              ? [effectivePunchesForDate[0]]
              : [];

      // For night shifts, compute firstPunch/lastPunch in a way that spans midnight correctly.
      // Times in [0..latestOut] are post-midnight → add 1440 for comparison purposes.
      const toNightAwareMinutes = (t: number) => shiftSpansMidnight && t < earliestInMin ? t + 1440 : t;
      const firstPunch = toNightAwareMinutes(timeToMinutes(effectivePunches[0] ?? effectivePunchesForDate[0]));
      const lastPunch = toNightAwareMinutes(timeToMinutes(effectivePunches[effectivePunches.length - 1] ?? effectivePunchesForDate[effectivePunchesForDate.length - 1]));
      // For night shift, shiftEnd in night-aware minutes is e.g. 05:00 → 300 + 1440 = 1740
      const shiftStartMin = shiftStartMinRaw;
      const shiftEndMin = shiftSpansMidnight ? shiftEndMinRaw + 1440 : shiftEndMinRaw;
      
      const graceTime = policy.checkin_grace_time_min || 0;
      const maxLateWindowAfterGrace = policy.max_late_check_in_time || 0;
      const graceEnd = shiftStartMin + graceTime;
      const maxLateCutoffInclusive = graceEnd + maxLateWindowAfterGrace;
      const isBeyondMaxLate = !isFlexible && firstPunch > maxLateCutoffInclusive;

      const workedMinutes = calculateWorkedMinutes(effectivePunches, shiftDay.startTime, shiftDay.endTime, 
        { breakStart: shiftDay.breakStart || "", breakEnd: shiftDay.breakEnd || "" }, policy, isFlexible);
      
      const totalShiftMinutes = shiftDay.totalMinutes;
      const halfDayMin = policy.min_work_hours_half_day_min || 0;
      const requiredFullDayMinutes = isFlexible
        ? totalShiftMinutes
        : Math.max(totalShiftMinutes - graceTime, halfDayMin);

      if (isBeyondMaxLate && workedMinutes < requiredFullDayMinutes) {
        const markAs = policy.maxLateCheckinMarkAs || "Absent";
        return {
          type: markAs === "Absent" ? "ABSENT" : "HALF_DAY",
          label: markAs,
          hasPunches: true,
          workedMinutes,
        };
      }
      
      // Late mark tracking
      const isLate = !isFlexible && 
                     firstPunch > graceEnd && 
                     firstPunch <= maxLateCutoffInclusive;
      
      if (isLate) {
        const monthKey = `${employeeID}-${date.substring(0, 7)}`;
        const currentTracker = lateMarkTracker.current;
        const maxLateCount = parseRuleCount(policy.lateMarkMarkCount || policy.lateMarkCount, 3);
        const shouldApplyLateMarkRule = incrementTrackerAndShouldApply(currentTracker, monthKey, maxLateCount);

        if (shouldApplyLateMarkRule) {
          const markAs = policy.lateMarkMarkAs || policy.markAs || "Half Day";
          return { 
            type: markAs === "Absent" ? "ABSENT" : "HALF_DAY", 
            label: markAs, 
            hasPunches: true, 
            workedMinutes 
          };
        }
      }
      
      // Calculate OT — only using filtered punches within the valid attendance window
      let otMinutes = 0;
      if (otDay && policy.overtimeApplicable) {
        otMinutes = calculateOTMinutes(effectivePunches, shiftDay.endTime, {
          startTime: otDay.startTime, endTime: otDay.endTime,
          breakStart: otDay.breakStart || "", breakEnd: otDay.breakEnd || ""
        }, policy);
      }
      
      if (workedMinutes < halfDayMin) {
        return { type: "ABSENT", label: "Absent", hasPunches: true, workedMinutes };
      }

      // Early checkout allow time: checkout before cutoff is Half Day.
      const earlyCheckoutWindow = policy.earlyCheckoutBeforeEndMin || 0;
      if (effectivePunches.length >= 2 && lastPunch < shiftEndMin - earlyCheckoutWindow) {
        return { type: "HALF_DAY", label: "Half Day", hasPunches: true, workedMinutes, rosterShiftName };
      } else if (workedMinutes < requiredFullDayMinutes && !isLate) {
        // Allow grace-time minutes as still full-day, and keep late arrivals under late-mark flow.
        // Late arrivals use the late-mark rule — they accumulate to the threshold.
        return { type: "HALF_DAY", label: "Half Day", hasPunches: true, workedMinutes, rosterShiftName };
      } else if (otMinutes > 0) {
        return { type: "OT", label: "OT", hasPunches: true, workedMinutes, otMinutes, totalShiftMinutes, rosterShiftName };
      } else if (isLate) {
        return { type: "LATE_MARK", label: "Late Mark", hasPunches: true, workedMinutes, rosterShiftName };
      } else if (workedMinutes >= requiredFullDayMinutes) {
        return { type: "PRESENT", label: "P", hasPunches: true, workedMinutes, rosterShiftName };
      } else {
        return { type: "PRESENT", label: "P", hasPunches: true, workedMinutes, rosterShiftName };
      }
    }

    return { type: "PRESENT", label: "P", hasPunches: true };
  };

  // ==================== PRECOMPUTE STATUS CACHE ====================

  const precomputeReportStatuses = async (
    rows: ReportData[],
    dateColumns: string[],
    selectedCompanyID: number,
    selectedBranchID: number,
    weekoffOverrides: Map<number, Set<string>>,
  ) => {
    globalStatusCache.clear();
    lateMarkTracker.current.clear();
    noCheckoutTracker.current.clear();

    const getDisplayPunches = (employeeID: number, date: string, punches: string[]) =>
      isFactualMode && weekoffOverrides.get(employeeID)?.has(date) ? [] : punches;

    await Promise.all(
      rows.map(async (row) => {
        const empStatuses = new Map<string, string>();
        for (const date of dateColumns) {
          const punches = getDisplayPunches(row.employee.id, date, row.punches[date] || []);
          const status = await getComprehensiveStatus(
            date,
            row.employee.id,
            punches,
            selectedCompanyID,
            selectedBranchID,
            empStatuses,
          );
          empStatuses.set(date, status.label);
          globalStatusCache.set(buildStatusCacheKey(date, row.employee.id, punches), status);
        }
      }),
    );
  };

  // ==================== OPTIMIZED GENERATE REPORT ====================

  const generateReport = async () => {
    if (!formData.dateFrom || !formData.dateTo) {
      alert("Please select both Date From and Date To");
      return;
    }

    if (user && !canGenerateReports) {
      alert("You do not have access to this report.");
      return;
    }

    setLoading(true);
    lateMarkTracker.current.clear();
    noCheckoutTracker.current.clear();
    globalStatusCache.clear();
    setFactualWeekoffOverrides(new Map());
    setSandwichOverrides(new Map());

    try {
      const activeCtx = getActiveReportContext();

      let selectedCompanyID: number | null = activeCtx.companyID;
      let selectedBranchID: number | null = activeCtx.branchID;

      if (!selectedBranchID && formData.branchName) {
        selectedBranchID =
          branches.find(
            (b) =>
              b.branchName === formData.branchName &&
              Number(b.companyID) === Number(selectedCompanyID)
          )?.id || null;
      }

      if (!selectedCompanyID || !selectedBranchID) {
        alert("No company/branch resolved. Please check filters.");
        setReportData([]);
        setLoading(false);
        return;
      }

      // Load all master data in parallel
      const shiftEndpoint = isFactualMode ? "factual-work-shift" : "work-shift";
      const rosterEndpoint = isFactualMode ? "factual-rosters" : "rosters";
      const policyEndpoint = isFactualMode ? "factual-attendance-policy" : "attendance-policy";

      const [holidaysRes, shiftsRes, regRes, leavesRes, rostersRes, policyRes, empShiftRes, companiesRes, branchesRes, departmentsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/public-holiday`),
        fetch(`${BACKEND_URL}/${shiftEndpoint}`),
        fetch(`${BACKEND_URL}/emp-attendance-regularise`),
        fetch(`${BACKEND_URL}/leave-application`),
        fetch(`${BACKEND_URL}/${rosterEndpoint}`),
        fetch(`${BACKEND_URL}/${policyEndpoint}`),
        fetch(`${BACKEND_URL}/manage-emp`),
        fetch(`${BACKEND_URL}/company`),
        fetch(`${BACKEND_URL}/branches`),
        fetch(`${BACKEND_URL}/departments`),
      ]);

      const holidaysData = await holidaysRes.json();
      const shiftsData = await shiftsRes.json();
      const regData = await regRes.json();
      const leavesData = await leavesRes.json();
      const rostersData = await rostersRes.json();
      const policyData = await policyRes.json();
      const empData = await empShiftRes.json();

      const safeHolidays = Array.isArray(holidaysData) ? holidaysData : [];
      const safeShiftsData = Array.isArray(shiftsData) ? shiftsData : [];
      const safeRegData = Array.isArray(regData) ? regData : [];
      const safeLeavesData = Array.isArray(leavesData) ? leavesData : [];
      const safeRostersData = Array.isArray(rostersData) ? rostersData : [];
      const safePolicyData = Array.isArray(policyData) ? policyData : [];
      const safeEmpData = Array.isArray(empData) ? empData : [];
      const companiesData = await companiesRes.json();
      const branchesData = await branchesRes.json();
      const departmentsData = await departmentsRes.json();

      const matchesCompanyBranch = (companyID?: number | null, branchesID?: number | null) => {
        if (Number(companyID) !== Number(selectedCompanyID)) return false;
        return Number(branchesID) === Number(selectedBranchID) || branchesID == null;
      };

      let normalizedShifts = (safeShiftsData as any[])
        .map(normalizeWorkShift)
        .filter((shift: WorkShift) => matchesCompanyBranch(shift.companyID, shift.branchesID));

      if (isFactualMode) {
        try {
          const actualShiftsRes = await fetch(`${BACKEND_URL}/work-shift`);
          if (actualShiftsRes.ok) {
            const actualShiftsData = await actualShiftsRes.json();
            const actualShifts = (Array.isArray(actualShiftsData) ? actualShiftsData : [])
              .map(normalizeWorkShift)
              .filter((shift: WorkShift) => matchesCompanyBranch(shift.companyID, shift.branchesID));
            const actualById = new Map<number, WorkShift>(actualShifts.map((shift: WorkShift) => [shift.id, shift]));
            normalizedShifts = normalizedShifts.map((shift: WorkShift) => {
              if ((shift.workShiftDay?.length || 0) > 0) return shift;
              return actualById.get(shift.id) || shift;
            });
          }
        } catch (err) {}
      }

      const shiftById = new Map<number, WorkShift>(normalizedShifts.map((shift: WorkShift) => [shift.id, shift]));

      const relevantRosters = (safeRostersData as any[]).filter((roster: any) =>
        Number(roster.companyID) === Number(selectedCompanyID) && Number(roster.branchesID) === Number(selectedBranchID)
      );
      const flatRosterEmployees = relevantRosters
        .flatMap((roster: any) => roster.employees ?? [])
        .map((employee: any) => normalizeRosterEmployee(employee, shiftById));

      const selectedPolicy = (safePolicyData as AttendancePolicy[]).find(
        (policy: AttendancePolicy) => matchesCompanyBranch(policy.companyID, policy.branchesID)
      ) || null;

      const shifts = extractEmpWorkShiftMappings(safeEmpData, isFactualMode, shiftById);

      const filteredHolidays = safeHolidays.filter((h: PublicHoliday) => Number(h.companyID) === Number(selectedCompanyID) && Number(h.branchesID) === Number(selectedBranchID));
      const filteredRegularizations = safeRegData.filter((r: AttendanceRegularize) => Number(r.companyID) === Number(selectedCompanyID) && Number(r.branchesID) === Number(selectedBranchID) && r.status === "Approved");
      const filteredLeaves = safeLeavesData.filter((l: LeaveApplication) => Number(l.companyID) === Number(selectedCompanyID) && Number(l.branchesID) === Number(selectedBranchID) && l.status === "Approved");

      setPublicHolidays(filteredHolidays);
      setWorkShifts(normalizedShifts);
      setAttendanceRegularizations(filteredRegularizations);
      setLeaveApplications(filteredLeaves);
      setRosters(flatRosterEmployees);
      setAttendancePolicy(selectedPolicy);
      setEmpWorkShifts(shifts);
      
      const fromDate = new Date(formData.dateFrom);
      const toDate = new Date(formData.dateTo);
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);
      
      const queryParams = new URLSearchParams({
        dateFrom: formData.dateFrom,
        dateTo: formData.dateTo,
        limit: '10000'
      });
      
      const logsResponse = await fetch(`${BACKEND_URL}/process-att-logs?${queryParams}`);
      
      if (!logsResponse.ok) {
        throw new Error('Failed to fetch logs');
      }
      
      const result = await logsResponse.json();
      const allLogs = result.data || result;
      
      const logsData = allLogs.filter((log: ProcessAttLog) => {
        const parsed = parsePunchTime(log.punch_time);
        if (!parsed) return false;

        const logDate = new Date(parsed.dateKey);
        if (logDate < fromDate || logDate > toDate) return false;

        // Strict company/branch guard from log itself when available
        if ((log as any).companyID && Number((log as any).companyID) !== Number(selectedCompanyID)) return false;
        if ((log as any).branchesID && Number((log as any).branchesID) !== Number(selectedBranchID)) return false;

        return true;
      });

      // Build employee list from log manage_employee_id values to handle company/branch name mismatches
      const logEmployeeIdSet = new Set(
        logsData
          .filter((log: ProcessAttLog) => log.manage_employee_id != null)
          .map((log: ProcessAttLog) => Number(log.manage_employee_id))
      );

      // Use Number() coercion to handle string vs number type mismatches from API responses
      const byCompanyBranch = safeEmpData.filter((e: Employee) =>
        Number(e.companyID) === Number(selectedCompanyID) && Number(e.branchesID) === Number(selectedBranchID)
      );
      const byCompanyBranchIds = new Set(byCompanyBranch.map((e: Employee) => Number(e.id)));

      // Also include employees that appear in the returned logs (covers name-mismatch scenarios)
          // Strict report scope: do NOT include employees from logs if they are outside selected company/branch.
      const filteredEmpData: Employee[] = [...byCompanyBranch];

      setAllEmployees(filteredEmpData);

      let finalFilteredEmployees = [...filteredEmpData];

      if (selectedDepartments.length > 0) {
        finalFilteredEmployees = finalFilteredEmployees.filter(e => e.departmentNameID && selectedDepartments.includes(e.departmentNameID.toString()));
      }
      if (selectedDesignations.length > 0) {
        finalFilteredEmployees = finalFilteredEmployees.filter(e => e.designationID && selectedDesignations.includes(e.designationID.toString()));
      }
      if (selectedEmployees.length > 0) {
        finalFilteredEmployees = finalFilteredEmployees.filter(e => selectedEmployees.includes(e.id.toString()));
      }

      // Group logs by employee
      const logsByEmployee = new Map<number, ProcessAttLog[]>();
      const employeeIdSet = new Set(finalFilteredEmployees.map((e: Employee) => Number(e.id)));
      logsData.forEach((log: ProcessAttLog) => {
        const employeeId = Number(log.manage_employee_id);
        if (employeeId && employeeIdSet.has(employeeId)) {
          if (!logsByEmployee.has(employeeId)) logsByEmployee.set(employeeId, []);
          logsByEmployee.get(employeeId)!.push(log);
        }
      });

      const rows = finalFilteredEmployees.map((emp: Employee) => {
        const empLogs = logsByEmployee.get(Number(emp.id)) || [];
        const punchesByDate: { [date: string]: string[] } = {};

        empLogs.forEach((log: ProcessAttLog) => {
          const parsed = parsePunchTime(log.punch_time);
          if (parsed) {
            if (!punchesByDate[parsed.dateKey]) punchesByDate[parsed.dateKey] = [];
            punchesByDate[parsed.dateKey].push(parsed.timeStr);
          }
        });

        Object.keys(punchesByDate).forEach(date => punchesByDate[date].sort());

        const company = companiesData.find((c: Company) => Number(c.id) === Number(emp.companyID));
        const branch = branchesData.find((b: Branch) => Number(b.id) === Number(emp.branchesID));
        const dept = departmentsData.find((d: Department) => Number(d.id) === Number(emp.departmentNameID));

        return {
          employee: emp,
          punches: punchesByDate,
          companyName: company?.companyName || "N/A",
          branchName: branch?.branchName || "N/A",
          departmentName: dept?.departmentName || "N/A"
        };
      });

      setReportData(rows);

      const dateColumnsFull = buildDateRangeColumns();

      const enrichedShifts = shifts.map(s => {
        if (!s.workShift?.workShiftDay?.length) {
          const fullShift = normalizedShifts.find((ws: WorkShift) => ws.id === s.workShiftID);
          if (fullShift) return { ...s, workShift: fullShift };
        }
        return s;
      });

      const newFactualWeekoffOverrides = new Map<number, Set<string>>();
      if (isFactualMode) {
        for (const row of rows) {
          const weekoffDates = detectFactualWeekoffDates(row, dateColumnsFull, enrichedShifts, flatRosterEmployees);
          if (weekoffDates.size > 0) newFactualWeekoffOverrides.set(Number(row.employee.id), weekoffDates);
        }
      }

      masterDataRef.current = {
        reportRows: rows,
        empWorkShifts: shifts,
        workShifts: normalizedShifts,
        rosters: flatRosterEmployees,
        publicHolidays: filteredHolidays,
        attendanceRegularizations: filteredRegularizations,
        leaveApplications: filteredLeaves,
        attendancePolicy: selectedPolicy,
        factualWeekoffOverrides: newFactualWeekoffOverrides,
        isFactualMode,
      };

      await precomputeReportStatuses(
        rows,
        dateColumnsFull,
        selectedCompanyID,
        selectedBranchID,
        newFactualWeekoffOverrides,
      );

      setFactualWeekoffOverrides(newFactualWeekoffOverrides);
      setSandwichOverrides(new Map());
    } catch (err) {
      console.error("Error generating report:", err);
      alert("Error generating report.");
      setReportData([]);
      setFactualWeekoffOverrides(new Map());
      setSandwichOverrides(new Map());
      masterDataRef.current = null;
    } finally {
      setLoading(false);
    }
  };

  // ==================== DOWNLOAD EXCEL ====================

  const downloadExcel = () => {
    if (reportData.length === 0) {
      alert("No data to download");
      return;
    }

    const dateColumns = buildDateRangeColumns();
    const reportType = formData.reportType;
    const getDisplayPunches = (employeeID: number, date: string, punches: string[]) =>
      isFactualMode && factualWeekoffOverrides.get(employeeID)?.has(date) ? [] : punches;

    const metaLabels = ["S.NO", "Employee ID", "Employee Name", "Company", "Branch", "Department"];
    const metaCount = metaLabels.length;

    const formatExcelDateHeader = (iso: string) => {
      const d = new Date(`${iso}T00:00:00`);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return {
        dateLabel: `${d.getDate()}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`,
        dayLabel: days[d.getDay()],
      };
    };

    const cellValueForDate = (
      punches: string[],
      status: AttendanceStatus | undefined,
    ): string => {
      if (reportType === "FILO Punches Logs") {
        if (punches.length === 0) {
          return status?.type === "LEAVE"
            ? status.label
            : status?.type === "WEEK_OFF"
              ? "WO"
              : status?.type === "ABSENT"
                ? "Absent"
                : "";
        }
        return formatFILOExcelCell(punches);
      }
      if (reportType === "Attendance Marking Logs") {
        return status ? formatMarkingExcelCell(status) : "";
      }
      if (reportType === "Attendance Summary Logs") {
        return status ? formatSummaryExcelCell(punches, status) : "";
      }
      // All Punches Logs — timestamps on present days, "Absent" when missing
      if (punches.length > 0) return punches.join("\n");
      if (status?.type === "LEAVE") return status.label;
      if (status?.type === "WEEK_OFF") return "WO";
      if (status?.type === "ABSENT") return "Absent";
      return "";
    };

    // Row 0: meta headers + date labels (1-Jul-26)
    // Row 1: blank meta (merged) + weekday labels (Wed)
    const aoa: (string | number)[][] = [
      [
        ...metaLabels,
        ...dateColumns.map((date) => formatExcelDateHeader(date).dateLabel),
      ],
      [
        ...Array(metaCount).fill(""),
        ...dateColumns.map((date) => formatExcelDateHeader(date).dayLabel),
      ],
    ];

    const rowPunchCounts: number[] = [];

    for (let index = 0; index < filteredReportData.length; index++) {
      const row = filteredReportData[index];
      const dataRow: (string | number)[] = [
        index + 1,
        row.employee.employeeID,
        `${row.employee.employeeFirstName} ${row.employee.employeeLastName}`,
        row.companyName,
        row.branchName,
        row.departmentName || "N/A",
      ];

      let maxPunches = 1;
      for (const date of dateColumns) {
        const punches = getDisplayPunches(row.employee.id, date, row.punches[date] || []);
        const cacheKey = buildStatusCacheKey(date, row.employee.id, punches);
        const status = globalStatusCache.get(cacheKey) as AttendanceStatus | undefined;
        const value = cellValueForDate(punches, status);
        dataRow.push(value);
        if (punches.length > maxPunches) maxPunches = punches.length;
      }
      aoa.push(dataRow);
      rowPunchCounts.push(maxPunches);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

    // Merge meta header cells across the two header rows (like reference sheet)
    ws["!merges"] = Array.from({ length: metaCount }, (_, c) => ({
      s: { r: 0, c },
      e: { r: 1, c },
    }));

    const thinBorder = {
      top: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    };
    const solidFill = (rgb: string) => ({ patternType: "solid", fgColor: { rgb } });
    const looksLikePunchTimes = (cv: string) =>
      /\d{1,2}:\d{2}(:\d{2})?/.test(cv) && !cv.includes("Absent") && !cv.includes("Marking: A");

    // Soft pastel fills matching reference Excel (light pink / light green, black text)
    const ABSENT_FILL = "FCE4E4";
    const PRESENT_FILL = "E2EFDA";
    const HEADER_FILL = "F2F2F2";
    const TEXT_BLACK = "000000";

    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
        if (!ws[cellRef]) {
          ws[cellRef] = { t: "s", v: "" };
        }

        const isHeader = R <= 1;
        const isMeta = C < metaCount;
        const isDateCol = C >= metaCount;

        ws[cellRef].s = {
          font: {
            name: "Calibri",
            sz: isHeader ? 10 : 9,
            bold: isHeader,
            color: { rgb: TEXT_BLACK },
          },
          alignment: {
            horizontal: isMeta && !isHeader ? "left" : "center",
            vertical: "center",
            wrapText: true,
          },
          border: thinBorder,
        };

        if (isHeader) {
          ws[cellRef].s.fill = solidFill(HEADER_FILL);
          continue;
        }

        if (!isDateCol) continue;

        const cv = ws[cellRef].v?.toString() || "";
        if (!cv) continue;

        if (cv.includes("Absent") || cv === "A" || cv.includes("Marking: A")) {
          ws[cellRef].s.fill = solidFill(ABSENT_FILL);
          ws[cellRef].s.font = { name: "Calibri", sz: 9, bold: false, color: { rgb: TEXT_BLACK } };
        } else if (
          cv.includes("Present") ||
          cv.includes("P (") ||
          cv.includes("Marking: P") ||
          looksLikePunchTimes(cv)
        ) {
          ws[cellRef].s.fill = solidFill(PRESENT_FILL);
          ws[cellRef].s.font = { name: "Calibri", sz: 9, bold: false, color: { rgb: TEXT_BLACK } };
        } else if (cv.includes("Half Day") || cv.includes("Marking: HD") || (cv.includes("HD") && !cv.includes("PHD"))) {
          ws[cellRef].s.fill = solidFill("FFF2CC");
          ws[cellRef].s.font = { name: "Calibri", sz: 9, bold: false, color: { rgb: TEXT_BLACK } };
        } else if (cv.includes("WO") || cv.includes("Weekly Off") || cv.includes("Marking: WO")) {
          ws[cellRef].s.fill = solidFill("FCE4D6");
          ws[cellRef].s.font = { name: "Calibri", sz: 9, bold: false, color: { rgb: TEXT_BLACK } };
        } else if (cv.includes("Leave") || cv.includes("Marking: L-")) {
          ws[cellRef].s.fill = solidFill("FCE4EC");
          ws[cellRef].s.font = { name: "Calibri", sz: 9, bold: false, color: { rgb: TEXT_BLACK } };
        } else if (cv.includes("Late Mark") || cv.includes("Marking: L") || cv.startsWith("L (")) {
          ws[cellRef].s.fill = solidFill("DDEBF7");
          ws[cellRef].s.font = { name: "Calibri", sz: 9, bold: false, color: { rgb: TEXT_BLACK } };
        } else if (cv.includes("PH") || cv.includes("Public Holiday") || cv.includes("Marking: PH")) {
          ws[cellRef].s.fill = solidFill("E2D5F1");
          ws[cellRef].s.font = { name: "Calibri", sz: 9, bold: false, color: { rgb: TEXT_BLACK } };
        } else if (cv.includes("OT") || cv.includes("Marking: OT")) {
          ws[cellRef].s.fill = solidFill("D6DCE4");
          ws[cellRef].s.font = { name: "Calibri", sz: 9, bold: false, color: { rgb: TEXT_BLACK } };
        } else if (cv.includes("Regularized")) {
          ws[cellRef].s.fill = solidFill("D0F0E8");
          ws[cellRef].s.font = { name: "Calibri", sz: 9, bold: false, color: { rgb: TEXT_BLACK } };
        }
      }
    }

    const colWidths = [
      { wch: 6 },
      { wch: 14 },
      { wch: 22 },
      { wch: 18 },
      { wch: 16 },
      { wch: 22 },
    ];
    dateColumns.forEach(() => colWidths.push({ wch: 12 }));
    ws["!cols"] = colWidths;

    // Header rows + taller data rows when multiple punches (reference layout)
    ws["!rows"] = [
      { hpt: 18 },
      { hpt: 16 },
      ...rowPunchCounts.map((count) => ({ hpt: Math.max(22, count * 14) })),
    ];
    ws["!freeze"] = { x: metaCount, y: 2 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
    XLSX.writeFile(
      wb,
      `${reportType.replace(/\s+/g, "_")}_${formData.dateFrom}_to_${formData.dateTo}.xlsx`,
      { cellStyles: true },
    );
  };

  // ==================== RENDER HELPERS ====================

  const parseInputDate = (value: string) => {
    if (!value) return new Date(NaN);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value);
    return new Date(value);
  };

  const buildDateRangeColumns = (): string[] => {
    if (!formData.dateFrom || !formData.dateTo) return [];
    const start = parseInputDate(formData.dateFrom);
    const end = parseInputDate(formData.dateTo);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
    start.setHours(0, 0, 0, 0); end.setHours(0, 0, 0, 0);
    const dates: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      dates.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  };

  const formatHeaderDate = (iso: string) => {
    const d = new Date(iso);
    return { dayName: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(), dateStr: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() };
  };

  const dateColumns = buildDateRangeColumns();

  const filteredReportData = useMemo(() => {
    return reportData.filter(row => {
      const fullName = `${row.employee.employeeFirstName} ${row.employee.employeeLastName}`.toLowerCase();
      return fullName.includes(searchTerm.toLowerCase()) || row.employee.employeeID.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || row.branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.departmentName.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [reportData, searchTerm]);

  const renderDateCell = useCallback((punches: string[], date: string, employeeID: number) => {
    const activeCtx = getActiveReportContext();
    const selectedCompanyID = activeCtx.companyID;
    
    const selectedBranch = branches.find(
      (b) =>
        b.branchName === formData.branchName &&
        Number(b.companyID) === Number(selectedCompanyID)
    );

    const displayPunches = isFactualMode && factualWeekoffOverrides.get(employeeID)?.has(date) ? [] : punches;
    return <DateCell punches={displayPunches} date={date} employeeID={employeeID} formData={formData} reportData={reportData} selectedCompanyID={selectedCompanyID} selectedBranchID={selectedBranch?.id || 0} getComprehensiveStatus={getComprehensiveStatus} />;
  }, [formData, user, managerData, branches, reportData, isFactualMode, factualWeekoffOverrides]);

  const renderDateHeaders = () => dateColumns.map(date => {
    const { dayName, dateStr } = formatHeaderDate(date);
    return (
      <th key={date} className="px-2 py-1 text-center min-w-[90px] border-l border-teal-100 text-[11px] bg-teal-50 text-teal-900">
        <div className="font-semibold">{dateStr}</div>
        <div className="text-[10px] opacity-80 mt-1">{dayName}</div>
      </th>
    );
  });

  const resetForm = () => {
    setFormData(prev => ({ ...prev, dateFrom: getFirstDayOfMonth(), dateTo: getTodayStr(), branchName: "", companyID: user?.role === "SUPERADMIN" ? null : prev.companyID }));
    setReportData([]); setSearchTerm(""); setSelectedDepartments([]); setSelectedDesignations([]); setSelectedEmployees([]);
    setSandwichOverrides(new Map());
    setFactualWeekoffOverrides(new Map());
    masterDataRef.current = null;
    globalStatusCache.clear();
  };

  const showLegend = formData.reportType === "Attendance Marking Logs" || formData.reportType === "Attendance Summary Logs";

  // ==================== RENDER ====================

  if (user && !canGenerateReports) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-6 text-center text-sm text-gray-500">
            You do not have access to this report.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader icon={FileText} title="Attendance Reports" />

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {user?.role === "SUPERADMIN" && (
              <div className="space-y-2">
                <Label>Company</Label>
<select
  className="w-full px-3 py-2 border rounded-md bg-white"
  value={formData.companyID ?? ""}
  onChange={(e) => {
    const companyID = e.target.value ? Number(e.target.value) : null;

    setFormData((prev) => ({
      ...prev,
      companyID,
      branchName: "",
    }));

    setReportData([]);
    setDepartments([]);
    setDesignations([]);
    setAllEmployees([]);
    setSelectedDepartments([]);
    setSelectedDesignations([]);
    setSelectedEmployees([]);
  }}
>                  <option value="">Select company</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Branch</Label>
              <select className="w-full px-3 py-2 border rounded-md bg-white" value={formData.branchName} onChange={handleBranchChange}>
                <option value="">Select branch</option>
                {branches.map(b => <option key={b.id} value={b.branchName}>{b.branchName}</option>)}
              </select>
            </div>
            <div className="space-y-2"><Label>Departments</Label><MultiSelect options={departmentOptions} selectedValues={selectedDepartments} onChange={setSelectedDepartments} placeholder="All departments" /></div>
            <div className="space-y-2"><Label>Designations</Label><MultiSelect options={designationOptions} selectedValues={selectedDesignations} onChange={setSelectedDesignations} placeholder="All designations" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2"><Label>Employees</Label><MultiSelect options={employeeOptions} selectedValues={selectedEmployees} onChange={setSelectedEmployees} placeholder="All employees" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <select className="w-full px-3 py-2 border rounded-md bg-white" value={formData.reportType} onChange={e => setFormData(prev => ({ ...prev, reportType: e.target.value }))}>
                <option value="All Punches Logs">All Punches Logs</option><option value="FILO Punches Logs">FILO Punches Logs</option>
                <option value="Attendance Marking Logs">Attendance Marking Logs</option>
                <option value="Attendance Summary Logs">Attendance Summary Logs</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2"><Label>Date From</Label><Input type="date" value={formData.dateFrom} onChange={e => setFormData(prev => ({ ...prev, dateFrom: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Date To</Label><Input type="date" value={formData.dateTo} onChange={e => setFormData(prev => ({ ...prev, dateTo: e.target.value }))} /></div>
            <div className="col-span-2 flex items-end gap-3">
              <Button onClick={generateReport} disabled={loading}>{loading ? "Generating..." : "Generate Report"}</Button>
              <Button variant="outline" onClick={resetForm}>Reset</Button>
              <Button variant="outline" onClick={downloadExcel} disabled={reportData.length === 0}><Download className="w-4 h-4 mr-2" />Excel</Button>
            </div>
          </div>
          {showLegend && (
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <p className="text-xs font-semibold mb-2">Legend:</p>
              <div className="flex flex-wrap gap-3 text-[10px]">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-100 rounded"></div><span>P = Present</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-100 rounded"></div><span>HD = Half Day</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-100 rounded"></div><span>L = Late Mark</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-100 rounded"></div><span>OT = Overtime</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 rounded"></div><span>A = Absent</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-100 rounded"></div><span>PH = Public Holiday</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-100 rounded"></div><span>WO = Weekly Off</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-teal-100 rounded"></div><span>AR = Regularized</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-pink-100 rounded"></div><span>Leave</span></div>
              </div>
              <p className="text-[10px] text-gray-500 mt-2">Note: WO-P / PH-P / Leave-P means employee punched on Week Off/Holiday/Leave</p>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">Logs are filtered by company, branch, department (if selected) and date range. Only logs from AT devices are included.</p>
        </CardContent>
      </Card>

      {reportData.length === 0 && !loading && <Card><CardContent className="py-6 text-center text-sm text-gray-500">No logs found. Click Generate Report to load data.</CardContent></Card>}

      {reportData.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold"><FileText className="w-5 h-5" />{formData.reportType} – {filteredReportData.length} users</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full border-t border-gray-200">
              <table className="min-w-full border-collapse text-xs">
                <thead data-hrms-report-header className="bg-teal-50 text-teal-900 sticky top-0 z-20 border-b border-teal-100">
                  <tr>
                    <th 
                      className="sticky left-0 z-30 bg-teal-50 text-teal-900 px-2 py-2 text-center border-r border-teal-100" 
                      style={{ left: 0, width: responsiveLeftWidths.sno, minWidth: responsiveLeftWidths.sno }}
                    >
                      S.NO
                    </th>
                    {!isMobile && <th 
                      className="sticky z-30 bg-teal-50 text-teal-900 px-2 py-2 text-left border-r border-teal-100" 
                      style={{ left: responsiveLeftWidths.sno, width: responsiveLeftWidths.company, minWidth: responsiveLeftWidths.company }}
                    >
                      COMPANY
                    </th>}
                    {!isMobile && <th 
                      className="sticky z-30 bg-teal-50 text-teal-900 px-2 py-2 text-left border-r border-teal-100" 
                      style={{ left: responsiveLeftWidths.sno + responsiveLeftWidths.company, width: responsiveLeftWidths.branch, minWidth: responsiveLeftWidths.branch }}
                    >
                      BRANCH
                    </th>}
                    {!isMobile && <th 
                      className="sticky z-30 bg-teal-50 text-teal-900 px-2 py-2 text-left border-r border-teal-100" 
                      style={{ left: responsiveLeftWidths.sno + responsiveLeftWidths.company + responsiveLeftWidths.branch, width: responsiveLeftWidths.dept, minWidth: responsiveLeftWidths.dept }}
                    >
                      DEPT
                    </th>}
                    <th 
                      className="sticky z-30 bg-teal-50 text-teal-900 px-2 py-2 text-left border-r border-teal-100" 
                      style={{ left: responsiveLeftWidths.sno + (isMobile ? 0 : responsiveLeftWidths.company + responsiveLeftWidths.branch + responsiveLeftWidths.dept), width: responsiveLeftWidths.emp, minWidth: responsiveLeftWidths.emp }}
                    >
                      EMPLOYEE
                    </th>
                    {renderDateHeaders()}
                  </tr>
                </thead>
                <tbody>
                  {filteredReportData.map((row, index) => (
                    <tr key={row.employee.id} className="odd:bg-gray-50">
                      <td 
                        className="sticky left-0 bg-white px-2 py-2 border-b border-r text-center text-[11px] z-10" 
                        style={{ left: 0, width: responsiveLeftWidths.sno, minWidth: responsiveLeftWidths.sno }}
                      >
                        {index + 1}
                      </td>
                      {!isMobile && <td 
                        className="sticky bg-white px-2 py-2 border-b border-r text-[11px] z-10 align-top" 
                        style={{ left: responsiveLeftWidths.sno, width: responsiveLeftWidths.company, minWidth: responsiveLeftWidths.company }}
                      >
                        <div className="truncate">{row.companyName}</div>
                      </td>}
                      {!isMobile && <td 
                        className="sticky bg-white px-2 py-2 border-b border-r text-[11px] z-10 align-top" 
                        style={{ left: responsiveLeftWidths.sno + responsiveLeftWidths.company, width: responsiveLeftWidths.branch, minWidth: responsiveLeftWidths.branch }}
                      >
                        <div className="truncate">{row.branchName}</div>
                      </td>}
                      {!isMobile && <td 
                        className="sticky bg-white px-2 py-2 border-b border-r text-[11px] z-10 align-top" 
                        style={{ left: responsiveLeftWidths.sno + responsiveLeftWidths.company + responsiveLeftWidths.branch, width: responsiveLeftWidths.dept, minWidth: responsiveLeftWidths.dept }}
                      >
                        <div className="truncate">{row.departmentName || "N/A"}</div>
                      </td>}
                      <td 
                        className="sticky bg-white px-2 py-2 border-b border-r text-[11px] z-10 align-top" 
                        style={{ left: responsiveLeftWidths.sno + (isMobile ? 0 : responsiveLeftWidths.company + responsiveLeftWidths.branch + responsiveLeftWidths.dept), width: responsiveLeftWidths.emp, minWidth: responsiveLeftWidths.emp }}
                      >
                        <div className="truncate">{row.employee.employeeFirstName} {row.employee.employeeLastName}</div>
                        <div className="text-[10px] text-gray-500 truncate">({row.employee.employeeID})</div>
                      </td>
                      {dateColumns.map(date => renderDateCell(row.punches[date] || [], date, row.employee.id))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}