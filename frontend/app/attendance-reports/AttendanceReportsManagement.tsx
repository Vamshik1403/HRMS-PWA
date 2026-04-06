"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Search, Download, FileText } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import * as XLSX from "xlsx";

// Interfaces remain the same as your existing code...
interface AttendanceLog {
  id: number;
  device_sn?: string;
  user_id?: string;
  username: string;
  punch_time: string;
  company_name?: string;
  branch_name?: string;
  department_name?: string;
  device_emp_code?: string;
  manage_employee_id?: number;
  device_id: number;
  raw_body?: string;
  processed_at?: string;
  status?: string;
  device_name?: string;
}

interface Device {
  id: number;
  deviceName: string;
  deviceType: string;
  companyID: number;
  branchesID: number;
  status: string;
  deviceMake?: string;
  deviceModel?: string;
  deviceSN?: string;
}

interface Employee {
  id: number;
  employeeID: string;
  employeeFirstName: string;
  employeeLastName: string;
  companyID: number;
  branchesID: number;
  departmentNameID?: number | null;
  username?: string;
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

interface PublicHoliday {
  companyID: number;
  branchesID: number;
  financialYear: string;
  startDate: string;
  endDate: string;
}

interface WorkShiftDay {
  id: number;
  workShiftID: number;
  weekDay: string;
  weeklyOff: boolean;
  startTime: string;
  endTime: string;
  totalMinutes: number;
}

interface WorkShift {
  id: number;
  serviceProviderID: number;
  companyID: number;
  branchesID: number;
  workShiftDay: WorkShiftDay[];
}

interface AttendanceRegularize {
  companyID: number;
  branchesID: number;
  manageEmployeeID: number;
  attendanceDate: string;
  day: string;
  status: string;
}

interface LeaveDayStatus {
  date: string;
  status: string;
}

interface LeaveApplication {
  companyID: number;
  branchesID: number;
  manageEmployeeID: number;
  status: string;
  dayStatuses: LeaveDayStatus[];
}

interface ReportData {
  employee: Employee;
  punches: { [dateISO: string]: string[] };
  companyName: string;
  branchName: string;
  departmentName: string;
}

interface InOutData {
  inTime: string;
  outTime: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

const getTodayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const LEFT_WIDTHS = {
  sno: 60,
  company: 220,
  branch: 160,
  dept: 130,
  emp: 200
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function AttendanceReportsManagement() {
  const user = useCurrentUser();

  const [searchTerm, setSearchTerm] = useState("");
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const [attendanceRegularizations, setAttendanceRegularizations] = useState<AttendanceRegularize[]>([]);
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  const [managerData, setManagerData] = useState<any>(null);
  const [empCreds, setEmpCreds] = useState<any>(null);

  const [formData, setFormData] = useState({
    companyID: null as number | null,
    branchName: "",
    department: "",
    reportType: "All Punches Logs",
    dateFrom: "",
    dateTo: getTodayStr()
  });

  // ------- HELPERS -------
  // (Keep all your existing helper functions: parseInputDate, parseTimestamp, formatTime, 
  // buildDateRangeColumns, formatHeaderDate, getInOutTimes, getSpecialStatus, getAttendanceStatus,
  // downloadExcel, getFullStatusLabel, getExcelStatusStyle)

  const parseInputDate = (value: string) => {
    if (!value) return new Date(NaN);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value);
    const parts = value.split("/");
    if (parts.length === 3) {
      const [mm, dd, yyyy] = parts;
      return new Date(`${yyyy}-${mm}-${dd}`);
    }
    return new Date(value);
  };

  const parseTimestamp = (ts: string) => {
    return new Date(ts.replace(" ", "T"));
  };

  const formatTime = (ts: string) => {
    const d = parseTimestamp(ts);
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  const buildDateRangeColumns = (): string[] => {
    if (!formData.dateFrom || !formData.dateTo) return [];
    const start = parseInputDate(formData.dateFrom);
    const end = parseInputDate(formData.dateTo);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const dates: string[] = [];
    const cur = new Date(start);

    while (cur <= end) {
      const yyyy = cur.getFullYear();
      const mm = String(cur.getMonth() + 1).padStart(2, "0");
      const dd = String(cur.getDate()).padStart(2, "0");
      dates.push(`${yyyy}-${mm}-${dd}`);
      cur.setDate(cur.getDate() + 1);
    }

    return dates;
  };

  const formatHeaderDate = (iso: string) => {
    const d = new Date(iso);
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    const dateStr = d
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      })
      .toUpperCase();
    return { dayName, dateStr };
  };

