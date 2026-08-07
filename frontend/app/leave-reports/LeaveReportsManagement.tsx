"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Search, Download, FileText } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { getSidebarContext } from "../utils/sidebarContext";
import * as XLSX from "xlsx";
import { PageHeader } from "../components/app/page-header";

// ─── Interfaces ─────────────────────────────────────────────

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
  departmentID?: number;
  designation: string;
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

interface LeaveApplication {
  id: number;
  companyID: number;
  branchesID: number;
  manageEmployeeID: number;
  appliedLeaveType?: string;
  fromDate?: string;
  toDate?: string;
  purpose?: string;
  status?: string;
  dayStatuses?: { date: string; status: string }[];
  manageEmployee?: Employee;
}

interface LeaveReportRow {
  employee: Employee;
  companyName: string;
  branchName: string;
  departmentName: string;
  leaveDays: { [dateISO: string]: string }; // date -> leave type/status
}

// ─── Constants ──────────────────────────────────────────────

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

const REPORT_TYPES = [
  { value: "All Leave Reports", label: "All Leave Reports" },
  { value: "SL Report", label: "SL Report (Sick Leave)" },
  { value: "CL Report", label: "CL Report (Casual Leave)" },
  { value: "PL Report", label: "PL Report (Privilege Leave)" },
  { value: "LoP Report", label: "LoP Report (Loss of Pay)" },
  { value: "Week Off Report", label: "Week Off Report" },
  { value: "Comp Off Report", label: "Comp Off Report" },
];

const LEAVE_TYPE_MAP: Record<string, string> = {
  Sick: "SL",
  Casual: "CL",
  Earned: "PL",
  Privilege: "PL",
  PL: "PL",
  LoP: "LoP",
  LOP: "LoP",
  "Loss of Pay": "LoP",
  "Week Off": "WO",
  WeekOff: "WO",
  "Comp Off": "CO",
  CompOff: "CO",
};

const REPORT_TYPE_FILTER: Record<string, string[]> = {
  "All Leave Reports": [],
  "SL Report": ["Sick", "SL"],
  "CL Report": ["Casual", "CL"],
  "PL Report": ["Earned", "Privilege", "PL"],
  "LoP Report": ["LoP", "LOP", "Loss of Pay"],
  "Week Off Report": ["Week Off", "WeekOff", "WO"],
  "Comp Off Report": ["Comp Off", "CompOff", "CO"],
};

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const LEFT_WIDTHS = {
  sno: 60,
  company: 180,
  branch: 140,
  dept: 120,
  emp: 180,
};

// ─── Component ──────────────────────────────────────────────

