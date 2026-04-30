"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Search, Download, FileText } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import * as XLSX from "xlsx";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface Company { id: number; companyName: string; }
interface Branch { id: number; branchName: string; companyID: number; }
interface Department { id: number; companyID: number; branchesID: number; departmentName: string; }
interface Designation { id: number; companyID: number; branchesID: number; departmentID?: number; designation: string; }
interface Employee {
  id: number; employeeID: string;
  employeeFirstName: string; employeeLastName: string;
  companyID: number; branchesID: number; departmentNameID?: number | null;
  designationID?: number | null;
  designations?: { designation?: string };
  departments?: { departmentName?: string };
}

interface SalaryRecord {
  id: number;
  companyID: number | null;
  branchesID: number | null;
  employeeID: number;
  monthPeriod: string;
  paymentMode: string | null;
  paymentType: string | null;
  paymentDate: string | null;
  paymentRemark: string | null;
  status: string | null;
  manageEmployee?: Employee;
  company?: Company;
  branches?: Branch;
}

interface ReportRow {
  sno: number;
  employeeID: string;
  employeeName: string;
  companyName: string;
  branchName: string;
  departmentName: string;
  designation: string;
  monthPeriod: string;
  paymentMode: string;
  paymentDate: string;
  status: string;
}

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const REPORT_TYPES = [
  { value: "payout_summary", label: "Payout Summary" },
  { value: "total_working_hours", label: "Total Working Hours" },
  { value: "ot_hours", label: "OT Hours" },
];