  const getInOutTimes = (punches: string[]): InOutData => {
    if (punches.length === 0) return { inTime: "-", outTime: "-" };
    if (punches.length === 1) return { inTime: punches[0], outTime: "-" };
    
    const sortedPunches = [...punches].sort((a, b) => {
      const timeA = new Date(`1970-01-01T${a}`).getTime();
      const timeB = new Date(`1970-01-01T${b}`).getTime();
      return timeA - timeB;
    });
    
    return {
      inTime: sortedPunches[0],
      outTime: sortedPunches[sortedPunches.length - 1]
    };
  };

  const getSpecialStatus = (date: string, selectedCompanyID: number, selectedBranchID: number, employeeID: number): { type: string; label: string } | null => {
    const isPublicHoliday = publicHolidays.some(holiday => {
      if (holiday.companyID !== selectedCompanyID || holiday.branchesID !== selectedBranchID) return false;
      
      const holidayStart = new Date(holiday.startDate);
      const holidayEnd = new Date(holiday.endDate);
      const currentDate = new Date(date);
      
      holidayStart.setHours(0, 0, 0, 0);
      holidayEnd.setHours(23, 59, 59, 999);
      currentDate.setHours(0, 0, 0, 0);
      
      return currentDate >= holidayStart && currentDate <= holidayEnd;
    });

    if (isPublicHoliday) {
      return { type: "PH", label: "PH" };
    }

    const dayOfWeek = WEEKDAYS[new Date(date).getDay()];
    const isWeeklyOff = workShifts.some(shift => {
      if (shift.companyID !== selectedCompanyID || shift.branchesID !== selectedBranchID) return false;
      
      const workShiftDay = shift.workShiftDay.find(day => day.weekDay === dayOfWeek);
      return workShiftDay?.weeklyOff === true;
    });

    if (isWeeklyOff) {
      return { type: "WO", label: "WO" };
    }

    const leaveStatus = leaveApplications.find(leave => {
      if (leave.companyID !== selectedCompanyID || leave.branchesID !== selectedBranchID || leave.manageEmployeeID !== employeeID) 
        return false;
      
      if (leave.status !== "Approved") return false;
      
      const dayStatus = leave.dayStatuses.find(day => day.date === date);
      return dayStatus !== undefined;
    });

    if (leaveStatus) {
      const dayStatus = leaveStatus.dayStatuses.find(day => day.date === date);
      if (dayStatus) {
        return { type: "LEAVE", label: dayStatus.status };
      }
    }

    const regularization = attendanceRegularizations.find(reg => {
      if (reg.companyID !== selectedCompanyID || reg.branchesID !== selectedBranchID || reg.manageEmployeeID !== employeeID) 
        return false;
      
      if (reg.status !== "Approved") return false;
      
      const regDate = new Date(reg.attendanceDate);
      const currentDate = new Date(date);
      
      regDate.setHours(0, 0, 0, 0);
      currentDate.setHours(0, 0, 0, 0);
      
      return regDate.getTime() === currentDate.getTime();
    });

    if (regularization) {
      const dayType = regularization.day;
      const dayLabel = dayType.charAt(0).toUpperCase() + dayType.slice(1);
      return { type: "AR", label: `AR (${dayLabel})` };
    }

    return null;
  };

  const getAttendanceStatus = (punches: string[], date: string, selectedCompanyID: number, selectedBranchID: number, employeeID: number): string => {
    const specialStatus = getSpecialStatus(date, selectedCompanyID, selectedBranchID, employeeID);
    
    if (specialStatus) {
      return specialStatus.label;
    }

    if (punches.length === 0) return "A";
    if (punches.length === 1) return punches[0];
    return "P";
  };