export function LeaveReportsManagement() {
  const user = useCurrentUser();

  const [searchTerm, setSearchTerm] = useState("");
  const [reportData, setReportData] = useState<LeaveReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [allDesignations, setAllDesignations] = useState<Designation[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);

  const [managerData, setManagerData] = useState<any>(null);
  const [empCreds, setEmpCreds] = useState<any>(null);

  const [formData, setFormData] = useState({
    companyID: null as number | null,
    branchName: "",
    department: "",
    designation: "",
    reportType: "All Leave Reports",
    dateFrom: "",
    dateTo: getTodayStr(),
  });

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({ sno: true, company: true, branch: true, dept: true, emp: true });
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const toggleColumn = (key: string) => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));

  const getStickyLeft = (key: string) => {
    const order = ["sno", "company", "branch", "dept", "emp"];
    let left = 0;
    for (const k of order) {
      if (k === key) return left;
      if (visibleColumns[k]) left += LEFT_WIDTHS[k as keyof typeof LEFT_WIDTHS];
    }
    return left;
  };

  // ─── Helpers ────────────────────────────────────────────────

  const buildDateRangeColumns = (): string[] => {
    if (!formData.dateFrom || !formData.dateTo) return [];
    const start = new Date(formData.dateFrom);
    const end = new Date(formData.dateTo);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const dates: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      dates.push(
        `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`
      );
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  };

  const formatHeaderDate = (iso: string) => {
    const d = new Date(iso);
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    const dateStr = d
      .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      .toUpperCase();
    return { dayName, dateStr };
  };

  const getLeaveStatusClass = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s.includes("sick") || s === "sl") return "bg-red-100 text-red-800";
    if (s.includes("casual") || s === "cl") return "bg-blue-100 text-blue-800";
    if (s.includes("earn") || s.includes("privilege") || s === "pl") return "bg-green-100 text-green-800";
    if (s.includes("lop") || s.includes("loss")) return "bg-yellow-100 text-yellow-800";
    if (s.includes("week") || s === "wo") return "bg-orange-100 text-orange-800";
    if (s.includes("comp") || s === "co") return "bg-purple-100 text-purple-800";
    if (s.includes("half")) return "bg-amber-100 text-amber-800";
    return "bg-gray-100 text-gray-800";
  };

  const normalizeLeaveType = (type: string): string => {
    return LEAVE_TYPE_MAP[type] || type;
  };

  // ─── Load Master Data ──────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const [cRes, bRes, dRes, dgRes] = await Promise.all([
          fetch(`${BACKEND_URL}/company`).then((r) => r.json()),
          fetch(`${BACKEND_URL}/branches`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${BACKEND_URL}/departments`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${BACKEND_URL}/designations`, { cache: "no-store" }).then((r) => r.json()),
        ]);
        setCompanies(cRes);
        setAllBranches(bRes);
        setAllDepartments(dRes);
        setAllDesignations(Array.isArray(dgRes) ? dgRes : []);
      } catch (err) {
        console.error("Error loading master data:", err);
      }
    };
    load();
  }, []);

  // ─── Load User Role Data ───────────────────────────────────

  useEffect(() => {
    if (!user) return;
    const loadUserData = async () => {
      try {
        if (user.role === "SERVICE_PROVIDER") {
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

  // ─── Branch & Department cascading ────────────────────────

  useEffect(() => {
    if (!user) return;
    let data = [...allBranches];
    if (user.role === "SERVICE_PROVIDER") {
      const ctx = getSidebarContext();
      if (ctx?.companyID) {
        data = data.filter((b) => b.companyID === ctx.companyID);
      } else if (managerData?.serviceProviderID) {
        data = data.filter((b: any) => b.serviceProviderID === managerData.serviceProviderID);
      }
    } else if (user.role === "EMPLOYEE" && empCreds) {
      data = data.filter((b) => b.companyID === empCreds.companyID);
    } else if (user.role === "SUPERADMIN" && formData.companyID) {
      data = data.filter((b) => b.companyID === formData.companyID);
    }
    setBranches(data);
    if (user.role !== "SUPERADMIN" && data.length > 0) {
      const b = data[0];
      setFormData((prev) => ({ ...prev, companyID: b.companyID, branchName: b.branchName }));
      loadDepartmentsForBranch(b.id, b.companyID);
    }
  }, [user, managerData, empCreds, formData.companyID, allBranches]);

  const loadDepartmentsForBranch = (branchId: number, companyID?: number) => {
    let data = allDepartments.filter((d) => d.branchesID === branchId);
    const cid = companyID ?? formData.companyID;
    if (cid) data = data.filter((d) => d.companyID === cid);
    setDepartments(data);

    let desigData = allDesignations.filter((d) => d.branchesID === branchId);
    if (cid) desigData = desigData.filter((d) => d.companyID === cid);
    setDesignations(desigData);

    setFormData((prev) => ({
      ...prev,
      department: data.length ? data[0].departmentName : "",
      designation: "",
    }));
  };

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const branchName = e.target.value;
    const branch = branches.find((b) => b.branchName === branchName);
    setFormData((prev) => ({ ...prev, branchName, department: "" }));
    if (branch) {
      loadDepartmentsForBranch(branch.id, branch.companyID);
    } else {
      setDepartments([]);
    }
  };

  // ─── Generate Report ──────────────────────────────────────

  const generateReport = async () => {
    if (!formData.dateFrom || !formData.dateTo) {
      alert("Please select both Date From and Date To");
      return;
    }
    setLoading(true);
    try {
      let selectedCompanyID: number | null = null;
      let selectedBranchID: number | null = null;

      if (user?.role === "SUPERADMIN") {
        selectedCompanyID = formData.companyID;
        const branch = allBranches.find((b) => b.branchName === formData.branchName);
        selectedBranchID = branch?.id ?? null;
      } else if (user?.role === "SERVICE_PROVIDER") {
        const ctx = getSidebarContext();
        selectedCompanyID = ctx?.companyID || managerData?.companyID;
        selectedBranchID = managerData?.branchesID;
        if (!selectedCompanyID && managerData?.serviceProviderID) {
          const branch = allBranches.find((b) => b.branchName === formData.branchName);
          selectedCompanyID = branch?.companyID ?? null;
          selectedBranchID = branch?.id ?? null;
        }
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

      // Fetch data in parallel
      const [employees, leaveApps, companiesData, branchesData, departmentsData] =
        await Promise.all([
          fetch(`${BACKEND_URL}/manage-emp`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${BACKEND_URL}/leave-application`).then((r) => r.json()),
          fetch(`${BACKEND_URL}/company`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${BACKEND_URL}/branches`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${BACKEND_URL}/departments`, { cache: "no-store" }).then((r) => r.json()),
        ]);

      // Filter employees
      let filteredEmployees = employees.filter(
        (e: any) => e.companyID === selectedCompanyID && e.branchesID === selectedBranchID
      );

      if (formData.department) {
        const dept = departmentsData.find(
          (d: any) =>
            d.departmentName === formData.department &&
            d.companyID === selectedCompanyID &&
            d.branchesID === selectedBranchID
        );
        if (dept) {
          filteredEmployees = filteredEmployees.filter((e: any) => e.departmentNameID === dept.id);
        }
      }

      if (formData.designation) {
        filteredEmployees = filteredEmployees.filter(
          (e: any) => e.designationID === Number(formData.designation)
        );
      }

      // Filter leave applications
      const dateFrom = new Date(formData.dateFrom);
      const dateTo = new Date(formData.dateTo);
      dateFrom.setHours(0, 0, 0, 0);
      dateTo.setHours(23, 59, 59, 999);

      // Report type filter
      const typeFilter = REPORT_TYPE_FILTER[formData.reportType] || [];

      const filteredLeaves: LeaveApplication[] = (leaveApps || []).filter((la: any) => {
        if (la.companyID !== selectedCompanyID || la.branchesID !== selectedBranchID)
          return false;
        if (la.status !== "Approved") return false;

        // Check date overlap
        const laFrom = la.fromDate ? new Date(la.fromDate) : null;
        const laTo = la.toDate ? new Date(la.toDate) : null;
        if (!laFrom || !laTo) return false;
        laFrom.setHours(0, 0, 0, 0);
        laTo.setHours(23, 59, 59, 999);
        if (laTo < dateFrom || laFrom > dateTo) return false;

        // Filter by leave type if needed
        if (typeFilter.length > 0) {
          const leaveType = la.appliedLeaveType || "";
          const normalized = normalizeLeaveType(leaveType);
          const matchesFilter = typeFilter.some(
            (f) =>
              f.toLowerCase() === leaveType.toLowerCase() ||
              f.toLowerCase() === normalized.toLowerCase()
          );
          if (!matchesFilter) return false;
        }

        return true;
      });

      // Group leaves by employee
      const leavesByEmployee = new Map<number, LeaveApplication[]>();
      filteredLeaves.forEach((la) => {
        const empId = la.manageEmployeeID;
        if (!leavesByEmployee.has(empId)) leavesByEmployee.set(empId, []);
        leavesByEmployee.get(empId)!.push(la);
      });

      // Build date range
      const dateColumns = buildDateRangeColumns();

      // Build report data
      const rows: LeaveReportRow[] = filteredEmployees.map((emp: any) => {
        const empLeaves = leavesByEmployee.get(emp.id) || [];
        const leaveDays: { [dateISO: string]: string } = {};

        empLeaves.forEach((la) => {
          // Use dayStatuses if available, otherwise use date range
          if (la.dayStatuses && Array.isArray(la.dayStatuses)) {
            la.dayStatuses.forEach((ds: any) => {
              const dateKey = ds.date?.split("T")[0] || ds.date;
              if (dateColumns.includes(dateKey)) {
                leaveDays[dateKey] = ds.status || la.appliedLeaveType || "Leave";
              }
            });
          } else {
            // Use fromDate to toDate
            const laFrom = new Date(la.fromDate!);
            const laTo = new Date(la.toDate!);
            laFrom.setHours(0, 0, 0, 0);
            laTo.setHours(0, 0, 0, 0);
            const cur = new Date(laFrom);
            while (cur <= laTo) {
              const dateKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
              if (dateColumns.includes(dateKey)) {
                leaveDays[dateKey] = la.appliedLeaveType || "Leave";
              }
              cur.setDate(cur.getDate() + 1);
            }
          }
        });

        const company = companiesData.find((c: any) => c.id === emp.companyID);
        const branch = branchesData.find((b: any) => b.id === emp.branchesID);
        const dept = departmentsData.find((d: any) => d.id === emp.departmentNameID);

        return {
          employee: emp,
          companyName: company?.companyName || "N/A",
          branchName: branch?.branchName || "N/A",
          departmentName: dept?.departmentName || "N/A",
          leaveDays,
        };
      });

      setReportData(rows);
    } catch (err) {
      console.error("Error generating leave report:", err);
      alert("Error generating report. Check console for details.");
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData((prev) => ({
      ...prev,
      dateFrom: "",
      dateTo: getTodayStr(),
      department: "",
      designation: "",
      branchName: "",
      reportType: "All Leave Reports",
      companyID: user?.role === "SUPERADMIN" ? null : prev.companyID,
    }));
    setReportData([]);
    setSearchTerm("");
  };

  // ─── Download Excel ───────────────────────────────────────

  const downloadExcel = () => {
    if (reportData.length === 0) {
      alert("No data to download");
      return;
    }
    const dateColumns = buildDateRangeColumns();
    const excelData: any[] = [];

    // Header row
    const headerRow: any = {
      "S.NO": "S.NO",
      "Employee ID": "Employee ID",
      "Employee Name": "Employee Name",
      Company: "Company",
      Branch: "Branch",
      Department: "Department",
    };
    dateColumns.forEach((date) => {
      const { dayName, dateStr } = formatHeaderDate(date);
      headerRow[dateStr] = `${dateStr}\n${dayName}`;
    });
    excelData.push(headerRow);

    filteredReportData.forEach((row, index) => {
      const dataRow: any = {
        "S.NO": index + 1,
        "Employee ID": row.employee.employeeID,
        "Employee Name": `${row.employee.employeeFirstName} ${row.employee.employeeLastName}`,
        Company: row.companyName,
        Branch: row.branchName,
        Department: row.departmentName || "N/A",
      };
      dateColumns.forEach((date) => {
        const { dateStr } = formatHeaderDate(date);
        dataRow[dateStr] = row.leaveDays[date] || "-";
      });
      excelData.push(dataRow);
    });

    const ws = XLSX.utils.json_to_sheet(excelData, { skipHeader: true });

    // Styling
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const ref = XLSX.utils.encode_cell({ c: C, r: R });
        if (!ws[ref]) continue;
        ws[ref].s = {
          font: { name: "Arial", sz: 9 },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
        };
        if (R === 0) {
          ws[ref].s.fill = { fgColor: { rgb: "366092" } };
          ws[ref].s.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFF" } };
        }
      }
    }

    const colWidths = [{ wch: 6 }, { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 14 }];
    dateColumns.forEach(() => colWidths.push({ wch: 15 }));
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leave Report");
    const filename = `${formData.reportType.replace(/\s+/g, "_")}_${formData.dateFrom}_to_${formData.dateTo}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // ─── UI Filters ───────────────────────────────────────────

  const dateColumns = buildDateRangeColumns();

  const filteredReportData = reportData.filter((row) => {
    const fullName =
      `${row.employee.employeeFirstName} ${row.employee.employeeLastName}`.toLowerCase();
    return (
      fullName.includes(searchTerm.toLowerCase()) ||
      row.employee.employeeID.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.departmentName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader icon={FileText} title="Leave Reports" />

      {/* ── Filters Card ── */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {user?.role === "SUPERADMIN" && (
              <div className="space-y-2">
                <Label>Company</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md bg-white"
                  value={formData.companyID ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      companyID: e.target.value ? Number(e.target.value) : null,
                      branchName: "",
                      department: "",
                    }))
                  }
                >
                  <option value="">Select company</option>
                  {companies.map((c) => (
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
                {branches.map((b) => (
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
                onChange={(e) => setFormData((prev) => ({ ...prev, department: e.target.value }))}
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.departmentName}>
                    {d.departmentName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Designation</Label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-white"
                value={formData.designation}
                onChange={(e) => setFormData((prev) => ({ ...prev, designation: e.target.value }))}
              >
                <option value="">All designations</option>
                {designations.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.designation}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-white"
                value={formData.reportType}
                onChange={(e) => setFormData((prev) => ({ ...prev, reportType: e.target.value }))}
              >
                {REPORT_TYPES.map((rt) => (
                  <option key={rt.value} value={rt.value}>
                    {rt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={formData.dateFrom}
                onChange={(e) => setFormData((prev) => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={formData.dateTo}
                onChange={(e) => setFormData((prev) => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>
            <div className="col-span-2 flex items-end gap-3">
              <Button onClick={generateReport} disabled={loading}>
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
                <div className="w-3 h-3 bg-red-100 border border-red-300 rounded" />
                <span>SL = Sick Leave</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded" />
                <span>CL = Casual Leave</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-100 border border-green-300 rounded" />
                <span>PL = Privilege Leave</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded" />
                <span>LoP = Loss of Pay</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-100 border border-orange-300 rounded" />
                <span>WO = Week Off</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-purple-100 border border-purple-300 rounded" />
                <span>CO = Comp Off</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Leave data is fetched from approved leave applications for the selected date range.
          </p>
        </CardContent>
      </Card>

      {/* ── Empty State ── */}
      {reportData.length === 0 && !loading && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-gray-500">
            No leave data found for selected filters and date range.
          </CardContent>
        </Card>
      )}

      {/* ── Report Table ── */}
      {reportData.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <FileText className="w-5 h-5" />
                {formData.reportType} – {filteredReportData.length} employees
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search employee, company, branch..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
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
                <div className="relative">
                  <Button variant="outline" onClick={() => setColumnPickerOpen(v => !v)} className="flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Columns
                  </Button>
                  {columnPickerOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px] max-h-[300px] overflow-y-auto">
                      {[
                        { key: "sno", label: "S.NO" }, { key: "company", label: "Company" },
                        { key: "branch", label: "Branch" }, { key: "dept", label: "Dept" },
                        { key: "emp", label: "Employee" },
                      ].map(col => (
                        <label key={col.key} className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                          <input type="checkbox" checked={visibleColumns[col.key] !== false} onChange={() => toggleColumn(col.key)} className="w-3.5 h-3.5 rounded" />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto w-full border-t border-gray-200">
              <table className="min-w-full border-collapse text-xs">
                <thead className="bg-gray-900 text-white">
                  <tr>
                    {visibleColumns.sno && <th
                      className="sticky z-30 bg-gray-900 px-3 py-2 text-center"
                      style={{ left: getStickyLeft("sno"), width: LEFT_WIDTHS.sno, minWidth: LEFT_WIDTHS.sno }}
                    >
                      S.NO
                    </th>}
                    {visibleColumns.company && <th
                      className="sticky z-30 bg-gray-900 px-3 py-2 text-left"
                      style={{
                        left: getStickyLeft("company"),
                        width: LEFT_WIDTHS.company,
                        minWidth: LEFT_WIDTHS.company,
                      }}
                    >
                      COMPANY
                    </th>}
                    {visibleColumns.branch && <th
                      className="sticky z-30 bg-gray-900 px-3 py-2 text-left"
                      style={{
                        left: getStickyLeft("branch"),
                        width: LEFT_WIDTHS.branch,
                        minWidth: LEFT_WIDTHS.branch,
                      }}
                    >
                      BRANCH
                    </th>}
                    {visibleColumns.dept && <th
                      className="sticky z-30 bg-gray-900 px-3 py-2 text-left"
                      style={{
                        left: getStickyLeft("dept"),
                        width: LEFT_WIDTHS.dept,
                        minWidth: LEFT_WIDTHS.dept,
                      }}
                    >
                      DEPT
                    </th>}
                    {visibleColumns.emp && <th
                      className="sticky z-30 bg-gray-900 px-3 py-2 text-left"
                      style={{
                        left: getStickyLeft("emp"),
                        width: LEFT_WIDTHS.emp,
                        minWidth: LEFT_WIDTHS.emp,
                      }}
                    >
                      EMPLOYEE
                    </th>}
                    {dateColumns.map((date) => {
                      const { dayName, dateStr } = formatHeaderDate(date);
                      return (
                        <th
                          key={date}
                          className="px-2 py-1 text-center min-w-[100px] border-l border-blue-500 text-[11px]"
                        >
                          <div className="font-semibold">{dateStr}</div>
                          <div className="text-[10px] opacity-80 mt-1">{dayName}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filteredReportData.map((row, index) => (
                    <tr key={row.employee.id} className="odd:bg-gray-50">
                      {visibleColumns.sno && <td
                        className="sticky bg-white px-3 py-2 border-b border-r text-center text-[11px] z-20"
                        style={{ left: getStickyLeft("sno"), width: LEFT_WIDTHS.sno, minWidth: LEFT_WIDTHS.sno }}
                      >
                        {index + 1}
                      </td>}
                      {visibleColumns.company && <td
                        className="sticky bg-white px-3 py-2 border-b border-r text-[11px] z-20 align-top"
                        style={{
                          left: getStickyLeft("company"),
                          width: LEFT_WIDTHS.company,
                          minWidth: LEFT_WIDTHS.company,
                        }}
                      >
                        {row.companyName}
                      </td>}
                      {visibleColumns.branch && <td
                        className="sticky bg-white px-3 py-2 border-b border-r text-[11px] z-20 align-top"
                        style={{
                          left: getStickyLeft("branch"),
                          width: LEFT_WIDTHS.branch,
                          minWidth: LEFT_WIDTHS.branch,
                        }}
                      >
                        {row.branchName}
                      </td>}
                      {visibleColumns.dept && <td
                        className="sticky bg-white px-3 py-2 border-b border-r text-[11px] z-20 align-top"
                        style={{
                          left: getStickyLeft("dept"),
                          width: LEFT_WIDTHS.dept,
                          minWidth: LEFT_WIDTHS.dept,
                        }}
                      >
                        {row.departmentName || "N/A"}
                      </td>}
                      {visibleColumns.emp && <td
                        className="sticky bg-white px-3 py-2 border-b border-r text-[11px] z-20 align-top"
                        style={{
                          left: getStickyLeft("emp"),
                          width: LEFT_WIDTHS.emp,
                          minWidth: LEFT_WIDTHS.emp,
                        }}
                      >
                        <div>
                          {row.employee.employeeFirstName} {row.employee.employeeLastName}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          ({row.employee.employeeID})
                        </div>
                      </td>}
                      {dateColumns.map((date) => {
                        const status = row.leaveDays[date];
                        return (
                          <td
                            key={date}
                            className="px-2 py-1 border-b min-w-[100px] text-center align-top"
                          >
                            {status ? (
                              <div
                                className={`text-[10px] font-bold py-1 px-2 rounded ${getLeaveStatusClass(status)}`}
                              >
                                {normalizeLeaveType(status)}
                              </div>
                            ) : (
                              <div className="text-[10px] text-gray-300">-</div>
                            )}
                          </td>
                        );
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
