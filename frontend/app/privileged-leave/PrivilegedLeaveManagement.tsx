"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { FormDrawer } from "../components/ui/form-drawer";
import { hasModuleWriteAccess } from "@/lib/companyAccess";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Icon } from "@iconify/react"
import { Plus, Calendar, History } from "lucide-react"
import { PageHeader } from "../components/app/page-header";
import { FilterBar } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import type { DataTableColumn } from "../components/app/data-table";
import { EntityRowActions } from "../components/app/entity-row-actions";
import { useClientTable, sortRows } from "../hooks/use-client-table";
import { useCurrentUser } from "../hooks/useCurrentUser"
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext"

const BACKEND_URL = "/backend"

interface LedgerEntry {
  id: number
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  employeeID: number
  leavePolicyID: number
  creditedLeaves: number
  usedLeaves: number
  balanceLeaves: number
  creditDate: string
  description?: string
  manageEmployee?: any
  leavePolicy?: any
}

interface LapseEntry {
  id: number
  employeeID: number
  leavePolicyID: number
  leaveCount: number
  lapseDate: string
  reason?: string
  manageEmployee?: any
  leavePolicy?: any
}

export function PrivilegedLeaveManagement() {
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [lapseEntries, setLapseEntries] = useState<LapseEntry[]>([])
  const table = useClientTable("employeeName")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreditDialogOpen, setIsCreditDialogOpen] = useState(false)
  const [isLapseDialogOpen, setIsLapseDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null)
  const [activeTab, setActiveTab] = useState<"ledger" | "lapse">("ledger")
  const [employees, setEmployees] = useState<any[]>([])
  const [policies, setPolicies] = useState<any[]>([])
  const [listLoading, setListLoading] = useState(true)

  const [formData, setFormData] = useState({
    employeeID: 0,
    leavePolicyID: 0,
    creditedLeaves: 0,
    usedLeaves: 0,
    balanceLeaves: 0,
    creditDate: new Date().toISOString().split("T")[0],
    description: "",
  })

  const [creditData, setCreditData] = useState({ employeeID: 0, leavePolicyID: 0 })
  const [lapseData, setLapseData] = useState({ employeeID: 0, leavePolicyID: 0 })

  // Calculate from Attendance dialog
  const [isCalcDialogOpen, setIsCalcDialogOpen] = useState(false)
  const [calcData, setCalcData] = useState({ employeeID: 0, leavePolicyID: 0 })
  const [calcPreview, setCalcPreview] = useState<any>(null)
  const [calcLoading, setCalcLoading] = useState(false)

  const user = useCurrentUser()
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN"

  const getActiveCompanyID = () => {
    const ctx = getSidebarContext();
    return ctx?.companyID ?? user?.companyID ?? null;
  };

  useEffect(() => {
    if (!user) return
    const loadInitial = async () => {
      setListLoading(true)
      try {
        await Promise.all([loadLedger(), loadLapses(), loadEmployees(), loadPolicies()])
      } finally {
        setListLoading(false)
      }
    }
    loadInitial()
  }, [user])

  useEffect(() => {
    if (!user) return;

    const reload = async () => {
      setEmployees([]);
      setPolicies([]);
      setLedgerEntries([]);
      table.setSearch("");

      setFormData((p) => ({ ...p, employeeID: 0, leavePolicyID: 0 }));
      setCreditData({ employeeID: 0, leavePolicyID: 0 });
      setLapseData({ employeeID: 0, leavePolicyID: 0 });
      setCalcData({ employeeID: 0, leavePolicyID: 0 });

      setListLoading(true);
      try {
        await Promise.all([loadLedger(), loadLapses(), loadEmployees(), loadPolicies()]);
      } finally {
        setListLoading(false);
      }
    };

    window.addEventListener("sidebar-context-changed", reload);
    window.addEventListener("app-data-refresh", reload);

    return () => {
      window.removeEventListener("sidebar-context-changed", reload);
      window.removeEventListener("app-data-refresh", reload);
    };
  }, [user]);

  const loadLedger = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/privileged-leave`, { cache: "no-store" });
      const data = await res.json();

      const activeCompanyID = getActiveCompanyID();

      let list = Array.isArray(data) ? data : [];

      if (activeCompanyID) {
        list = list.filter(
          (entry: any) =>
            Number(entry.companyID) === Number(activeCompanyID) ||
            Number(entry.manageEmployee?.companyID) === Number(activeCompanyID)
        );
      }

      if (user?.role === "BRANCH_ADMIN" && user?.branchesID) {
        list = list.filter(
          (entry: any) =>
            Number(entry.branchesID) === Number(user.branchesID) ||
            Number(entry.manageEmployee?.branchesID) === Number(user.branchesID)
        );
      }

      setLedgerEntries(list);
    } catch (err) {
      console.error("Error loading PL ledger:", err);
      toast.error("Failed to load data.");
      setLedgerEntries([]);
    }
  }

  const loadLapses = async () => {
    try {
      // We'll load all lapses from the ledger entries' employees
      setLapseEntries([])
    } catch (err) {
      console.error("Error loading lapses:", err)
      toast.error("Failed to load data.");
    }
  }

  const loadEmployees = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/manage-emp/list`, { cache: "no-store" });
      const data = await res.json();

      const activeCompanyID = getActiveCompanyID();

      let list = Array.isArray(data) ? data : [];

      if (activeCompanyID) {
        list = list.filter(
          (emp: any) => Number(emp.companyID) === Number(activeCompanyID)
        );
      }

      if (user?.role === "BRANCH_ADMIN" && user?.branchesID) {
        list = list.filter(
          (emp: any) => Number(emp.branchesID) === Number(user.branchesID)
        );
      }

      setEmployees(list);
    } catch (err) {
      console.error("Error loading employees:", err);
      toast.error("Failed to load employees.");
      setEmployees([]);
    }
  }

  const loadPolicies = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/leave-policy`, { cache: "no-store" });
      const data = await res.json();

      const activeCompanyID = getActiveCompanyID();

      let plPolicies = (Array.isArray(data) ? data : []).filter(
        (p: any) => p.isPrivilegedLeaveApplicable
      );

      if (activeCompanyID) {
        plPolicies = plPolicies.filter(
          (p: any) => Number(p.companyID) === Number(activeCompanyID)
        );
      }

      setPolicies(plPolicies);
    } catch (err) {
      console.error("Error loading policies:", err);
      toast.error("Failed to load policies.");
      setPolicies([]);
    }
  }

  const filteredLedger = useMemo(() => {
    const q = table.search.trim().toLowerCase()
    if (!q) return []
    return ledgerEntries.filter((entry) => {
      const empName = `${entry.manageEmployee?.employeeFirstName || ""} ${entry.manageEmployee?.employeeLastName || ""}`.toLowerCase()
      return empName.includes(q)
    })
  }, [ledgerEntries, table.search])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const ctx = getSidebarContext();
      const selectedEmp = employees.find((e: any) => Number(e.id) === Number(formData.employeeID));

      const payload = {
        ...formData,
        serviceProviderID: ctx?.serviceProviderID ?? selectedEmp?.serviceProviderID ?? user?.serviceProviderID ?? null,
        companyID: ctx?.companyID ?? selectedEmp?.companyID ?? user?.companyID ?? null,
        branchesID: selectedEmp?.branchesID ?? user?.branchesID ?? null,
      }

      if (editingEntry) {
        await fetch(`${BACKEND_URL}/privileged-leave/${editingEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch(`${BACKEND_URL}/privileged-leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }
      await loadLedger()
      setIsDialogOpen(false)
      toast.success(editingEntry ? "Updated successfully" : "Created successfully");
      resetForm()
    } catch (err) {
      console.error("Error saving PL entry:", err)
      toast.error("Failed to save. Please try again.");
    }
  }

  const handlePreviewCalc = async () => {
    if (!calcData.employeeID || !calcData.leavePolicyID) {
      toast.error("Please select an employee and leave policy first.")
      return
    }
    setCalcLoading(true)
    setCalcPreview(null)
    try {
      const res = await fetch(`${BACKEND_URL}/privileged-leave/calculate-from-attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...calcData, dryRun: true }),
      })
      const data = await res.json()
      setCalcPreview(data)
    } catch (err) {
      toast.error("Failed to preview PL calculation.")
    } finally {
      setCalcLoading(false)
    }
  }

  const handleCalculateAndCredit = async () => {
    if (!calcData.employeeID || !calcData.leavePolicyID) {
      toast.error("Please select an employee and leave policy first.")
      return
    }
    setCalcLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/privileged-leave/calculate-from-attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...calcData, dryRun: false }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "PL calculated and credited successfully")
        await loadLedger()
        setIsCalcDialogOpen(false)
        setCalcData({ employeeID: 0, leavePolicyID: 0 })
        setCalcPreview(null)
      } else {
        toast.error(data.message || "Failed to credit PL")
      }
    } catch (err) {
      toast.error("Failed to credit PL.")
    } finally {
      setCalcLoading(false)
    }
  }

  const handleCreditPL = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await fetch(`${BACKEND_URL}/privileged-leave/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creditData),
      })
      await loadLedger()
      setIsCreditDialogOpen(false)
      toast.success("Privileged leave credited successfully");
      setCreditData({ employeeID: 0, leavePolicyID: 0 })
    } catch (err) {
      console.error("Error crediting PL:", err)
      toast.error("Failed to update. Please try again.");
    }
  }

  const handleProcessLapse = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`${BACKEND_URL}/privileged-leave/lapse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lapseData),
      })
      const result = await res.json()
      toast.success(result.message || "Lapse processed")
      await loadLedger()
      setIsLapseDialogOpen(false)
      setLapseData({ employeeID: 0, leavePolicyID: 0 })
    } catch (err) {
      console.error("Error processing lapse:", err)
      toast.error("Lapse processing failed.");
    }
  }

  const resetForm = () => {
    setFormData({
      employeeID: 0,
      leavePolicyID: 0,
      creditedLeaves: 0,
      usedLeaves: 0,
      balanceLeaves: 0,
      creditDate: new Date().toISOString().split("T")[0],
      description: "",
    })
    setEditingEntry(null)
  }

  const handleEdit = (entry: LedgerEntry) => {
    setFormData({
      employeeID: entry.employeeID,
      leavePolicyID: entry.leavePolicyID,
      creditedLeaves: entry.creditedLeaves,
      usedLeaves: entry.usedLeaves,
      balanceLeaves: entry.balanceLeaves,
      creditDate: entry.creditDate?.split("T")[0] || "",
      description: entry.description || "",
    })
    setEditingEntry(entry)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await fetch(`${BACKEND_URL}/privileged-leave/${id}`, { method: "DELETE" })
      await loadLedger()
      toast.success("Deleted successfully");
    } catch (err) {
      console.error("Error deleting PL entry:", err)
      toast.error("Failed to delete. Please try again.");
    }
  }

  const getEmployeeName = (emp: any) => {
    if (!emp) return "-"
    return `${emp.employeeFirstName || ""} ${emp.employeeLastName || ""}`.trim() || "-"
  }

  // History drawer state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [historyEmployee, setHistoryEmployee] = useState<any>(null)
  const [historyEntries, setHistoryEntries] = useState<LedgerEntry[]>([])
  const [historyLapses, setHistoryLapses] = useState<LapseEntry[]>([])

  const handleShowHistory = async (employeeID: number, emp: any) => {
    setHistoryEmployee(emp)
    // Filter ledger entries for this employee
    setHistoryEntries(ledgerEntries.filter((e) => e.employeeID === employeeID))
    // Load lapse history for this employee
    try {
      const res = await fetch(`${BACKEND_URL}/privileged-leave/lapse-history/${employeeID}`)
      const data = await res.json()
      setHistoryLapses(Array.isArray(data) ? data : [])
    } catch {
      setHistoryLapses([])
    }
    setIsHistoryOpen(true)
  }

  // Compute aggregated employee-level summary from ledger entries
  interface EmployeePLSummary {
    employeeID: number
    employeeCode: string
    employeeName: string
    financialYear: string
    policyName: string
    totalDaysPresent: number
    plEarn: number
    cfPreviousFY: number
    totalPLCount: number
    consumedPL: number
    balancePL: number
    plExpiryDate: string
    manageEmployee: any
  }

  const aggregatedData: EmployeePLSummary[] = useMemo(() => {
    const map = new Map<number, LedgerEntry[]>()
    for (const entry of filteredLedger) {
      const arr = map.get(entry.employeeID) || []
      arr.push(entry)
      map.set(entry.employeeID, arr)
    }

    const now = new Date()
    const currentFYStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    const fyLabel = `${currentFYStart}-${String(currentFYStart + 1).slice(2)}`

    const rows: EmployeePLSummary[] = []
    map.forEach((entries, empId) => {
      const emp = entries[0]?.manageEmployee
      const policy = entries[0]?.leavePolicy

      const totalCredited = entries.reduce((s, e) => s + (e.creditedLeaves || 0), 0)
      const totalUsed = entries.reduce((s, e) => s + (e.usedLeaves || 0), 0)
      const totalBalance = entries.reduce((s, e) => s + (e.balanceLeaves || 0), 0)

      const fyStartDate = new Date(currentFYStart, 3, 1)
      const previousEntries = entries.filter((e) => new Date(e.creditDate) < fyStartDate)
      const cfPreviousFY = previousEntries.reduce((s, e) => s + (e.balanceLeaves || 0), 0)

      const plExpiryLimit = policy?.plCarryForwardLimit ?? 0
      const expiryDate = plExpiryLimit > 0 ? `${currentFYStart + 1}-03-31` : "-"

      rows.push({
        employeeID: empId,
        employeeCode: emp?.employeeID || String(empId),
        employeeName: getEmployeeName(emp),
        financialYear: fyLabel,
        policyName: policy?.leavePolicyName || "-",
        totalDaysPresent: 0,
        plEarn: totalCredited,
        cfPreviousFY,
        totalPLCount: totalCredited + cfPreviousFY,
        consumedPL: totalUsed,
        balancePL: totalBalance,
        plExpiryDate: expiryDate,
        manageEmployee: emp,
      })
    })

    return sortRows(rows, table.sortBy, table.sortDir, (row, key) => {
      const r = row as EmployeePLSummary
      if (key === "employeeCode") return r.employeeCode ?? ""
      if (key === "employeeName") return r.employeeName ?? ""
      if (key === "financialYear") return r.financialYear ?? ""
      if (key === "policyName") return r.policyName ?? ""
      if (key === "plEarn") return r.plEarn ?? 0
      if (key === "cfPreviousFY") return r.cfPreviousFY ?? 0
      if (key === "totalPLCount") return r.totalPLCount ?? 0
      if (key === "consumedPL") return r.consumedPL ?? 0
      if (key === "balancePL") return r.balancePL ?? 0
      if (key === "plExpiryDate") return r.plExpiryDate ?? ""
      return ""
    })
  }, [filteredLedger, table.sortBy, table.sortDir])

  const plSummaryColumns = useMemo((): DataTableColumn<EmployeePLSummary>[] => [
    {
      key: "employeeCode",
      header: "Employee ID",
      sortable: true,
      colSpan: 1,
      cell: (row) => row.employeeCode || "—",
    },
    {
      key: "employeeName",
      header: "Employee Name",
      sortable: true,
      colSpan: 2,
      cell: (row) => <span className="font-medium">{row.employeeName || "—"}</span>,
    },
    {
      key: "financialYear",
      header: "Financial Year",
      sortable: true,
      colSpan: 1,
      cell: (row) => row.financialYear || "—",
    },
    {
      key: "policyName",
      header: "PL Policy",
      sortable: true,
      colSpan: 2,
      cell: (row) => row.policyName || "—",
    },
    {
      key: "plEarn",
      header: "PL Earn",
      sortable: true,
      colSpan: 1,
      cell: (row) => (
        <Badge variant="secondary" className="bg-green-100 text-green-800">{row.plEarn}</Badge>
      ),
    },
    {
      key: "cfPreviousFY",
      header: "C/F (Prev FY)",
      sortable: true,
      colSpan: 1,
      cell: (row) => row.cfPreviousFY,
    },
    {
      key: "totalPLCount",
      header: "Total PL",
      sortable: true,
      colSpan: 1,
      cell: (row) => <span className="font-semibold">{row.totalPLCount}</span>,
    },
    {
      key: "consumedPL",
      header: "Consumed",
      sortable: true,
      colSpan: 1,
      cell: (row) => (
        <Badge variant="secondary" className="bg-red-100 text-red-800">{row.consumedPL}</Badge>
      ),
    },
    {
      key: "balancePL",
      header: "Balance",
      sortable: true,
      colSpan: 1,
      cell: (row) => <span className="font-semibold">{row.balancePL}</span>,
    },
    {
      key: "plExpiryDate",
      header: "Expiry",
      sortable: true,
      colSpan: 1,
      cell: (row) => row.plExpiryDate || "—",
    },
    {
      key: "actions",
      header: "Actions",
      colSpan: 1,
      align: "right",
      cell: (row) => (
        <EntityRowActions
          extra={[{
            icon: History,
            title: "View History",
            onClick: () => handleShowHistory(row.employeeID, row.manageEmployee),
          }]}
        />
      ),
    },
  ], [])

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={Calendar}
        title="Privileged Leave"
        description="Track PL credits, balances, and lapse history"
        actions={
          canManage ? (
            <Button
              size="sm"
              onClick={() => { setIsCalcDialogOpen(true); setCalcPreview(null) }}
              className="gap-1.5"
            >
              <Icon icon="mdi:calculator" className="w-4 h-4" />
              Calculate from Attendance
            </Button>
          ) : null
        }
      />
      {canManage && (
        <>
          {/* Calculate from Attendance Dialog */}
          <FormDrawer open={isCalcDialogOpen} onOpenChange={(o) => { setIsCalcDialogOpen(o); if (!o) { setCalcPreview(null); setCalcData({ employeeID: 0, leavePolicyID: 0 }) } }} title="Calculate PL from Attendance" description="Count actual attendance days and auto-credit Privileged Leave based on the policy ratio">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={calcData.employeeID}
                  onChange={(e) => { setCalcData((p) => ({ ...p, employeeID: Number(e.target.value) })); setCalcPreview(null) }}
                >
                  <option value={0}>Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {getEmployeeName(emp)} ({emp.employeeID || emp.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Leave Policy (PL Enabled)</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={calcData.leavePolicyID}
                  onChange={(e) => { setCalcData((p) => ({ ...p, leavePolicyID: Number(e.target.value) })); setCalcPreview(null) }}
                >
                  <option value={0}>Select Policy</option>
                  {policies.map((pol) => (
                    <option key={pol.id} value={pol.id}>
                      {pol.leavePolicyName} (Ratio: {pol.privilegedLeaveRatio || "20:1"})
                    </option>
                  ))}
                </select>
              </div>

              <Button type="button" variant="outline" onClick={handlePreviewCalc} disabled={calcLoading} className="w-full">
                {calcLoading ? "Calculating..." : "Preview Calculation"}
              </Button>
              {calcPreview && (
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Calculation Preview</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-white rounded-lg border p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">{calcPreview.totalWorkingDays}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Working Days</p>
                    </div>
                    <div className="bg-white rounded-lg border p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{calcPreview.plEarned}</p>
                      <p className="text-xs text-gray-500 mt-0.5">PL Earned</p>
                    </div>
                    <div className="bg-white rounded-lg border p-3 text-center">
                      <p className="text-2xl font-bold text-gray-500">{calcPreview.alreadyCredited}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Already Credited</p>
                    </div>
                    <div className="bg-white rounded-lg border p-3 text-center">
                      <p className={`text-2xl font-bold ${(calcPreview.toCredit || 0) > 0 ? "text-indigo-600" : "text-gray-400"}`}>{calcPreview.toCredit || 0}</p>
                      <p className="text-xs text-gray-500 mt-0.5">New PL to Credit</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Ratio: {calcPreview.ratio} &nbsp;·&nbsp; Week Off: {calcPreview.weekOffConsidered ? "counted" : "not counted"} &nbsp;·&nbsp; Holiday: {calcPreview.holidayConsidered ? "counted" : "not counted"}
                  </p>
                  <p className="text-xs font-medium text-gray-700">{calcPreview.message}</p>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsCalcDialogOpen(false)}>Cancel</Button>
                <Button
                  type="button"
                  disabled={calcLoading || !calcPreview || (calcPreview.toCredit || 0) === 0}
                  onClick={handleCalculateAndCredit}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {calcLoading ? "Crediting..." : `Credit ${calcPreview?.toCredit || 0} PL`}
                </Button>
              </div>
            </div>
          </FormDrawer>

          <FormDrawer open={isCreditDialogOpen} onOpenChange={setIsCreditDialogOpen} title={"Credit Privileged Leave"} description={"Auto-credit PL based on policy ratio"}>
            <form onSubmit={handleCreditPL} className="space-y-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={creditData.employeeID}
                  onChange={(e) => setCreditData((p) => ({ ...p, employeeID: Number(e.target.value) }))}
                  required
                >
                  <option value={0}>Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {getEmployeeName(emp)} ({emp.employeeID || emp.id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Leave Policy (PL Enabled)</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={creditData.leavePolicyID}
                  onChange={(e) => setCreditData((p) => ({ ...p, leavePolicyID: Number(e.target.value) }))}
                  required
                >
                  <option value={0}>Select Policy</option>
                  {policies.map((pol) => (
                    <option key={pol.id} value={pol.id}>
                      {pol.leavePolicyName} (Ratio: {pol.privilegedLeaveRatio || "20:1"})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreditDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">Credit PL</Button>
              </div>
            </form>

          </FormDrawer>

          <FormDrawer open={isLapseDialogOpen} onOpenChange={setIsLapseDialogOpen} title={"Process PL Lapse"} description={"Lapse excess PL beyond carry-forward limit"}>
            <form onSubmit={handleProcessLapse} className="space-y-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={lapseData.employeeID}
                  onChange={(e) => setLapseData((p) => ({ ...p, employeeID: Number(e.target.value) }))}
                  required
                >
                  <option value={0}>Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {getEmployeeName(emp)} ({emp.employeeID || emp.id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Leave Policy</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={lapseData.leavePolicyID}
                  onChange={(e) => setLapseData((p) => ({ ...p, leavePolicyID: Number(e.target.value) }))}
                  required
                >
                  <option value={0}>Select Policy</option>
                  {policies.map((pol) => (
                    <option key={pol.id} value={pol.id}>
                      {pol.leavePolicyName} (Limit: {pol.plCarryForwardLimit || 0})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsLapseDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-orange-600 hover:bg-orange-700">Process Lapse</Button>
              </div>
            </form>

          </FormDrawer>

          <FormDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen} title={editingEntry ? "Edit PL Entry" : "Add PL Ledger Entry"} description={"Manually add or edit a privileged leave ledger record"}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={formData.employeeID}
                    onChange={(e) => setFormData((p) => ({ ...p, employeeID: Number(e.target.value) }))}
                    required
                  >
                    <option value={0}>Select Employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {getEmployeeName(emp)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Leave Policy</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={formData.leavePolicyID}
                    onChange={(e) => setFormData((p) => ({ ...p, leavePolicyID: Number(e.target.value) }))}
                    required
                  >
                    <option value={0}>Select Policy</option>
                    {policies.map((pol) => (
                      <option key={pol.id} value={pol.id}>
                        {pol.leavePolicyName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Credited Leaves</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.creditedLeaves}
                    onChange={(e) => setFormData((p) => ({ ...p, creditedLeaves: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Used Leaves</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.usedLeaves}
                    onChange={(e) => setFormData((p) => ({ ...p, usedLeaves: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Balance Leaves</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.balanceLeaves}
                    onChange={(e) => setFormData((p) => ({ ...p, balanceLeaves: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Credit Date</Label>
                  <Input
                    type="date"
                    value={formData.creditDate}
                    onChange={(e) => setFormData((p) => ({ ...p, creditDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Optional note"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="">
                  {editingEntry ? "Update" : "Add Entry"}
                </Button>
              </div>
            </form>

          </FormDrawer>
        </>
      )}

      {!isDialogOpen && !isCreditDialogOpen && !isLapseDialogOpen && !isHistoryOpen && !isCalcDialogOpen && (
        <>
          <FilterBar
            search={{
              value: table.search,
              onChange: table.setSearch,
              placeholder: "Search by employee name…",
            }}
          />

          <EntityListShell
            title="Privileged leave summary"
            columns={plSummaryColumns}
            rows={aggregatedData}
            rowKey={(row) => String(row.employeeID)}
            isLoading={listLoading}
            sortBy={table.sortBy}
            sortDir={table.sortDir}
            onSort={table.setSort}
            emptyIcon={Calendar}
            emptyTitle={!table.search.trim() ? "Search to view PL records" : "No PL records found"}
            emptyDescription={
              !table.search.trim()
                ? "Type an employee name above to see their Privileged Leave summary."
                : `No PL records found for "${table.search.trim()}".`
            }
          />
        </>
      )}

      {/* History Drawer */}
      <FormDrawer
        open={isHistoryOpen}
        onOpenChange={(o) => { setIsHistoryOpen(o); if (!o) { setHistoryEmployee(null); setHistoryEntries([]); setHistoryLapses([]); } }}
        title={`PL History – ${getEmployeeName(historyEmployee)}`}
        description="Complete PL ledger and lapse history for this employee"
      >
        <div className="space-y-6">
          {/* Ledger History */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Credit / Debit Ledger</h4>
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Credited</TableHead>
                    <TableHead className="text-center">Used</TableHead>
                    <TableHead className="text-center">Balance</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-gray-500 text-sm">No ledger entries</TableCell>
                    </TableRow>
                  ) : (
                    historyEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {entry.creditDate ? new Date(entry.creditDate).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="bg-green-100 text-green-800">+{entry.creditedLeaves}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="bg-red-100 text-red-800">-{entry.usedLeaves}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{entry.balanceLeaves}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{entry.description || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Lapse History */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Lapse History</h4>
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lapse Date</TableHead>
                    <TableHead className="text-center">Lapsed Count</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyLapses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-gray-500 text-sm">No lapse records</TableCell>
                    </TableRow>
                  ) : (
                    historyLapses.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {entry.lapseDate ? new Date(entry.lapseDate).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800">{entry.leaveCount}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-sm">{entry.reason || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </FormDrawer>
    </div>
  )
}