  const downloadExcel = () => {
    if (reportData.length === 0) {
      alert("No data to download");
      return;
    }

    const dateColumns = buildDateRangeColumns();
    const selectedCompanyID = formData.companyID;
    const selectedBranch = branches.find(b => b.branchName === formData.branchName);
    const selectedBranchID = selectedBranch?.id || 0;
    
    const excelData: any[] = [];
    
    const headerRow: any = {
      "S.NO": "S.NO",
      "Employee ID": "Employee ID", 
      "Employee Name": "Employee Name",
      "Company": "Company",
      "Branch": "Branch",
      "Department": "Department"
    };

    dateColumns.forEach(date => {
      const { dayName, dateStr } = formatHeaderDate(date);
      headerRow[dateStr] = `${dateStr}\n${dayName}`;
    });

    excelData.push(headerRow);

    filteredReportData.forEach((row, index) => {
      const dataRow: any = {
        "S.NO": index + 1,
        "Employee ID": row.employee.employeeID,
        "Employee Name": `${row.employee.employeeFirstName} ${row.employee.employeeLastName}`,
        "Company": row.companyName,
        "Branch": row.branchName,
        "Department": row.departmentName || "N/A"
      };

      dateColumns.forEach(date => {
        const { dateStr } = formatHeaderDate(date);
        const punches = row.punches[date] || [];
        const specialStatus = getSpecialStatus(date, selectedCompanyID!, selectedBranchID, row.employee.id);
        
        if (formData.reportType === "In-Out Punches Log") {
          const { inTime, outTime } = getInOutTimes(punches);
          
          if (specialStatus) {
            const fullStatus = getFullStatusLabel(specialStatus.label);
            dataRow[dateStr] = fullStatus;
          } else if (punches.length === 0) {
            dataRow[dateStr] = "Absent";
          } else {
            dataRow[dateStr] = `IN: ${inTime}\nOUT: ${outTime}`;
          }
        } else if (formData.reportType === "Attendance Logs") {
          const status = getAttendanceStatus(punches, date, selectedCompanyID!, selectedBranchID, row.employee.id);
          const fullStatus = getFullStatusLabel(status);
          dataRow[dateStr] = fullStatus;
        } else {
          if (specialStatus) {
            const fullStatus = getFullStatusLabel(specialStatus.label);
            dataRow[dateStr] = fullStatus;
          } else if (punches.length === 0) {
            dataRow[dateStr] = "Absent";
          } else if (punches.length === 1) {
            dataRow[dateStr] = punches[0];
          } else {
            dataRow[dateStr] = "Present";
          }
        }
      });

      excelData.push(dataRow);
    });

    const ws = XLSX.utils.json_to_sheet(excelData, { skipHeader: true });
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cell_address = {c: C, r: R};
        const cell_ref = XLSX.utils.encode_cell(cell_address);
        
        if (!ws[cell_ref]) continue;
        
        ws[cell_ref].s = {
          font: { name: "Arial", sz: 9 },
          alignment: { 
            horizontal: "center", 
            vertical: "center", 
            wrapText: true 
          },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          }
        };
        
