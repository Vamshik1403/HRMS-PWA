"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Search, Download, FileText } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import * as XLSX from "xlsx";
import { PageHeader } from "../components/app/page-header";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface Company { id: number; companyName: string; }
interface Branch { id: number; branchName: string; companyID: number; }
interface Department { id: number; companyID: number; branchesID: number; departmentName: string; }
interface Contractor { id: number; companyID: number | null; contractorName: string; }
interface WorkShift { id: number; companyID: number; branchesID: number; shiftName?: string; workShiftDay?: any[]; }
interface Employee {
  id: number; employeeID: string;
  employeeFirstName: string; employeeLastName: string;
  companyID: number; branchesID: number;
  departmentNameID?: number | null;
  contractorID?: number | null;
  workShiftID?: number | null;
  designationID?: number | null;
  designations?: { designation?: string };
  departments?: { departmentName?: string };
}

interface ReportRow {
  sno: number;
  employeeID: string;
  employeeName: string;
  companyName: string;
  branchName: string;
  departmentName: string;
  designation: string;
  contractorName: string;
  shiftName: string;
}

const REPORT_TYPES = [
  { value: "contractor_employees", label: "Contractor Employees" },
  { value: "contractor_summary", label: "Contractor Summary" },
];

export function ContractorReportsManagement() {
  const user = useCurrentUser();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    sno: true, employeeID: true, employeeName: true, company: true,
    branch: true, department: true, designation: true, contractor: true, shift: true,
  });
  const toggleColumn = (key: string) => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));

  const [formData, setFormData] = useState({
    companyID: null as number | null,
    branchID: null as number | null,
    departmentID: null as number | null,
    contractorID: null as number | null,
    shiftID: null as number | null,
    reportType: "contractor_employees",
  });

  // ── Load master data ──

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND_URL}/company`).then((r) => r.json()),
      fetch(`${BACKEND_URL}/branches`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${BACKEND_URL}/departments`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${BACKEND_URL}/contractors`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${BACKEND_URL}/work-shift`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${BACKEND_URL}/manage-emp`, { cache: "no-store" }).then((r) => r.json()),
    ]).then(([cos, brs, depts, cons, shifts, emps]) => {
      setCompanies(cos);
      setAllBranches(brs);
      setAllDepartments(depts);
      setContractors(Array.isArray(cons) ? cons : cons?.data ?? []);
      setWorkShifts(Array.isArray(shifts) ? shifts : shifts?.data ?? []);
      setEmployees(Array.isArray(emps) ? emps : emps?.data ?? []);
    });
  }, []);

  // ── Filter branches ──

  useEffect(() => {
    if (!user) return;
    let cid = formData.companyID;
    if (user.role !== "SUPERADMIN" && user.companyID) cid = user.companyID;
    let filtered = [...allBranches];
    if (cid) filtered = filtered.filter((b) => b.companyID === cid);
    setBranches(filtered);
    // Auto-select if only one branch
    if (user.role !== "SUPERADMIN" && filtered.length === 1) {
      setFormData((prev) => ({ ...prev, branchID: filtered[0].id }));
    }
  }, [user, allBranches, formData.companyID]);

  // ── Filter departments ──

  useEffect(() => {
    if (!user) return;
    const cid = user.role !== "SUPERADMIN" && user.companyID ? user.companyID : formData.companyID;
    let filtered = [...allDepartments];
    if (cid) filtered = filtered.filter((d) => d.companyID === cid);
    if (formData.branchID) filtered = filtered.filter((d) => d.branchesID === formData.branchID);
    setDepartments(filtered);
    // Auto-select if only one department
    if (user.role !== "SUPERADMIN" && filtered.length === 1) {
      setFormData((prev) => ({ ...prev, departmentID: filtered[0].id }));
    }
  }, [user, allDepartments, formData.companyID, formData.branchID]);

  // ── Filtered contractors by company ──

  const filteredContractors = contractors.filter((c) => {
    const cid = user?.role !== "SUPERADMIN" && user?.companyID ? user.companyID : formData.companyID;
    return !cid || c.companyID === cid || c.companyID == null;
  });

  // ── Filtered shifts by company/branch ──

  const filteredShifts = workShifts.filter((s) => {
    const cid = user?.role !== "SUPERADMIN" && user?.companyID ? user.companyID : formData.companyID;
    if (cid && s.companyID !== cid) return false;
    if (formData.branchID && s.branchesID !== formData.branchID) return false;
    return true;
  });

  // ── Generate Report ──

  const generateReport = async () => {
    setLoading(true);
    try {
      const cid = user?.role !== "SUPERADMIN" && user?.companyID ? user.companyID : formData.companyID;

      // Filter employees who belong to a contractor
      let filtered = employees.filter((e) => e.contractorID != null);

      if (cid) filtered = filtered.filter((e) => e.companyID === cid);
      if (formData.branchID) filtered = filtered.filter((e) => e.branchesID === formData.branchID);
      if (formData.departmentID) filtered = filtered.filter((e) => e.departmentNameID === formData.departmentID);
      if (formData.contractorID) filtered = filtered.filter((e) => e.contractorID === formData.contractorID);
      if (formData.shiftID) filtered = filtered.filter((e) => e.workShiftID === formData.shiftID);

      const companyMap = new Map(companies.map((c) => [c.id, c]));
      const branchMap = new Map(allBranches.map((b) => [b.id, b]));
      const deptMap = new Map(allDepartments.map((d) => [d.id, d]));
      const contMap = new Map(contractors.map((c) => [c.id, c]));
      const shiftMap = new Map(workShifts.map((s) => [s.id, s]));

      const rows: ReportRow[] = filtered.map((emp, i) => {
        const company = companyMap.get(emp.companyID);
        const branch = branchMap.get(emp.branchesID);
        const dept = emp.departmentNameID ? deptMap.get(emp.departmentNameID) : null;
        const cont = emp.contractorID ? contMap.get(emp.contractorID) : null;
        const shift = emp.workShiftID ? shiftMap.get(emp.workShiftID) : null;

        return {
          sno: i + 1,
          employeeID: emp.employeeID || "-",
          employeeName: `${emp.employeeFirstName} ${emp.employeeLastName}`,
          companyName: company?.companyName || "-",
          branchName: branch?.branchName || "-",
          departmentName: dept?.departmentName || emp.departments?.departmentName || "-",
          designation: emp.designations?.designation || "-",
          contractorName: cont?.contractorName || "-",
          shiftName: shift?.shiftName || `Shift ${shift?.id || "-"}`,
        };
      });

      setReportData(rows);
    } catch (err) {
      console.error("Error generating contractor report:", err);
      alert("Error generating report.");
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData((prev) => ({
      ...prev,
      branchID: null,
      departmentID: null,
      contractorID: null,
      shiftID: null,
      companyID: user?.role === "SUPERADMIN" ? null : prev.companyID,
      reportType: "contractor_employees",
    }));
    setReportData([]);
    setSearchTerm("");
  };

  // ── Filter displayed data ──

  const filteredData = reportData.filter((row) => {
    const term = searchTerm.toLowerCase();
    return !term || (
      row.employeeID.toLowerCase().includes(term) ||
      row.employeeName.toLowerCase().includes(term) ||
      row.companyName.toLowerCase().includes(term) ||
      row.branchName.toLowerCase().includes(term) ||
      row.departmentName.toLowerCase().includes(term) ||
      row.contractorName.toLowerCase().includes(term)
    );
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
      "Contractor": row.contractorName,
      "Shift": row.shiftName,
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);

    ws["!cols"] = [
      { wch: 6 }, { wch: 14 }, { wch: 22 }, { wch: 24 },
      { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 14 },
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
    XLSX.utils.book_append_sheet(wb, ws, "Contractor Report");
    XLSX.writeFile(wb, `Contractor_Report.xlsx`);
  };

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value ? Number(e.target.value) : null;
    setFormData((prev) => ({ ...prev, branchID: val, departmentID: null }));
  };

  // ── Render ──

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader icon={FileText} title="Contractors Reports" />

      {/* Filter Card */}
      <Card>
        <CardContent className="pt-6">
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
                      contractorID: null,
                      shiftID: null,
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
            {/* Contractor */}
            <div className="space-y-2">
              <Label>Contractor</Label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.contractorID ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    contractorID: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              >
                <option value="">All Contractors</option>
                {filteredContractors.map((c) => (
                  <option key={c.id} value={c.id}>{c.contractorName}</option>
                ))}
              </select>
            </div>

            {/* Shift */}
            <div className="space-y-2">
              <Label>Shift</Label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.shiftID ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    shiftID: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              >
                <option value="">All Shifts</option>
                {filteredShifts.map((s) => (
                  <option key={s.id} value={s.id}>{s.shiftName || `Shift ${s.id}`}</option>
                ))}
              </select>
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

          <p className="text-xs text-gray-500 mt-2">
            Reports show employees assigned to contractors, filtered by company, branch, department, contractor and shift.
          </p>
        </CardContent>
      </Card>

      {/* No data */}
      {reportData.length === 0 && !loading && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-gray-500">
            No records found for selected filters.
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
                    placeholder="Search employee, contractor..."
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
                        { key: "designation", label: "Designation" }, { key: "contractor", label: "Contractor" },
                        { key: "shift", label: "Shift" },
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
                <thead data-hrms-report-header className="bg-teal-50 text-teal-900 border-b border-teal-100">
                  <tr>
                    {visibleColumns.sno && <th className="px-3 py-2 text-center">S.NO</th>}
                    {visibleColumns.employeeID && <th className="px-3 py-2 text-left">EMPLOYEE ID</th>}
                    {visibleColumns.employeeName && <th className="px-3 py-2 text-left">EMPLOYEE NAME</th>}
                    {visibleColumns.company && <th className="px-3 py-2 text-left">COMPANY</th>}
                    {visibleColumns.branch && <th className="px-3 py-2 text-left">BRANCH</th>}
                    {visibleColumns.department && <th className="px-3 py-2 text-left">DEPARTMENT</th>}
                    {visibleColumns.designation && <th className="px-3 py-2 text-left">DESIGNATION</th>}
                    {visibleColumns.contractor && <th className="px-3 py-2 text-left">CONTRACTOR</th>}
                    {visibleColumns.shift && <th className="px-3 py-2 text-left">SHIFT</th>}
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
                      {visibleColumns.contractor && <td className="px-3 py-2 text-[11px]">{row.contractorName}</td>}
                      {visibleColumns.shift && <td className="px-3 py-2 text-[11px]">{row.shiftName}</td>}
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