export function PayrollReportsManagement() {
  const user = useCurrentUser();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allDesignations, setAllDesignations] = useState<Designation[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    sno: true, employeeID: true, employeeName: true, company: true,
    branch: true, department: true, designation: true, monthPeriod: true,
    paymentMode: true, paymentDate: true, status: true,
  });
  const toggleColumn = (key: string) => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));

  const [formData, setFormData] = useState({
    companyID: null as number | null,
    branchID: null as number | null,
    departmentID: null as number | null,
    designationID: null as number | null,
    reportType: "payout_summary",
    dateFrom: "",
    dateTo: getTodayStr(),
  });

  // ── Load master data ──

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND_URL}/company`).then((r) => r.json()),
      fetch(`${BACKEND_URL}/branches`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${BACKEND_URL}/departments`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${BACKEND_URL}/manage-emp`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${BACKEND_URL}/designations`, { cache: "no-store" }).then((r) => r.json()),
    ]).then(([cos, brs, depts, emps, desigs]) => {
      setCompanies(cos);
      setAllBranches(brs);
      setAllDepartments(depts);
      setEmployees(Array.isArray(emps) ? emps : emps?.data ?? []);
      setAllDesignations(Array.isArray(desigs) ? desigs : []);
    });
  }, []);

  // ── Filter branches ──

  useEffect(() => {
    if (!user) return;
    let cid = formData.companyID;
    if (user.role !== "SUPERADMIN" && user.companyID) cid = user.companyID;
    // For SUPERADMIN: show no branches until a company is selected
    if (user.role === "SUPERADMIN" && !cid) { setBranches([]); return; }
    let filtered = [...allBranches];
    if (cid) filtered = filtered.filter((b) => b.companyID === cid);
    setBranches(filtered);
  }, [user, allBranches, formData.companyID]);

  // ── Filter departments ──

  useEffect(() => {
    if (!user) return;
    const cid = user.role !== "SUPERADMIN" && user.companyID ? user.companyID : formData.companyID;
    // For SUPERADMIN: show no departments until a company is selected
    if (user.role === "SUPERADMIN" && !cid) { setDepartments([]); return; }
    let filtered = [...allDepartments];
    if (cid) filtered = filtered.filter((d) => d.companyID === cid);
    if (formData.branchID) filtered = filtered.filter((d) => d.branchesID === formData.branchID);
    setDepartments(filtered);
  }, [user, allDepartments, formData.companyID, formData.branchID]);

  // ── Generate Report ──

  const generateReport = async () => {
    if (!formData.dateFrom || !formData.dateTo) {
      alert("Please select both Date From and Date To");
      return;
    }

    setLoading(true);
    try {
      const cid = user?.role !== "SUPERADMIN" && user?.companyID ? user.companyID : formData.companyID;

      const res = await fetch(`${BACKEND_URL}/generate-salary`, { cache: "no-store" });
      const raw = await res.json();
      const records: SalaryRecord[] = Array.isArray(raw) ? raw : raw?.data ?? [];

      // Filter records by company, branch, department, date range
      const filtered = records.filter((rec) => {
        if (cid && rec.companyID !== cid) return false;
        if (formData.branchID && rec.branchesID !== formData.branchID) return false;
        if (formData.departmentID && rec.manageEmployee?.departmentNameID !== formData.departmentID) return false;
        if (formData.designationID && rec.manageEmployee?.designationID !== formData.designationID) return false;

        // Filter by date range using monthPeriod or paymentDate
        const recDate = rec.paymentDate || rec.monthPeriod;
        if (recDate) {
          if (formData.dateFrom && recDate < formData.dateFrom) return false;
          if (formData.dateTo && recDate > formData.dateTo) return false;
        }

        return true;
      });

      const companyMap = new Map(companies.map((c) => [c.id, c]));
      const branchMap = new Map(allBranches.map((b) => [b.id, b]));
      const deptMap = new Map(allDepartments.map((d) => [d.id, d]));

      const rows: ReportRow[] = filtered.map((rec, i) => {
        const emp = rec.manageEmployee;
        const company = rec.companyID ? companyMap.get(rec.companyID) : null;
        const branch = rec.branchesID ? branchMap.get(rec.branchesID) : null;
        const dept = emp?.departmentNameID ? deptMap.get(emp.departmentNameID) : null;

        return {
          sno: i + 1,
          employeeID: emp?.employeeID || "-",
          employeeName: emp ? `${emp.employeeFirstName} ${emp.employeeLastName}` : "-",
          companyName: company?.companyName || rec.company?.companyName || "-",
          branchName: branch?.branchName || rec.branches?.branchName || "-",
          departmentName: dept?.departmentName || emp?.departments?.departmentName || "-",
          designation: emp?.designations?.designation || "-",
          monthPeriod: rec.monthPeriod || "-",
          paymentMode: rec.paymentMode || "-",
          paymentDate: rec.paymentDate || "-",
          status: rec.status || "-",
        };
      });

      setReportData(rows);
    } catch (err) {
      console.error("Error generating payroll report:", err);
      alert("Error generating report.");
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
      branchID: null,
      departmentID: null,
      designationID: null,
      companyID: user?.role === "SUPERADMIN" ? null : prev.companyID,
      reportType: "payout_summary",
    }));
    setReportData([]);
    setSearchTerm("");
    setEmployeeFilter("");
  };

  // ── Filter employees by selected company ──

  const companyEmployees = employees.filter((emp) => {
    const cid = user?.role !== "SUPERADMIN" && user?.companyID ? user.companyID : formData.companyID;
    return !cid || emp.companyID === cid;
  });

  // ── Filter displayed data ──

  const filteredData = reportData.filter((row) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term || (
      row.employeeID.toLowerCase().includes(term) ||
      row.employeeName.toLowerCase().includes(term) ||
      row.companyName.toLowerCase().includes(term) ||
      row.branchName.toLowerCase().includes(term) ||
      row.departmentName.toLowerCase().includes(term)
    );
    const matchesEmployee = !employeeFilter || row.employeeID === employeeFilter;
    return matchesSearch && matchesEmployee;
  });

  // ── Download Excel ──

  const downloadExcel = () => {
    if (filteredData.length === 0) {
      alert("No data to download");
      return;
    }

    const excelRows = filteredData.map((row) => ({
      "S.NO": row.sno,
      "Employee ID": row.employeeID,
      "Employee Name": row.employeeName,
      "Company": row.companyName,
      "Branch": row.branchName,
      "Department": row.departmentName,
      "Designation": row.designation,
      "Month Period": row.monthPeriod,
      "Payment Mode": row.paymentMode,
      "Payment Date": row.paymentDate,
      "Status": row.status,
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);

    ws["!cols"] = [
      { wch: 6 }, { wch: 14 }, { wch: 22 }, { wch: 24 },
      { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 12 },
    ];

    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let C = range.s.c; C <= range.e.c; C++) {
      const ref = XLSX.utils.encode_cell({ r: 0, c: C });
      if (ws[ref]) {
        ws[ref].s = {
          font: { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "366092" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
        };
      }
    }

    for (let R = 1; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const ref = XLSX.utils.encode_cell({ r: R, c: C });
        if (ws[ref]) {
          ws[ref].s = {
            font: { name: "Arial", sz: 9 },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } },
            },
          };
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll Report");

    const typeLabel = REPORT_TYPES.find((t) => t.value === formData.reportType)?.label?.replace(/\s+/g, "_") || formData.reportType;
    XLSX.writeFile(wb, `Payroll_${typeLabel}_${formData.dateFrom}_to_${formData.dateTo}.xlsx`);
  };

  // ── Filter designations by company/branch ──

  useEffect(() => {
    if (!user) return;
    const cid = user.role !== "SUPERADMIN" && user.companyID ? user.companyID : formData.companyID;
    let filtered = [...allDesignations];
    // For SUPERADMIN: show no designations until a company is selected
    if (user.role === "SUPERADMIN" && !cid) { setDesignations([]); return; }
    if (cid) filtered = filtered.filter((d) => d.companyID === cid);
    if (formData.branchID) filtered = filtered.filter((d) => d.branchesID === formData.branchID);
    setDesignations(filtered);
  }, [user, allDesignations, formData.companyID, formData.branchID]);

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value ? Number(e.target.value) : null;
    setFormData((prev) => ({ ...prev, branchID: val, departmentID: null, designationID: null }));
  };

  // ── Render ──

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4">
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">
            Generate and view payroll reports by company, branch, department and date range.
          </p>
        </div>
      </div>

      {/* Filter Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Payroll Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Company */}
            {user?.role === "SUPERADMIN" && (
              <div className="space-y-2">
                <Label>Company</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md bg-white"
                  value={formData.companyID ?? ""}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setFormData((prev) => ({
                      ...prev,
                      companyID: val,
                      branchID: null,
                      departmentID: null,
                      designationID: null,
                    }));
                  }}
                >
                  <option value="">Select company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Branch */}
            <div className="space-y-2">
              <Label>Branch</Label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-white"
                value={formData.branchID ?? ""}
                onChange={handleBranchChange}
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.branchName}</option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label>Department</Label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-white"
                value={formData.departmentID ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    departmentID: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.departmentName}</option>
                ))}
              </select>
            </div>

            {/* Designation */}
            <div className="space-y-2">
              <Label>Designation</Label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-white"
                value={formData.designationID ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    designationID: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              >
                <option value="">All designations</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>{d.designation}</option>
                ))}
              </select>
            </div>

            {/* Report Type */}
            <div className="space-y-2">
              <Label>Report Type</Label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-white"
                value={formData.reportType}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, reportType: e.target.value }))
                }
              >
                {REPORT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Employee */}
            <div className="space-y-2">
              <Label>Employee</Label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
              >
                <option value="">All Employees</option>
                {companyEmployees.map((emp) => (
                  <option key={emp.id} value={emp.employeeID}>
                    {emp.employeeID} - {emp.employeeFirstName} {emp.employeeLastName}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="space-y-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={formData.dateFrom}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, dateFrom: e.target.value }))
                }
              />
            </div>

            {/* Date To */}
            <div className="space-y-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={formData.dateTo}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, dateTo: e.target.value }))
                }
              />
            </div>

            <div className="flex items-end gap-3">
              <Button onClick={generateReport} disabled={loading}>
                {loading ? "Generating..." : "Generate Report"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Reset
              </Button>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Reports are filtered by company, branch, department (if selected) and date range.
          </p>
        </CardContent>
      </Card>

      {/* No data */}
      {reportData.length === 0 && !loading && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-gray-500">
            No records found for selected filters and date range.
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {reportData.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <FileText className="w-5 h-5" />
                {REPORT_TYPES.find((t) => t.value === formData.reportType)?.label || formData.reportType} – {filteredData.length} records
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
                        { key: "sno", label: "S.NO" }, { key: "employeeID", label: "Employee ID" },
                        { key: "employeeName", label: "Employee Name" }, { key: "company", label: "Company" },
                        { key: "branch", label: "Branch" }, { key: "department", label: "Department" },
                        { key: "designation", label: "Designation" }, { key: "monthPeriod", label: "Month Period" },
                        { key: "paymentMode", label: "Payment Mode" }, { key: "paymentDate", label: "Payment Date" },
                        { key: "status", label: "Status" },
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
                    {visibleColumns.sno && <th className="px-3 py-2 text-center">S.NO</th>}
                    {visibleColumns.employeeID && <th className="px-3 py-2 text-left">EMPLOYEE ID</th>}
                    {visibleColumns.employeeName && <th className="px-3 py-2 text-left">EMPLOYEE NAME</th>}
                    {visibleColumns.company && <th className="px-3 py-2 text-left">COMPANY</th>}
                    {visibleColumns.branch && <th className="px-3 py-2 text-left">BRANCH</th>}
                    {visibleColumns.department && <th className="px-3 py-2 text-left">DEPARTMENT</th>}
                    {visibleColumns.designation && <th className="px-3 py-2 text-left">DESIGNATION</th>}
                    {visibleColumns.monthPeriod && <th className="px-3 py-2 text-center">MONTH PERIOD</th>}
                    {visibleColumns.paymentMode && <th className="px-3 py-2 text-center">PAYMENT MODE</th>}
                    {visibleColumns.paymentDate && <th className="px-3 py-2 text-center">PAYMENT DATE</th>}
                    {visibleColumns.status && <th className="px-3 py-2 text-center">STATUS</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, i) => (
                    <tr key={i} className="odd:bg-gray-50 border-b">
                      {visibleColumns.sno && <td className="px-3 py-2 text-center text-[11px]">{row.sno}</td>}
                      {visibleColumns.employeeID && <td className="px-3 py-2 text-[11px]">{row.employeeID}</td>}
                      {visibleColumns.employeeName && <td className="px-3 py-2 text-[11px]">{row.employeeName}</td>}
                      {visibleColumns.company && <td className="px-3 py-2 text-[11px]">{row.companyName}</td>}
                      {visibleColumns.branch && <td className="px-3 py-2 text-[11px]">{row.branchName}</td>}
                      {visibleColumns.department && <td className="px-3 py-2 text-[11px]">{row.departmentName}</td>}
                      {visibleColumns.designation && <td className="px-3 py-2 text-[11px]">{row.designation}</td>}
                      {visibleColumns.monthPeriod && <td className="px-3 py-2 text-center text-[11px]">{row.monthPeriod}</td>}
                      {visibleColumns.paymentMode && <td className="px-3 py-2 text-center text-[11px]">{row.paymentMode}</td>}
                      {visibleColumns.paymentDate && <td className="px-3 py-2 text-center text-[11px]">{row.paymentDate}</td>}
                      {visibleColumns.status && <td className="px-3 py-2 text-center text-[11px]">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          row.status === "Paid"
                            ? "bg-green-100 text-green-700"
                            : row.status === "Pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                        }`}>
                          {row.status}
                        </span>
                      </td>}
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
