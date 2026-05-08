"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Search, Download, FileText, ChevronDown, X } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import * as XLSX from "xlsx";

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

// ==================== CONSTANTS ====================

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

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

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Global cache for status calculations
const globalStatusCache = new Map<string, any>();

// ==================== HELPER FUNCTIONS ====================

const parsePunchTime = (punchTime: string): { dateKey: string; timeStr: string } | null => {
  if (!punchTime) return null;
  
  if (punchTime.includes("T")) {
    const datePart = punchTime.split("T")[0];
    const timePart = punchTime.split("T")[1].split(".")[0];
    return { dateKey: datePart, timeStr: timePart };
  }
  
  const match = punchTime.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  
  if (match) {
    const [, day, month, year, hour, minute] = match;
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const timeStr = `${String(hour).padStart(2, '0')}:${minute}:00`;
    return { dateKey, timeStr };
  }
  
  return null;
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

// ==================== DATE CELL COMPONENT (UPDATED) ====================

const DateCell = ({ punches, date, employeeID, formData, reportData, selectedCompanyID, selectedBranchID, getComprehensiveStatus }: any) => {
  const punchesKey = punches.join(',');
  const cacheKey = `${date}-${employeeID}-${punchesKey}`;
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
        ) : (
          <div className="text-[10px] text-gray-400"></div>
        )}
      </td>
    );
  }

  // FILO PUNCHES LOGS
  if (formData.reportType === "FILO Punches Logs") {
    if (punches.length === 0) {
      return <td className="px-2 py-1 border-b min-w-[100px] text-center align-top"><div className="text-[10px] text-gray-400"></div></td>;
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
      const hours = Math.floor(workedMinutes / 60);
      const mins = workedMinutes % 60;
      return (
        <td className="px-2 py-1 border-b min-w-[100px] text-center align-top">
          <div className={`text-[9px] font-bold py-1 px-2 rounded mb-1 ${statusClass}`}>{status.label}</div>
          <div className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-medium rounded-full">{hours}h {mins}m</div>
        </td>
      );
    }

    // Regularization - always show AR badge + status label + hours
    if (status.type === "REGULARIZATION") {
      const workedMinutes = status.workedMinutes || 0;
      const hours = Math.floor(workedMinutes / 60);
      const mins = workedMinutes % 60;
      const regLabel = status.label || "P";
      const regStatusClass = regLabel === "P" ? "bg-green-100 text-green-800"
        : regLabel === "HD" ? "bg-yellow-100 text-yellow-800"
        : regLabel === "A" ? "bg-red-100 text-red-800"
        : "bg-teal-100 text-teal-800";
      return (
        <td className="px-2 py-1 border-b min-w-[100px] text-center align-top">
          <div className="inline-block px-2 py-0.5 bg-teal-100 text-teal-800 text-[9px] font-bold rounded-full mb-1">AR</div>
          <div className={`inline-block px-2 py-0.5 text-[9px] font-medium rounded-full mb-1 ${regStatusClass}`}>{regLabel}</div>
          {workedMinutes > 0 && <div className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-medium rounded-full">{hours}h {mins}m</div>}
        </td>
      );
    }
    
    // OT - show total worked hours → OT badge → OT hours
    if (status.type === "OT") {
      const totalHours = Math.floor((status.workedMinutes || 0) / 60);
      const totalMins = (status.workedMinutes || 0) % 60;
      const otHours = Math.floor((status.otMinutes || 0) / 60);
      const otMins = (status.otMinutes || 0) % 60;
      return (
        <td className="px-2 py-1 border-b min-w-[100px] text-center align-top">
          <div className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-medium rounded-full mb-1">{totalHours}h {totalMins}m</div>
          <div className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[9px] font-medium rounded-full mb-1">OT</div>
          <div className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] font-medium rounded-full">+{otHours}h {otMins}m</div>
          {status.rosterShiftName && <div className="block mt-0.5 text-[8px] font-medium text-gray-500">{status.rosterShiftName}</div>}
        </td>
      );
    }
    
    // Present - show P badge + working hours
    if (status.type === "PRESENT" && status.workedMinutes) {
      const hours = Math.floor(status.workedMinutes / 60);
      const mins = status.workedMinutes % 60;
      return (
        <td className="px-2 py-1 border-b min-w-[80px] text-center align-top">
          <div className="inline-block px-2 py-0.5 bg-green-100 text-green-800 text-[9px] font-medium rounded-full mb-1">P</div>
          <div className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-medium rounded-full">{hours}h {mins}m</div>
          {status.rosterShiftName && <div className="block mt-0.5 text-[8px] font-medium text-gray-500">{status.rosterShiftName}</div>}
        </td>
      );
    }

    // Half Day - show HD badge + working hours
    if (status.type === "HALF_DAY" && status.workedMinutes) {
      const hours = Math.floor(status.workedMinutes / 60);
      const mins = status.workedMinutes % 60;
      return (
        <td className="px-2 py-1 border-b min-w-[80px] text-center align-top">
          <div className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[9px] font-medium rounded-full mb-1">HD</div>
          <div className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-medium rounded-full">{hours}h {mins}m</div>
          {status.rosterShiftName && <div className="block mt-0.5 text-[8px] font-medium text-gray-500">{status.rosterShiftName}</div>}
        </td>
      );
    }
    
    // Late Mark - show L badge + working hours
    if (status.type === "LATE_MARK") {
      const hours = Math.floor((status.workedMinutes || 0) / 60);
      const mins = (status.workedMinutes || 0) % 60;
      return (
        <td className="px-2 py-1 border-b min-w-[80px] text-center align-top">
          <div className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-medium rounded-full mb-1">L</div>
          <div className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-medium rounded-full">{hours}h {mins}m</div>
          {status.rosterShiftName && <div className="block mt-0.5 text-[8px] font-medium text-gray-500">{status.rosterShiftName}</div>}
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
    
    // Helper function to format time with leading zeros
    const formatPunchTime = (timeStr: string) => {
      if (!timeStr) return "";
      const parts = timeStr.split(':');
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    };
    
    // Get first and last punch
    const firstPunch = punches.length > 0 ? formatPunchTime(punches[0]) : "";
    const lastPunch = punches.length >= 2 ? formatPunchTime(punches[punches.length - 1]) : "";
    
    // Calculate worked hours (in minutes)
    const workedMinutes = status.workedMinutes || 0;
    const workedHours = Math.floor(workedMinutes / 60);
    const workedMins = workedMinutes % 60;
    
    // Calculate OT hours (in minutes)
    const otMinutes = status.otMinutes || 0;
    const otHours = Math.floor(otMinutes / 60);
    const otMins = otMinutes % 60;
    
    // Determine status badge
    let statusBadge = "";
    let badgeClass = "";
    
    if (status.type === "ABSENT") {
      statusBadge = "A";
      badgeClass = "bg-red-100 text-red-800";
    } else if (status.type === "WEEK_OFF") {
      statusBadge = status.label === "WO-P" ? "WO-P" : "WO";
      badgeClass = "bg-orange-100 text-orange-800";
    } else if (status.type === "HOLIDAY") {
      statusBadge = status.label === "PH-P" ? "PH-P" : "PH";
      badgeClass = "bg-purple-100 text-purple-800";
    } else if (status.type === "LEAVE") {
      statusBadge = status.label === "Leave-P" ? "L-P" : "L";
      badgeClass = "bg-pink-100 text-pink-800";
    } else if (status.type === "HALF_DAY") {
      statusBadge = "HD";
      badgeClass = "bg-yellow-100 text-yellow-800";
    } else if (status.type === "REGULARIZATION") {
      statusBadge = "AR";
      badgeClass = "bg-teal-100 text-teal-800";
    } else if (status.type === "SANDWICH") {
      statusBadge = "SW";
      badgeClass = "bg-amber-100 text-amber-800";
    } else if (status.type === "SINGLE_PUNCH") {
      statusBadge = "SP";
      badgeClass = "bg-gray-100 text-gray-800";
    } else {
      statusBadge = "P";
      badgeClass = "bg-green-100 text-green-800";
    }
    
    return (
      <td className="px-2 py-1 border-b min-w-[140px] text-center align-top bg-white">
        <div className="flex flex-col gap-0.5">
          
          {/* Row 1: Status Badge */}
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
                {workedHours}h {workedMins}m
              </span>
              <span className="text-[7px] text-gray-400 ml-1">Work</span>
            </div>
          )}
          
          {/* Row 4: OT Hours (in minutes) - Only show if OT exists */}
          {otMinutes > 0 && (
            <div className="flex items-center justify-center">
              <span className="text-[9px] font-semibold text-indigo-700">
                {otHours}h {otMins}m
              </span>
              <span className="text-[7px] text-gray-400 ml-1">OT</span>
            </div>
          )}
          
          {/* Row 5: Total Payable Hours (Work + OT) - For payroll quick reference */}
          {workedMinutes > 0 && status.type !== "WEEK_OFF" && status.type !== "HOLIDAY" && status.type !== "LEAVE" && (
            <div className="flex items-center justify-center border-t border-gray-200 pt-0.5 mt-0.5">
              <span className="text-[8px] font-bold text-gray-600">
                Total: {Math.floor((workedMinutes + otMinutes) / 60)}h {(workedMinutes + otMinutes) % 60}m
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

  const lateMarkTracker = useRef(new Map<string, number>());
  const noCheckoutTracker = useRef(new Map<string, number>());
  const canGenerateReports = !user
    ? true
    : isFactualMode
      ? ["SUPERADMIN", "COMPANY_ADMIN", "BRANCH_ADMIN", "ADMIN"].includes(user.role)
      : ["SUPERADMIN", "COMPANY_ADMIN", "BRANCH_ADMIN"].includes(user.role);

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

    let data = [...allBranches];

    if (user.role === "SERVICE_PROVIDER" && managerData) {
      if (managerData.companyID) data = data.filter(b => b.companyID === managerData.companyID);
    } else if ((user.role === "COMPANY_ADMIN" || user.role === "ADMIN") && managerData) {
      if (managerData.companyID) data = data.filter(b => b.companyID === managerData.companyID);
    } else if (user.role === "BRANCH_ADMIN" && managerData) {
      if (managerData.companyID && managerData.branchesID) {
        data = data.filter(b => b.companyID === managerData.companyID && b.id === managerData.branchesID);
      }
    } else if (user.role === "EMPLOYEE" && empCreds) {
      data = data.filter(b => b.companyID === empCreds.companyID);
    } else if (user.role === "SUPERADMIN") {
      // Only show branches for the selected company; show nothing until a company is chosen
      data = formData.companyID ? data.filter(b => b.companyID === formData.companyID) : [];
    }

    setBranches(data);

    if (user.role !== "SUPERADMIN" && data.length > 0) {
      const b = data[0];
      setFormData(prev => ({ ...prev, companyID: b.companyID, branchName: b.branchName }));
    }
  }, [user, managerData, empCreds, formData.companyID, allBranches]);

const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  const branchName = e.target.value;
  setFormData(prev => ({ ...prev, branchName }));
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
        if (endTime > maxEndTime) {
          endTime = shiftEndMin;
        }
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
    
    return Math.max(0, workedMinutes);
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
    localRosters: RosterEmployee[],
    policy: AttendancePolicy | null
  ): Set<string> => {
    const result = new Set<string>();
    if (!isFactualMode || !policy?.weekoffCompulsory) return result;

    for (const date of dates) {
      const punches = row.punches[date] || [];
      if (punches.length === 0) continue;

      const empShift = localShifts.find(ws => ws.manageEmployeeID === row.employee.id);
      const workShift = empShift?.workShift;
      if (!workShift?.workShiftDay?.length) continue;

      if (workShift.isRotating) {
        const roster = localRosters.find(r => r.employeeID === row.employee.id);
        const rosterDay = roster?.days?.find((day: RosterDay) => toIsoDate(day.workDate) === date);
        if (rosterDay?.dayType === "WEEKLY_OFF") {
          result.add(date);
        }
        continue;
      }

      const dayOfWeek = WEEKDAYS[new Date(date).getDay()];
      const shiftDay = workShift.workShiftDay.find(
        (day: WorkShiftDay) => day.weekDay === dayOfWeek && day.shiftType === "WORK"
      );
      if (!shiftDay?.weeklyOff) continue;

      let hasPreviousSixPunchedDays = true;
      for (let offset = 1; offset <= 6; offset++) {
        const previousDate = addDaysToIso(date, -offset);
        if ((row.punches[previousDate] || []).length === 0) {
          hasPreviousSixPunchedDays = false;
          break;
        }
      }

      if (hasPreviousSixPunchedDays) {
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
  ): Promise<{ type: string; label: string; hasPunches: boolean; workedMinutes?: number; otMinutes?: number; totalShiftMinutes?: number; rosterShiftName?: string }> => {
    
    const hasPunches = punches.length > 0;
    
    if (!reportData || reportData.length === 0) {
      if (!hasPunches) return { type: "ABSENT", label: "Absent", hasPunches: false };
      if (punches.length === 1) return { type: "SINGLE_PUNCH", label: "Half Day", hasPunches: true };
      return { type: "PRESENT", label: "P", hasPunches: true };
    }
    
    const employee = reportData.find(r => r.employee.id === employeeID)?.employee;
    if (!employee) return { type: "ABSENT", label: "Absent", hasPunches: false };

    // PRIORITY 1.5: Sandwich Rule Override
    if (sandwichOverrides.get(employeeID)?.has(date)) {
      return { type: "SANDWICH", label: "SW", hasPunches };
    }

    // Get work shift
    const empShift = empWorkShifts.find(ws => ws.manageEmployeeID === employeeID);
    let workShift: WorkShift | undefined = empShift?.workShift;
    
    if (workShift && (!workShift.workShiftDay || workShift.workShiftDay.length === 0)) {
      try {
        const shiftEndpoint = isFactualMode ? "factual-work-shift" : "work-shift";
        const res = await fetch(`${BACKEND_URL}/${shiftEndpoint}/${workShift.id}`);
        if (res.ok) workShift = normalizeWorkShift(await res.json());
      } catch (err) {}
    }

    // Check roster for a date-specific work shift override.
    // rosters state is already flattened to RosterEmployee[] in generateReport.
    const rosterEmp = rosters.find(r => r.employeeID === employeeID);
    const rosterDayEntry = rosterEmp?.days?.find((d: RosterDay) => new Date(d.workDate).toISOString().split('T')[0] === date);
    let rosterShiftName: string | undefined;
    if (rosterDayEntry?.dayType === "WORK" && rosterDayEntry?.workShiftID != null) {
      // Prefer the fully-enriched shift from workShifts state (has workShiftDay loaded).
      // workShifts state is populated from /work-shift in generateReport.
      const overrideShift = workShifts.find(ws => ws.id === rosterDayEntry.workShiftID);
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
    const shiftDay = workShift?.workShiftDay?.find(d => d.weekDay === dayOfWeek && d.shiftType === "WORK");
    const otDay = workShift?.workShiftDay?.find(d => d.weekDay === dayOfWeek && d.shiftType === "OT");
    const defaultWorkedMinutes = shiftDay?.totalMinutes || 480;

    if (isFactualMode && factualWeekoffOverrides.get(employeeID)?.has(date)) {
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
      const empRow = reportData.find((r: ReportData) => r.employee.id === employeeID);
      nextDayShiftPunches = empRow?.punches[nextDateKey] || [];
      effectivePunchesForDate = [...punches, ...nextDayShiftPunches];
    }
    const hasPunchesEffective = effectivePunchesForDate.length > 0;

    // PRIORITY 1: Approved Regularization — placed here so we have shiftDay to compute actual hours
    const regularization = attendanceRegularizations.find(reg => 
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
        const roster = rosters.find(r => r.employeeID === employeeID);
        const rosterDay = roster?.days?.find(d => new Date(d.workDate).toISOString().split('T')[0] === date);
        return rosterDay?.dayType === "WEEKLY_OFF";
      }
      return shiftDay?.weeklyOff || false;
    };

    // Public holiday check
    const isPublicHolidayDay = (): boolean => {
      return publicHolidays.some(holiday => {
        if (holiday.companyID !== selectedCompanyID || holiday.branchesID !== selectedBranchID) return false;
        const holidayStart = new Date(holiday.startDate).toISOString().split('T')[0];
        const holidayEnd = new Date(holiday.endDate).toISOString().split('T')[0];
        return date >= holidayStart && date <= holidayEnd;
      });
    };

    // Leave check
    const isLeaveDay = (): LeaveApplication | undefined => {
      return leaveApplications.find(leave => 
        leave.manageEmployeeID === employeeID &&
        leave.status === "Approved" &&
        date >= new Date(leave.fromDate).toISOString().split('T')[0] &&
        date <= new Date(leave.toDate).toISOString().split('T')[0]
      );
    };

    // PRIORITY 2: Week Off
    if (isWeekOff()) {
      let workedMinutes = 0;
      if (hasPunches && shiftDay) {
        workedMinutes = calculateWorkedMinutes(punches, shiftDay.startTime, shiftDay.endTime, 
          { breakStart: shiftDay.breakStart || "", breakEnd: shiftDay.breakEnd || "" }, attendancePolicy, isFlexible);
      }
      return { type: "WEEK_OFF", label: hasPunches ? "WO-P" : "WO", hasPunches, workedMinutes: workedMinutes || defaultWorkedMinutes };
    }

    // PRIORITY 3: Public Holiday
    if (isPublicHolidayDay()) {
      let workedMinutes = 0;
      if (hasPunches && shiftDay) {
        workedMinutes = calculateWorkedMinutes(punches, shiftDay.startTime, shiftDay.endTime, 
          { breakStart: shiftDay.breakStart || "", breakEnd: shiftDay.breakEnd || "" }, attendancePolicy, isFlexible);
      }
      return { type: "HOLIDAY", label: hasPunches ? "PH-P" : "PH", hasPunches, workedMinutes: workedMinutes || defaultWorkedMinutes };
    }

    // PRIORITY 4: Approved Leave
    const leave = isLeaveDay();
    if (leave) {
      let workedMinutes = 0;
      if (hasPunches && shiftDay) {
        workedMinutes = calculateWorkedMinutes(punches, shiftDay.startTime, shiftDay.endTime, 
          { breakStart: shiftDay.breakStart || "", breakEnd: shiftDay.breakEnd || "" }, attendancePolicy, isFlexible);
      }
      return { type: "LEAVE", label: hasPunches ? "Leave-P" : leave.appliedLeaveType, hasPunches, workedMinutes: workedMinutes || defaultWorkedMinutes };
    }

    // Check Sandwich Rule
    const currentStatus = statusesMap.get(date) || "";
    if (currentStatus === "WO" || currentStatus === "PH") {
      const sandwichResult = applySandwichRule(date, employeeID, statusesMap);
      if (sandwichResult) return { type: "SANDWICH", label: sandwichResult, hasPunches };
    }

    // PRIORITY 5: Calculate based on punches
    // Use effectivePunchesForDate (includes next-day punches for night shifts) for presence check.
    if (!hasPunchesEffective) return { type: "ABSENT", label: "Absent", hasPunches: false };
    
    let policy = attendancePolicy;
    if (!policy) {
      try {
        const policyEndpoint = isFactualMode ? "factual-attendance-policy" : "attendance-policy";
        const res = await fetch(`${BACKEND_URL}/${policyEndpoint}?companyID=${selectedCompanyID}&branchesID=${selectedBranchID}`);
        if (res.ok) {
          const policies = await res.json();
          policy = policies.find((p: AttendancePolicy) => p.companyID === selectedCompanyID && p.branchesID === selectedBranchID) || null;
        }
      } catch (err) {}
    }

    // Handle single punch
    if (!hasPunchesEffective) return { type: "ABSENT", label: "Absent", hasPunches: false };
    if (effectivePunchesForDate.length === 1) {
      if (policy?.markAs) {
        return { type: "SINGLE_PUNCH", label: policy.markAs, hasPunches: true };
      }
      return { type: "SINGLE_PUNCH", label: "Half Day", hasPunches: true };
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
      // If filtering removes all punches, fall through as absent
      const effectivePunches = sortedFiltered.length >= 2 ? sortedFiltered : (sortedFiltered.length === 1 ? sortedFiltered : effectivePunchesForDate.length > 0 ? [effectivePunchesForDate[0]] : []);

      // For night shifts, compute firstPunch/lastPunch in a way that spans midnight correctly.
      // Times in [0..latestOut] are post-midnight → add 1440 for comparison purposes.
      const toNightAwareMinutes = (t: number) => shiftSpansMidnight && t < earliestInMin ? t + 1440 : t;
      const firstPunch = toNightAwareMinutes(timeToMinutes(effectivePunches[0] ?? effectivePunchesForDate[0]));
      const lastPunch = toNightAwareMinutes(timeToMinutes(effectivePunches[effectivePunches.length - 1] ?? effectivePunchesForDate[effectivePunchesForDate.length - 1]));
      // For night shift, shiftEnd in night-aware minutes is e.g. 05:00 → 300 + 1440 = 1740
      const shiftStartMin = shiftStartMinRaw;
      const shiftEndMin = shiftSpansMidnight ? shiftEndMinRaw + 1440 : shiftEndMinRaw;
      
      // Check max late check-in first
      const maxLateWindow = policy.max_late_check_in_time || 0;
      if (!isFlexible && firstPunch > shiftStartMin + maxLateWindow) {
        const markAs = policy.maxLateCheckinMarkAs || "Absent";
        return { 
          type: markAs === "Absent" ? "ABSENT" : "HALF_DAY", 
          label: markAs, 
          hasPunches: true 
        };
      }
      
      // Check early checkout — use filtered last punch
      const earlyCheckoutWindow = policy.earlyCheckoutBeforeEndMin || 0;
      if (!isFlexible && effectivePunches.length >= 2 && lastPunch < shiftEndMin - earlyCheckoutWindow) {
        const monthKey = `${employeeID}-${date.substring(0, 7)}`;
        const currentTracker = noCheckoutTracker.current;
        const newCount = (currentTracker.get(monthKey) || 0) + 1;
        currentTracker.set(monthKey, newCount);
        
        const maxEarlyCount = parseInt(policy.lateMarkCount || "3");
        if (newCount === maxEarlyCount) {
          const markAs = policy.markAs || "Half Day";
          return { type: markAs === "Absent" ? "ABSENT" : "HALF_DAY", label: markAs, hasPunches: true };
        }
      }
      
      const workedMinutes = calculateWorkedMinutes(effectivePunches, shiftDay.startTime, shiftDay.endTime, 
        { breakStart: shiftDay.breakStart || "", breakEnd: shiftDay.breakEnd || "" }, policy, isFlexible);
      
      const totalShiftMinutes = shiftDay.totalMinutes;
      const halfDayMin = policy.min_work_hours_half_day_min || 0;
      const graceTime = policy.checkin_grace_time_min || 0;
      
      // Late mark tracking
      const isLate = !isFlexible && 
                     firstPunch > shiftStartMin + graceTime && 
                     firstPunch <= shiftStartMin + maxLateWindow;
      
      if (isLate) {
        const monthKey = `${employeeID}-${date.substring(0, 7)}`;
        const currentTracker = lateMarkTracker.current;
        const newCount = (currentTracker.get(monthKey) || 0) + 1;
        currentTracker.set(monthKey, newCount);
        
        const maxLateCount = parseInt(policy.lateMarkMarkCount || policy.lateMarkCount || "3");
        
        if (newCount === maxLateCount) {
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
      } else if (workedMinutes < totalShiftMinutes && !isLate) {
        // Only mark as Half Day due to hours if it's NOT a late arrival.
        // Late arrivals use the late-mark rule — they accumulate to the threshold.
        return { type: "HALF_DAY", label: "Half Day", hasPunches: true, workedMinutes, rosterShiftName };
      } else if (otMinutes > 0) {
        return { type: "OT", label: "OT", hasPunches: true, workedMinutes, otMinutes, totalShiftMinutes, rosterShiftName };
      } else if (isLate) {
        return { type: "LATE_MARK", label: "Late Mark", hasPunches: true, workedMinutes, rosterShiftName };
      } else {
        return { type: "PRESENT", label: "P", hasPunches: true, workedMinutes, rosterShiftName };
      }
    }

    return { type: "PRESENT", label: "P", hasPunches: true };
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
      let selectedCompanyID: number | null = formData.companyID;
      let selectedBranchID: number | null = branches.find(b => b.branchName === formData.branchName)?.id || null;

      if (user?.role === "COMPANY_ADMIN" && managerData?.companyID) {
        selectedCompanyID = managerData.companyID;
      } else if (user?.role === "BRANCH_ADMIN" && managerData) {
        selectedCompanyID = managerData.companyID;
        selectedBranchID = managerData.branchesID;
      } else if (user?.role === "SERVICE_PROVIDER" && managerData) {
        selectedCompanyID = managerData.companyID;
        selectedBranchID = managerData.branchesID;
      } else if (user?.role === "EMPLOYEE" && empCreds) {
        selectedCompanyID = empCreds.companyID;
        selectedBranchID = empCreds.branchesID;
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

      const [holidaysRes, shiftsRes, regRes, leavesRes, rostersRes, policyRes, empShiftRes] = await Promise.all([
        fetch(`${BACKEND_URL}/public-holiday`),
        fetch(`${BACKEND_URL}/${shiftEndpoint}`),
        fetch(`${BACKEND_URL}/emp-attendance-regularise`),
        fetch(`${BACKEND_URL}/leave-application`),
        fetch(`${BACKEND_URL}/${rosterEndpoint}`),
        fetch(`${BACKEND_URL}/${policyEndpoint}`),
        fetch(`${BACKEND_URL}/manage-emp`),
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

      const matchesCompanyBranch = (companyID?: number | null, branchesID?: number | null) => {
        if (Number(companyID) !== Number(selectedCompanyID)) return false;
        return Number(branchesID) === Number(selectedBranchID) || branchesID == null;
      };

      const normalizedShifts = (safeShiftsData as any[])
        .map(normalizeWorkShift)
        .filter((shift: WorkShift) => matchesCompanyBranch(shift.companyID, shift.branchesID));
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

      setPublicHolidays(safeHolidays.filter((h: PublicHoliday) => Number(h.companyID) === Number(selectedCompanyID) && Number(h.branchesID) === Number(selectedBranchID)));
      setWorkShifts(normalizedShifts);
      setAttendanceRegularizations(safeRegData.filter((r: AttendanceRegularize) => Number(r.companyID) === Number(selectedCompanyID) && Number(r.branchesID) === Number(selectedBranchID) && r.status === "Approved"));
      setLeaveApplications(safeLeavesData.filter((l: LeaveApplication) => Number(l.companyID) === Number(selectedCompanyID) && Number(l.branchesID) === Number(selectedBranchID) && l.status === "Approved"));
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
        return logDate >= fromDate && logDate <= toDate;
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
      const empFromLogs = safeEmpData.filter((e: Employee) =>
        logEmployeeIdSet.has(Number(e.id)) && !byCompanyBranchIds.has(Number(e.id))
      );

      const filteredEmpData: Employee[] = [...byCompanyBranch, ...empFromLogs];
      setAllEmployees(filteredEmpData);

      const companiesData = await fetch(`${BACKEND_URL}/company`).then(r => r.json());
      const branchesData = await fetch(`${BACKEND_URL}/branches`).then(r => r.json());
      const departmentsData = await fetch(`${BACKEND_URL}/departments`).then(r => r.json());

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

      // Process logs in chunks for better performance
      const logsByEmployee = new Map<number, ProcessAttLog[]>();
      const chunkSize = 500;
      for (let i = 0; i < logsData.length; i += chunkSize) {
        const chunk = logsData.slice(i, i + chunkSize);
        chunk.forEach((log: ProcessAttLog) => {
          const employeeId = Number(log.manage_employee_id);
          if (employeeId && finalFilteredEmployees.some(e => Number(e.id) === employeeId)) {
            if (!logsByEmployee.has(employeeId)) logsByEmployee.set(employeeId, []);
            logsByEmployee.get(employeeId)!.push(log);
          }
        });
        // Allow UI to breathe
        await new Promise(resolve => setTimeout(resolve, 0));
      }

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

      // Compute sandwich overrides for UI display
      const dateColumnsFull = buildDateRangeColumns();
      const filteredHols = safeHolidays.filter((h: any) => Number(h.companyID) === Number(selectedCompanyID) && Number(h.branchesID) === Number(selectedBranchID));
      const filteredLvs = safeLeavesData.filter((l: any) => Number(l.companyID) === Number(selectedCompanyID) && Number(l.branchesID) === Number(selectedBranchID) && l.status === "Approved");

      // Enrich emp-to-workshift mappings with full workShiftDay data from the already-fetched shiftsData,
      // because the /manage-emp endpoint includes workShift but NOT workShiftDay.
      const enrichedShifts = shifts.map(s => {
        if (!s.workShift?.workShiftDay?.length) {
          const fullShift = normalizedShifts.find((ws: WorkShift) => ws.id === s.workShiftID);
          if (fullShift) return { ...s, workShift: fullShift };
        }
        return s;
      });

      const newFactualWeekoffOverrides = new Map<number, Set<string>>();
      if (isFactualMode && selectedPolicy?.weekoffCompulsory) {
        for (const row of rows) {
          const weekoffDates = detectFactualWeekoffDates(row, dateColumnsFull, enrichedShifts, flatRosterEmployees, selectedPolicy);
          if (weekoffDates.size > 0) newFactualWeekoffOverrides.set(Number(row.employee.id), weekoffDates);
        }
      }
      setFactualWeekoffOverrides(newFactualWeekoffOverrides);

      const newSandwichOverrides = new Map<number, Set<string>>();
      for (const row of rows) {
        const swDates = detectSandwichDates(row, dateColumnsFull, enrichedShifts, filteredLvs, filteredHols, flatRosterEmployees);
        if (swDates.size > 0) newSandwichOverrides.set(Number(row.employee.id), swDates);
      }
      setSandwichOverrides(newSandwichOverrides);
    } catch (err) {
      console.error("Error generating report:", err);
      alert("Error generating report.");
      setReportData([]);
      setFactualWeekoffOverrides(new Map());
      setSandwichOverrides(new Map());
    } finally {
      setLoading(false);
    }
  };

  // ==================== DOWNLOAD EXCEL ====================

  const downloadExcel = async () => {
    if (reportData.length === 0) {
      alert("No data to download");
      return;
    }

    const dateColumns = buildDateRangeColumns();
    
    let selectedCompanyID = formData.companyID;
    if (user?.role === "COMPANY_ADMIN" && managerData?.companyID) selectedCompanyID = managerData.companyID;
    else if (user?.role === "BRANCH_ADMIN" && managerData?.companyID) selectedCompanyID = managerData.companyID;
    else if (user?.role === "SERVICE_PROVIDER" && managerData?.companyID) selectedCompanyID = managerData.companyID;
    
    const selectedBranch = branches.find(b => b.branchName === formData.branchName);
    const selectedBranchID = selectedBranch?.id || 0;
    const getDisplayPunches = (employeeID: number, date: string, punches: string[]) =>
      isFactualMode && factualWeekoffOverrides.get(employeeID)?.has(date) ? [] : punches;
    
    const excelData: any[] = [];
    const statusesMap = new Map<string, string>();
    
    const headerRow: any = {
      "S.NO": "S.NO", "Employee ID": "Employee ID", "Employee Name": "Employee Name",
      "Company": "Company", "Branch": "Branch", "Department": "Department"
    };
    dateColumns.forEach(date => {
      const { dayName, dateStr } = formatHeaderDate(date);
      headerRow[date] = `${dateStr}\n${dayName}`;
    });
    excelData.push(headerRow);

    for (let index = 0; index < filteredReportData.length; index++) {
      const row = filteredReportData[index];
      const dataRow: any = {
        "S.NO": index + 1,
        "Employee ID": row.employee.employeeID,
        "Employee Name": `${row.employee.employeeFirstName} ${row.employee.employeeLastName}`,
        "Company": row.companyName, "Branch": row.branchName, "Department": row.departmentName || "N/A"
      };

      for (const date of dateColumns) {
        const punches = getDisplayPunches(row.employee.id, date, row.punches[date] || []);
        const status = await getComprehensiveStatus(date, row.employee.id, punches, selectedCompanyID!, selectedBranchID, statusesMap);
        statusesMap.set(date, status.label);
        
        if (formData.reportType === "FILO Punches Logs") {
          dataRow[date] = punches.length === 0 ? "" : punches.length === 1 ? punches[0] : `${punches[0]}\n${punches[punches.length - 1]}`;
        } else if (formData.reportType === "Attendance Marking Logs") {
          let displayLabel = status.label;
          if (status.type === "OT" && status.workedMinutes && status.totalShiftMinutes && status.otMinutes) {
            const nh = Math.floor(status.totalShiftMinutes / 60), nm = status.totalShiftMinutes % 60;
            const oh = Math.floor(status.otMinutes / 60), om = status.otMinutes % 60;
            displayLabel = `P (${nh}h${nm}m + ${oh}h${om}m OT)`;
          } else if (status.type === "PRESENT" && status.workedMinutes) {
            const h = Math.floor(status.workedMinutes / 60), m = status.workedMinutes % 60;
            displayLabel = `P (${h}h${m}m)`;
          } else if (status.type === "HALF_DAY" && status.workedMinutes) {
            const h = Math.floor(status.workedMinutes / 60), m = status.workedMinutes % 60;
            displayLabel = `HD (${h}h${m}m)`;
          } else if ((status.type === "WEEK_OFF" || status.type === "HOLIDAY" || status.type === "LEAVE") && status.workedMinutes) {
            const h = Math.floor(status.workedMinutes / 60), m = status.workedMinutes % 60;
            displayLabel = `${status.label}\n${h}h${m}m`;
          }
          dataRow[date] = displayLabel;
        } else if (formData.reportType === "Attendance Summary Logs") {
          let displayLabel = status.label;
          if (status.type === "WEEK_OFF") {
            displayLabel = status.label === "WO-P" ? "Weekly Off (Present)" : "Weekly Off";
            if (status.workedMinutes) { const h = Math.floor(status.workedMinutes / 60), m = status.workedMinutes % 60; displayLabel += `\n${h}h${m}m`; }
          } else if (status.type === "HOLIDAY") {
            displayLabel = status.label === "PH-P" ? "Public Holiday (Present)" : "Public Holiday";
            if (status.workedMinutes) { const h = Math.floor(status.workedMinutes / 60), m = status.workedMinutes % 60; displayLabel += `\n${h}h${m}m`; }
          } else if (status.type === "LEAVE") {
            displayLabel = status.label === "Leave-P" ? "Leave (Present)" : status.label;
            if (status.workedMinutes) { const h = Math.floor(status.workedMinutes / 60), m = status.workedMinutes % 60; displayLabel += `\n${h}h${m}m`; }
          } else if (status.type === "ABSENT") {
            displayLabel = "Absent";
          } else if (status.type === "PRESENT" && status.workedMinutes) {
            displayLabel = `Present (${Math.floor(status.workedMinutes / 60)}h${status.workedMinutes % 60}m)`;
          } else if (status.type === "HALF_DAY" && status.workedMinutes) {
            displayLabel = `Half Day (${Math.floor(status.workedMinutes / 60)}h${status.workedMinutes % 60}m)`;
          } else if (status.type === "OT" && status.workedMinutes && status.totalShiftMinutes && status.otMinutes) {
            const nh = Math.floor(status.totalShiftMinutes / 60), nm = status.totalShiftMinutes % 60;
            const oh = Math.floor(status.otMinutes / 60), om = status.otMinutes % 60;
            displayLabel = `Present (${nh}h${nm}m + ${oh}h${om}m OT)`;
          }
          dataRow[date] = displayLabel;
        } else {
          dataRow[date] = punches.length > 0 ? punches.join("\n") : "";
        }
      }
      excelData.push(dataRow);
    }

    const ws = XLSX.utils.json_to_sheet(excelData, { skipHeader: true });
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
        if (!ws[cellRef]) continue;
        ws[cellRef].s = {
          font: { name: "Arial", sz: 9 },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: { top: { style: "thin", color: { rgb: "CCCCCC" } }, left: { style: "thin", color: { rgb: "CCCCCC" } }, bottom: { style: "thin", color: { rgb: "CCCCCC" } }, right: { style: "thin", color: { rgb: "CCCCCC" } } }
        };
        if (R === 0) {
          ws[cellRef].s.fill = { fgColor: { rgb: "1F2937" } };
          ws[cellRef].s.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFF" } };
        } else {
          if (R % 2 === 1) ws[cellRef].s.fill = { fgColor: { rgb: "F9FAFB" } };
          if (C >= 6) {
            const cv = ws[cellRef].v?.toString() || "";
            if (cv.includes("Absent") || cv === "A") { ws[cellRef].s.fill = { fgColor: { rgb: "FEE2E2" } }; ws[cellRef].s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "991B1B" } }; }
            else if (cv.includes("Present") || cv.includes("P (")) { ws[cellRef].s.fill = { fgColor: { rgb: "DCFCE7" } }; ws[cellRef].s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "166534" } }; }
            else if (cv.includes("Half Day") || cv.includes("HD")) { ws[cellRef].s.fill = { fgColor: { rgb: "FEF9C3" } }; ws[cellRef].s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "854D0E" } }; }
            else if (cv.includes("Late Mark")) { ws[cellRef].s.fill = { fgColor: { rgb: "DBEAFE" } }; ws[cellRef].s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "1E40AF" } }; }
            else if (cv.includes("OT") || cv.includes("+")) { ws[cellRef].s.fill = { fgColor: { rgb: "E0E7FF" } }; ws[cellRef].s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "3730A3" } }; }
            else if (cv.includes("PH") || cv.includes("Public Holiday")) { ws[cellRef].s.fill = { fgColor: { rgb: "F3E8FF" } }; ws[cellRef].s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "6B21A8" } }; }
            else if (cv.includes("WO") || cv.includes("Weekly Off")) { ws[cellRef].s.fill = { fgColor: { rgb: "FFEDD5" } }; ws[cellRef].s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "9A3412" } }; }
            else if (cv.includes("Leave")) { ws[cellRef].s.fill = { fgColor: { rgb: "FCE7F3" } }; ws[cellRef].s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "9D174D" } }; }
            else if (cv.includes("Regularized")) { ws[cellRef].s.fill = { fgColor: { rgb: "CCFBF1" } }; ws[cellRef].s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "115E59" } }; }
          }
        }
      }
    }
    
    const colWidths = [{ wch: 6 }, { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 18 }];
    dateColumns.forEach(() => colWidths.push({ wch: 18 }));
    ws['!cols'] = colWidths;
    ws['!freeze'] = { x: 6, y: 1 };
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
    XLSX.writeFile(wb, `${formData.reportType.replace(/\s+/g, '_')}_${formData.dateFrom}_to_${formData.dateTo}.xlsx`);
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
    let selectedCompanyID = formData.companyID;
    if (user?.role === "COMPANY_ADMIN" && managerData?.companyID) selectedCompanyID = managerData.companyID;
    else if (user?.role === "BRANCH_ADMIN" && managerData?.companyID) selectedCompanyID = managerData.companyID;
    else if (user?.role === "SERVICE_PROVIDER" && managerData?.companyID) selectedCompanyID = managerData.companyID;
    const selectedBranch = branches.find(b => b.branchName === formData.branchName);
    const displayPunches = isFactualMode && factualWeekoffOverrides.get(employeeID)?.has(date) ? [] : punches;
    return <DateCell punches={displayPunches} date={date} employeeID={employeeID} formData={formData} reportData={reportData} selectedCompanyID={selectedCompanyID} selectedBranchID={selectedBranch?.id || 0} getComprehensiveStatus={getComprehensiveStatus} />;
  }, [formData, user, managerData, branches, reportData, isFactualMode, factualWeekoffOverrides]);

  const renderDateHeaders = () => dateColumns.map(date => {
    const { dayName, dateStr } = formatHeaderDate(date);
    return (
      <th key={date} className="px-2 py-1 text-center min-w-[90px] border-l border-gray-500 text-[11px] bg-gray-900">
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
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4">
      <div className="flex items-center justify-between w-full"><div className="min-w-0 flex-1"><p className="text-gray-600 mt-1 text-sm">Generate and view attendance logs by company, branch, department and date range.</p></div></div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2">Attendance Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {user?.role === "SUPERADMIN" && (
              <div className="space-y-2">
                <Label>Company</Label>
                <select className="w-full px-3 py-2 border rounded-md bg-white" value={formData.companyID ?? ""} onChange={e => { setFormData(prev => ({ ...prev, companyID: e.target.value ? Number(e.target.value) : null, branchName: "" })); setDepartments([]); setDesignations([]); setAllEmployees([]); setSelectedDepartments([]); setSelectedDesignations([]); setSelectedEmployees([]); }}>
                  <option value="">Select company</option>
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
                <thead className="bg-gray-900 text-white sticky top-0 z-20">
                  <tr>
                    <th 
                      className="sticky left-0 z-30 bg-gray-900 px-2 py-2 text-center border-r border-gray-700" 
                      style={{ left: 0, width: LEFT_WIDTHS.sno, minWidth: LEFT_WIDTHS.sno }}
                    >
                      S.NO
                    </th>
                    <th 
                      className="sticky z-30 bg-gray-900 px-2 py-2 text-left border-r border-gray-700" 
                      style={{ left: LEFT_WIDTHS.sno, width: LEFT_WIDTHS.company, minWidth: LEFT_WIDTHS.company }}
                    >
                      COMPANY
                    </th>
                    <th 
                      className="sticky z-30 bg-gray-900 px-2 py-2 text-left border-r border-gray-700" 
                      style={{ left: LEFT_WIDTHS.sno + LEFT_WIDTHS.company, width: LEFT_WIDTHS.branch, minWidth: LEFT_WIDTHS.branch }}
                    >
                      BRANCH
                    </th>
                    <th 
                      className="sticky z-30 bg-gray-900 px-2 py-2 text-left border-r border-gray-700" 
                      style={{ left: LEFT_WIDTHS.sno + LEFT_WIDTHS.company + LEFT_WIDTHS.branch, width: LEFT_WIDTHS.dept, minWidth: LEFT_WIDTHS.dept }}
                    >
                      DEPT
                    </th>
                    <th 
                      className="sticky z-30 bg-gray-900 px-2 py-2 text-left border-r border-gray-700" 
                      style={{ left: LEFT_WIDTHS.sno + LEFT_WIDTHS.company + LEFT_WIDTHS.branch + LEFT_WIDTHS.dept, width: LEFT_WIDTHS.emp, minWidth: LEFT_WIDTHS.emp }}
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
                        style={{ left: 0, width: LEFT_WIDTHS.sno, minWidth: LEFT_WIDTHS.sno }}
                      >
                        {index + 1}
                      </td>
                      <td 
                        className="sticky bg-white px-2 py-2 border-b border-r text-[11px] z-10 align-top" 
                        style={{ left: LEFT_WIDTHS.sno, width: LEFT_WIDTHS.company, minWidth: LEFT_WIDTHS.company }}
                      >
                        <div className="truncate">{row.companyName}</div>
                      </td>
                      <td 
                        className="sticky bg-white px-2 py-2 border-b border-r text-[11px] z-10 align-top" 
                        style={{ left: LEFT_WIDTHS.sno + LEFT_WIDTHS.company, width: LEFT_WIDTHS.branch, minWidth: LEFT_WIDTHS.branch }}
                      >
                        <div className="truncate">{row.branchName}</div>
                      </td>
                      <td 
                        className="sticky bg-white px-2 py-2 border-b border-r text-[11px] z-10 align-top" 
                        style={{ left: LEFT_WIDTHS.sno + LEFT_WIDTHS.company + LEFT_WIDTHS.branch, width: LEFT_WIDTHS.dept, minWidth: LEFT_WIDTHS.dept }}
                      >
                        <div className="truncate">{row.departmentName || "N/A"}</div>
                      </td>
                      <td 
                        className="sticky bg-white px-2 py-2 border-b border-r text-[11px] z-10 align-top" 
                        style={{ left: LEFT_WIDTHS.sno + LEFT_WIDTHS.company + LEFT_WIDTHS.branch + LEFT_WIDTHS.dept, width: LEFT_WIDTHS.emp, minWidth: LEFT_WIDTHS.emp }}
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