        if (R === 0) {
          ws[cell_ref].s.fill = { fgColor: { rgb: "366092" } };
          ws[cell_ref].s.font = { 
            name: "Arial", 
            sz: 10, 
            bold: true, 
            color: { rgb: "FFFFFF" } 
          };
        } else {
          const cellValue = ws[cell_ref].v;
          if (typeof cellValue === 'string' && C >= 6) {
            const statusStyle = getExcelStatusStyle(cellValue);
            if (statusStyle) {
              ws[cell_ref].s.fill = { fgColor: { rgb: statusStyle.bgColor } };
              ws[cell_ref].s.font = { 
                name: "Arial", 
                sz: 9, 
                bold: statusStyle.bold, 
                color: { rgb: statusStyle.textColor } 
              };
            }
          }
          
          if (typeof cellValue === 'string' && cellValue.toLowerCase() === 'absent') {
            ws[cell_ref].s.fill = { fgColor: { rgb: "FF0000" } };
            ws[cell_ref].s.font = { 
              name: "Arial", 
              sz: 9, 
              bold: true, 
              color: { rgb: "FFFFFF" } 
            };
          }
          
          if (typeof cellValue === 'string' && cellValue.toLowerCase() === 'present') {
            ws[cell_ref].s.fill = { fgColor: { rgb: "00B050" } };
            ws[cell_ref].s.font = { 
              name: "Arial", 
              sz: 9, 
              bold: true, 
              color: { rgb: "FFFFFF" } 
            };
          }
          
          if (typeof cellValue === 'string' && /^\d{1,2}:\d{2}:\d{2}$/.test(cellValue)) {
            ws[cell_ref].s.fill = { fgColor: { rgb: "FFFF00" } };
            ws[cell_ref].s.font = { 
              name: "Arial", 
              sz: 9, 
              bold: true, 
              color: { rgb: "000000" } 
            };
          }
        }
      }
    }
    
    const colWidths = [
      { wch: 6 }, { wch: 12 }, { wch: 18 }, { wch: 30 }, { wch: 12 }, { wch: 12 },
    ];
    
    dateColumns.forEach(() => {
      colWidths.push({ wch: 15 });
    });
    
    ws['!cols'] = colWidths;
    ws['!freeze'] = { x: 6, y: 1 };
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
    const filename = `${formData.reportType.replace(/\s+/g, '_')}_${formData.dateFrom}_to_${formData.dateTo}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const getFullStatusLabel = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      'P': 'Present',
      'A': 'Absent',
      'PH': 'Public Holiday',
      'WO': 'Weekly Off',
      'AR': 'Attendance Regularized',
      'Casual': 'Casual Leave',
      'Sick': 'Sick Leave',
      'Earned': 'Earned Leave',
      'Maternity': 'Maternity Leave',
      'Paternity': 'Paternity Leave',
      'Halfday': 'Half Day',
      'Fullday': 'Full Day',
      'Single Punch': 'Single Punch'
    };

    if (status.startsWith('AR (')) {
      const arType = status.replace('AR (', '').replace(')', '');
      const fullArType = getFullStatusLabel(arType);
      return `Attendance Regularized (${fullArType})`;
    }

    return statusMap[status] || status;
  };

  const getExcelStatusStyle = (status: string): { bgColor: string; textColor: string; bold: boolean } | null => {
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('public holiday') || statusLower.includes('ph')) {
      return { bgColor: "FF99FF", textColor: "000000", bold: true };
    }
    else if (statusLower.includes('weekly off') || statusLower.includes('wo')) {
      return { bgColor: "FF9900", textColor: "000000", bold: true };
    }
    else if (statusLower.includes('attendance regularized') || statusLower.includes('ar')) {
      return { bgColor: "00FFFF", textColor: "000000", bold: true };
    }
    else if (statusLower.includes('leave') || 
             statusLower.includes('casual') || 
             statusLower.includes('sick') || 
             statusLower.includes('earned') ||
             statusLower.includes('maternity') ||
             statusLower.includes('paternity')) {
      return { bgColor: "FF66CC", textColor: "000000", bold: true };
    }
    else if (statusLower.includes('half day') || statusLower.includes('halfday')) {
      return { bgColor: "FFFFCC", textColor: "000000", bold: true };
    }
    else if (statusLower.includes('full day') || statusLower.includes('fullday')) {
      return { bgColor: "CCFFCC", textColor: "000000", bold: true };
    }

    return null;
  };

  // ------- LOAD MASTER DATA -------

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
      const res = await fetch(`${BACKEND_URL}/branches`, { cache: "no-store" });
      const data = await res.json();
      setAllBranches(data);
    };
    loadAllBranches();
  }, []);

  useEffect(() => {
    const loadAllDepartments = async () => {
      const res = await fetch(`${BACKEND_URL}/departments`, { cache: "no-store" });
      const data = await res.json();
      setAllDepartments(data);
    };
    loadAllDepartments();
  }, []);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/devices`, { cache: "no-store" });
        const data = await res.json();
        setDevices(data);
      } catch (error) {
        console.error("Error loading devices:", error);
      }
    };
    loadDevices();
  }, []);

  // ------- LOAD HOLIDAYS, WORK SHIFTS, REGULARIZATIONS AND LEAVES -------

  const loadHolidaysShiftsRegularizationsAndLeaves = async (selectedCompanyID: number, selectedBranchID: number) => {
    try {
      const holidaysRes = await fetch(`${BACKEND_URL}/public-holiday`);
      const holidaysData = await holidaysRes.json();
      const filteredHolidays = holidaysData.filter((holiday: PublicHoliday) => 
        holiday.companyID === selectedCompanyID && holiday.branchesID === selectedBranchID
      );
      setPublicHolidays(filteredHolidays);

      const shiftsRes = await fetch(`${BACKEND_URL}/work-shift`);
      const shiftsData = await shiftsRes.json();
      const filteredShifts = shiftsData.filter((shift: WorkShift) => 
        shift.companyID === selectedCompanyID && shift.branchesID === selectedBranchID
      );
      setWorkShifts(filteredShifts);

      const regularizationsRes = await fetch(`${BACKEND_URL}/emp-attendance-regularise`);
      const regularizationsData = await regularizationsRes.json();
      const filteredRegularizations = regularizationsData.filter((reg: AttendanceRegularize) => 
        reg.companyID === selectedCompanyID && reg.branchesID === selectedBranchID && reg.status === "Approved"
      );
      setAttendanceRegularizations(filteredRegularizations);

      const leavesRes = await fetch(`${BACKEND_URL}/leave-application`);
      const leavesData = await leavesRes.json();
      const filteredLeaves = leavesData.filter((leave: LeaveApplication) => 
        leave.companyID === selectedCompanyID && leave.branchesID === selectedBranchID && leave.status === "Approved"
      );
      setLeaveApplications(filteredLeaves);
    } catch (error) {
      console.error("Error loading holidays, shifts, regularizations and leaves:", error);
    }
  };

  // ------- LOAD ROLE DATA -------

  useEffect(() => {
    if (!user) return;

    const loadUserData = async () => {
      try {
        if (user.role === "MANAGER") {
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
      } catch (err) {
        console.error("Error loading user role data:", err);
      }
    };

    loadUserData();
  }, [user]);

  // ------- BRANCH & DEPARTMENT LISTS -------

  useEffect(() => {
    if (!user) return;

    let data = [...allBranches];

    if (user.role === "MANAGER" && managerData) {
      data = data.filter(b => b.companyID === managerData.companyID);
    } else if (user.role === "EMPLOYEE" && empCreds) {
      data = data.filter(b => b.companyID === empCreds.companyID);
    } else if (user.role === "SUPERADMIN" && formData.companyID) {
      data = data.filter(b => b.companyID === formData.companyID);
    }

    setBranches(data);

    if (user.role !== "SUPERADMIN" && data.length > 0) {
      const b = data[0];
      setFormData(prev => ({
        ...prev,
        companyID: b.companyID,
        branchName: b.branchName
      }));
      loadDepartmentsForBranch(b.id, b.companyID);
    }
  }, [user, managerData, empCreds, formData.companyID, allBranches]);

  const loadDepartmentsForBranch = (branchId: number, companyID?: number) => {
    let data = allDepartments.filter(d => d.branchesID === branchId);

    if (user?.role === "SUPERADMIN" && (companyID || formData.companyID)) {
      const cid = companyID ?? formData.companyID!;
      data = data.filter(d => d.companyID === cid);
    }

    setDepartments(data);

    setFormData(prev => ({
      ...prev,
      department: data.length ? data[0].departmentName : ""
    }));
  };

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const branchName = e.target.value;
    const branch = branches.find(b => b.branchName === branchName);
    setFormData(prev => ({ ...prev, branchName, department: "" }));
    if (branch) {
      loadDepartmentsForBranch(branch.id, branch.companyID);
    } else {
      setDepartments([]);
    }
  };

  // ------- GENERATE REPORT -------

  const generateReport = async () => {
    if (!formData.dateFrom || !formData.dateTo) {
      alert("Please select both Date From and Date To");
      return;
    }

    setLoading(true);

    try {
      // Resolve selected company + branch
      let selectedCompanyID: number | null = null;
      let selectedBranchID: number | null = null;

      if (user?.role === "SUPERADMIN") {
        selectedCompanyID = formData.companyID;
        const branch = allBranches.find(b => b.branchName === formData.branchName);
        selectedBranchID = branch?.id ?? null;
      } else if (user?.role === "MANAGER" && managerData) {
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

      // Load holidays, shifts, etc.
      await loadHolidaysShiftsRegularizationsAndLeaves(selectedCompanyID, selectedBranchID);

      // Get AT device IDs from devices API
      const devicesResponse = await fetch(`${BACKEND_URL}/devices`, { cache: "no-store" });
      const devicesData = await devicesResponse.json();
      
      const atDeviceIds = devicesData
        .filter((device: any) => device.deviceType === 'AT')
        .map((device: any) => device.id);
      
      console.log("AT Device IDs:", atDeviceIds);

      if (atDeviceIds.length === 0) {
        console.log("No AT devices found");
        setReportData([]);
        setLoading(false);
        return;
      }

      // Fetch logs from NestJS backend API - using the by-devices endpoint
      const params = new URLSearchParams();
      params.append('dateFrom', formData.dateFrom);
      params.append('dateTo', formData.dateTo);
      params.append('deviceIds', atDeviceIds.join(','));
      
      const logsResponse = await fetch(`${BACKEND_URL}/process-att-logs/by-devices?${params.toString()}`);
      
      if (!logsResponse.ok) {
        throw new Error(`Failed to fetch logs: ${logsResponse.status}`);
      }
      
      const result = await logsResponse.json();
      // Handle the response format from your NestJS API
      const logsData = result.data || result;
      
      console.log("Total logs fetched:", logsData.length);
      console.log("Sample log:", logsData[0]);

      // Fetch employees
      const employeesResponse = await fetch(`${BACKEND_URL}/manage-emp`, { cache: "no-store" });
      const employees = await employeesResponse.json();

      // Fetch companies, branches, departments
      const companiesData = await fetch(`${BACKEND_URL}/company`, { cache: "no-store" }).then(r => r.json());
      const branchesData = await fetch(`${BACKEND_URL}/branches`, { cache: "no-store" }).then(r => r.json());
      const departmentsData = await fetch(`${BACKEND_URL}/departments`, { cache: "no-store" }).then(r => r.json());

      // Filter employees by company and branch
      let filteredEmployees = employees.filter(
        (e: any) => e.companyID === selectedCompanyID && e.branchesID === selectedBranchID
      );

      // Filter by department if selected
      if (formData.department) {
        const dept = departmentsData.find(
          (d: any) => d.departmentName === formData.department &&
               d.companyID === selectedCompanyID &&
               d.branchesID === selectedBranchID
        );
        if (dept) {
          filteredEmployees = filteredEmployees.filter(
            (e: any) => e.departmentNameID === dept.id
          );
        }
      }

      // Group logs by employee (match by username)
      const logsByEmployee = new Map<number, any[]>();
      
      logsData.forEach((log: any) => {
        // Try to find employee by username
        const employee = filteredEmployees.find((e: any) => {
          const empFullName = `${e.employeeFirstName} ${e.employeeLastName}`.toLowerCase();
          const logUsername = log.username?.toLowerCase() || '';
          return e.username?.toLowerCase() === logUsername || 
                 empFullName === logUsername;
        });
        
        if (employee && log.punch_time) {
          if (!logsByEmployee.has(employee.id)) {
            logsByEmployee.set(employee.id, []);
          }
          logsByEmployee.get(employee.id)!.push(log);
        } else if (!employee) {
          console.log("No employee match for username:", log.username);
        }
      });

      // Build report data for all employees
      const rows = filteredEmployees.map((emp: any) => {
        const empLogs = logsByEmployee.get(emp.id) || [];
        const punchesByDate: { [date: string]: string[] } = {};

        empLogs.forEach((log: any) => {
          if (log.punch_time) {
            // Handle different date formats
            let dateKey;
            if (typeof log.punch_time === 'string') {
              if (log.punch_time.includes('T')) {
                dateKey = log.punch_time.split('T')[0];
              } else {
                dateKey = log.punch_time.split(' ')[0];
              }
            } else if (log.punch_time instanceof Date) {
              dateKey = log.punch_time.toISOString().split('T')[0];
            } else {
              dateKey = new Date(log.punch_time).toISOString().split('T')[0];
            }
            
            if (!punchesByDate[dateKey]) punchesByDate[dateKey] = [];
            punchesByDate[dateKey].push(formatTime(log.punch_time));
          }
        });

        const company = companiesData.find((c: any) => c.id === emp.companyID);
        const branch = branchesData.find((b: any) => b.id === emp.branchesID);
        const dept = departmentsData.find((d: any) => d.id === emp.departmentNameID);

        return {
          employee: emp,
          punches: punchesByDate,
          companyName: company?.companyName || "N/A",
          branchName: branch?.branchName || "N/A",
          departmentName: dept?.departmentName || "N/A"
        };
      });

      console.log("Final report data rows:", rows.length);
      setReportData(rows);
    } catch (err) {
      console.error("Error generating report:", err);
      alert("Error generating report. Check console for details.");
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(prev => ({
      ...prev,
      dateFrom: "",
      dateTo: getTodayStr(),
      department: "",
      branchName: "",
      companyID: user?.role === "SUPERADMIN" ? null : prev.companyID
    }));
    setReportData([]);
    setSearchTerm("");
  };

  // ------- UI HELPERS -------

  const dateColumns = buildDateRangeColumns();

  const filteredReportData = reportData.filter(row => {
    const fullName = `${row.employee.employeeFirstName} ${row.employee.employeeLastName}`.toLowerCase();
    return (
      fullName.includes(searchTerm.toLowerCase()) ||
      row.employee.employeeID.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.departmentName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // ------- RENDER DATE CELLS -------
  // (Keep all your existing renderDateCell and renderDateHeaders functions)

  const renderDateCell = (punches: string[], date: string, employeeID: number) => {
    const selectedCompanyID = formData.companyID;
    const selectedBranch = branches.find(b => b.branchName === formData.branchName);
    const selectedBranchID = selectedBranch?.id || 0;

    const specialStatus = getSpecialStatus(date, selectedCompanyID!, selectedBranchID, employeeID);

    const renderSpecialStatusBadge = () => {
      if (!specialStatus) return null;

      let statusClass = "";
      
      if (specialStatus.type === "PH") {
        statusClass = "bg-purple-100 text-purple-800 border border-purple-300";
      } else if (specialStatus.type === "WO") {
        statusClass = "bg-orange-100 text-orange-800 border border-orange-300";
      } else if (specialStatus.type === "AR") {
        statusClass = "bg-teal-100 text-teal-800 border border-teal-300";
      } else if (specialStatus.type === "LEAVE") {
        statusClass = "bg-pink-100 text-pink-800 border border-pink-300";
      }
  
      return (
        <div className={`text-[9px] font-bold py-1 px-2 rounded mb-1 ${statusClass}`}>
          {specialStatus.label}
        </div>
      );
    };
  
    if (formData.reportType === "In-Out Punches Log") {
      const { inTime, outTime } = getInOutTimes(punches);
      return (
        <td className="px-2 py-1 border-b min-w-[140px] text-center align-top">
          {renderSpecialStatusBadge()}
          {punches.length > 0 ? (
            <div className="flex flex-col gap-1 text-[10px]">
              <div className="flex justify-between items-center">
                <span className="font-semibold">IN:</span>
                <span className={`px-2 py-1 rounded ${inTime === "-" ? "bg-gray-200 text-gray-500" : "bg-green-100 text-green-800"}`}>
                  {inTime}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold">OUT:</span>
                <span className={`px-2 py-1 rounded ${outTime === "-" ? "bg-gray-200 text-gray-500" : "bg-red-100 text-red-800"}`}>
                  {outTime}
                </span>
              </div>
            </div>
          ) : specialStatus ? (
            <div className="text-[10px] text-gray-500 italic">No punches</div>
          ) : (
            <div className="text-[10px] text-gray-400 italic">No logs</div>
          )}
        </td>
      );
    } else if (formData.reportType === "Attendance Logs") {
      const status = getAttendanceStatus(punches, date, selectedCompanyID!, selectedBranchID, employeeID);
      
      let statusClass = "";
      let statusText = status;
      
      if (status === "PH") {
        statusClass = "bg-purple-100 text-purple-800";
      } else if (status === "WO") {
        statusClass = "bg-orange-100 text-orange-800";
      } else if (status.startsWith("AR")) {
        statusClass = "bg-teal-100 text-teal-800";
      } else if (status === "A") {
        statusClass = "bg-red-100 text-red-800";
      } else if (status === "P") {
        statusClass = "bg-green-100 text-green-800";
      } else if (status === "Casual" || status === "Sick" || status === "Earned" || status === "Maternity" || status === "Paternity") {
        statusClass = "bg-pink-100 text-pink-800";
      } else {
        statusClass = "bg-blue-100 text-blue-800";
      }

      return (
        <td className="px-2 py-1 border-b min-w-[80px] text-center align-top">
          <div className={`text-[10px] font-bold py-1 px-2 rounded ${statusClass}`}>
            {status}
          </div>
        </td>
      );
    } else {
      return (
        <td className="px-2 py-1 border-b min-w-[120px] text-center align-top">
          {renderSpecialStatusBadge()}
          {punches.length > 0 ? (
            <div className="flex flex-col items-center gap-1">
              {punches.map((time, idx) => (
                <span
                  key={idx}
                  className="inline-block px-2 py-1 bg-gray-900 text-white text-[10px] font-semibold rounded-full"
                >
                  {time}
                </span>
              ))}
            </div>
          ) : specialStatus ? (
            <div className="text-[10px] text-gray-500 italic">No punches</div>
          ) : (
            <div className="text-[10px] text-gray-400 italic">No logs</div>
          )}
        </td>
      );
    }
  };

  const renderDateHeaders = () => {
    if (formData.reportType === "In-Out Punches Log") {
      return dateColumns.map(date => {
        const { dayName, dateStr } = formatHeaderDate(date);
        return (
          <th
            key={date}
            className="px-2 py-1 text-center min-w-[140px] border-l border-blue-500 text-[11px]"
            colSpan={1}
          >
            <div className="font-semibold">{dateStr}</div>
            <div className="text-[10px] opacity-80 mt-1">{dayName}</div>
          </th>
        );
      });
    } else {
      return dateColumns.map(date => {
        const { dayName, dateStr } = formatHeaderDate(date);
        return (
          <th
            key={date}
            className="px-2 py-1 text-center min-w-[120px] border-l border-blue-500 text-[11px]"
          >
            <div className="font-semibold">{dateStr}</div>
            <div className="text-[10px] opacity-80 mt-1">{dayName}</div>
          </th>
        );
      });
    }
  };

  // ------- RENDER -------
  // Keep your existing return statement with all the JSX

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4">
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">
            Generate and view attendance logs by company, branch, department and date range.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Attendance Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {user?.role === "SUPERADMIN" && (
              <div className="space-y-2">
                <Label>Company</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md bg-white"
                  value={formData.companyID ?? ""}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      companyID: e.target.value ? Number(e.target.value) : null,
                      branchName: "",
                      department: ""
                    }))
                  }
                >
                  <option value="">Select company</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Branch</Label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-white"
                value={formData.branchName}
                onChange={handleBranchChange}
              >
                <option value="">Select branch</option>
                {branches.map(b => (
                  <option key={b.id} value={b.branchName}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-white"
                value={formData.department}
                onChange={e =>
                  setFormData(prev => ({ ...prev, department: e.target.value }))
                }
              >
                <option value="">All departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.departmentName}>
                    {d.departmentName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Report Type</Label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-white"
                value={formData.reportType}
                onChange={e =>
                  setFormData(prev => ({ ...prev, reportType: e.target.value }))
                }
              >
                <option value="All Punches Logs">All Punches Logs</option>
                <option value="In-Out Punches Log">In-Out Punches Log</option>
                <option value="Attendance Logs">Attendance Logs</option>
                <option value="Summary Logs">Summary Logs</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={formData.dateFrom}
                onChange={e =>
                  setFormData(prev => ({ ...prev, dateFrom: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={formData.dateTo}
                onChange={e =>
                  setFormData(prev => ({ ...prev, dateTo: e.target.value }))
                }
              />
            </div>

            <div className="col-span-2 flex items-end gap-3">
              <Button
                className="bg-gray-900 hover:bg-gray-800"
                onClick={generateReport}
                disabled={loading}
              >
                {loading ? "Generating..." : "Generate Report"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Reset
              </Button>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-md">
            <p className="text-xs font-semibold mb-2">Legend:</p>
            <div className="flex flex-wrap gap-3 text-[10px]">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                <span>P = Present (2+ punches)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
                <span>Time = Single punch</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
                <span>A = Absent</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-purple-100 border border-purple-300 rounded"></div>
                <span>PH = Public Holiday</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-100 border border-orange-300 rounded"></div>
                <span>WO = Weekly Off</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-teal-100 border border-teal-300 rounded"></div>
                <span>AR = Attendance Regularized</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-pink-100 border border-pink-300 rounded"></div>
                <span>Leave Types (Casual, Sick, etc.)</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Logs are filtered by company, branch, department (if selected) and date
            range. Only logs from AT devices are included.
          </p>
        </CardContent>
      </Card>

      {reportData.length === 0 && !loading && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-gray-500">
            No logs found for selected filters and date range.
          </CardContent>
        </Card>
      )}

      {reportData.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <FileText className="w-5 h-5" />
                {formData.reportType} – {filteredReportData.length} users
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search employee, company, branch..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={downloadExcel}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Excel
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto w-full border-t border-gray-200">
              <table className="min-w-full border-collapse text-xs">
                <thead className="bg-gray-900 text-white">
                  <tr>
                    <th
                      className="sticky z-30 bg-gray-900 px-3 py-2 text-center"
                      style={{ left: 0, width: LEFT_WIDTHS.sno, minWidth: LEFT_WIDTHS.sno }}
                    >
                      S.NO
                    </th>
                    <th
                      className="sticky z-30 bg-gray-900 px-3 py-2 text-left"
                      style={{
                        left: LEFT_WIDTHS.sno,
                        width: LEFT_WIDTHS.company,
                        minWidth: LEFT_WIDTHS.company
                      }}
                    >
                      COMPANY
                    </th>
                    <th
                      className="sticky z-30 bg-gray-900 px-3 py-2 text-left"
                      style={{
                        left: LEFT_WIDTHS.sno + LEFT_WIDTHS.company,
                        width: LEFT_WIDTHS.branch,
                        minWidth: LEFT_WIDTHS.branch
                      }}
                    >
                      BRANCH
                    </th>
                    <th
                      className="sticky z-30 bg-gray-900 px-3 py-2 text-left"
                      style={{
                        left: LEFT_WIDTHS.sno + LEFT_WIDTHS.company + LEFT_WIDTHS.branch,
                        width: LEFT_WIDTHS.dept,
                        minWidth: LEFT_WIDTHS.dept
                      }}
                    >
                      DEPT
                    </th>
                    <th
                      className="sticky z-30 bg-gray-900 px-3 py-2 text-left"
                      style={{
                        left:
                          LEFT_WIDTHS.sno +
                          LEFT_WIDTHS.company +
                          LEFT_WIDTHS.branch +
                          LEFT_WIDTHS.dept,
                        width: LEFT_WIDTHS.emp,
                        minWidth: LEFT_WIDTHS.emp
                      }}
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
                        className="sticky bg-white px-3 py-2 border-b border-r text-center text-[11px] z-20"
                        style={{ left: 0, width: LEFT_WIDTHS.sno, minWidth: LEFT_WIDTHS.sno }}
                      >
                        {index + 1}
                      </td>
                      <td
                        className="sticky bg-white px-3 py-2 border-b border-r text-[11px] z-20 align-top"
                        style={{
                          left: LEFT_WIDTHS.sno,
                          width: LEFT_WIDTHS.company,
                          minWidth: LEFT_WIDTHS.company
                        }}
                      >
                        {row.companyName}
                      </td>
                      <td
                        className="sticky bg-white px-3 py-2 border-b border-r text-[11px] z-20 align-top"
                        style={{
                          left: LEFT_WIDTHS.sno + LEFT_WIDTHS.company,
                          width: LEFT_WIDTHS.branch,
                          minWidth: LEFT_WIDTHS.branch
                        }}
                      >
                        {row.branchName}
                      </td>
                      <td
                        className="sticky bg-white px-3 py-2 border-b border-r text-[11px] z-20 align-top"
                        style={{
                          left: LEFT_WIDTHS.sno + LEFT_WIDTHS.company + LEFT_WIDTHS.branch,
                          width: LEFT_WIDTHS.dept,
                          minWidth: LEFT_WIDTHS.dept
                        }}
                      >
                        {row.departmentName || "N/A"}
                      </td>
                      <td
                        className="sticky bg-white px-3 py-2 border-b border-r text-[11px] z-20 align-top"
                        style={{
                          left:
                            LEFT_WIDTHS.sno +
                            LEFT_WIDTHS.company +
                            LEFT_WIDTHS.branch +
                            LEFT_WIDTHS.dept,
                          width: LEFT_WIDTHS.emp,
                          minWidth: LEFT_WIDTHS.emp
                        }}
                      >
                        <div>
                          {row.employee.employeeFirstName} {row.employee.employeeLastName}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          ({row.employee.employeeID})
                        </div>
                      </td>

                      {dateColumns.map(date => {
                        const punches = row.punches[date] || [];
                        return renderDateCell(punches, date, row.employee.id);
                      })}
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