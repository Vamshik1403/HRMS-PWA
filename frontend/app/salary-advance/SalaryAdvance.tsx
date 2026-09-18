"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import {
  Dialog, DialogContent, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog"
import { FormDrawer } from "../components/ui/form-drawer"
import { Badge } from "../components/ui/badge"
import { Edit, Trash2, Check, X, Plus, Settings, PlusCircle, MinusCircle, AlertCircle, Loader2, Wallet } from "lucide-react"
import { PageHeader } from "../components/app/page-header";
import { hasModuleWriteAccess, isCompanyAdminLikeRole } from "@/lib/companyAccess";
import { FilterBar } from "../components/app/filter-bar"
import { EntityListShell } from "../components/app/entity-list-shell"
import type { DataTableColumn } from "../components/app/data-table"
import { EntityRowActions } from "../components/app/entity-row-actions"
import { useClientTable, sortRows } from "../hooks/use-client-table"
import { SearchSuggestInput } from "../components/SearchSuggestInput"
import { CompanyBranchField } from "../components/app/company-branch-field"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { toast } from "sonner"
import { getSidebarContext } from "../utils/sidebarContext"
import { resolveScopedCompanyId } from "../utils/scopeContext"

// ============ Type Definitions ============
type AdvanceStatus = "Pending" | "Approved" | "Rejected" | "Paid"

interface SalaryAdvance {
  id: string
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  manageEmployeeID?: number
  serviceProvider?: string
  companyName?: string
  branchName?: string
  employeeName?: string
  previousAdvancesDue: string
  advanceAmount: string
  reason: string
  status: AdvanceStatus
  createdAt: string
}

interface SelectedItem {
  display: string
  value: number
  item: any
}

interface RepaymentRow {
  id?: number
  month: string
  amount: string
}

interface Company {
  id: number
  companyName: string
  financialYearStart: string
}

interface SalaryCycle {
  id: number
  companyID: number
  monthStartDay: string
}

interface FinancialYearOption {
  value: string
  label: string
}

interface SalaryPeriodOption {
  value: string
  label: string
}

interface SalaryAdvanceFormData {
  serviceProvider: string
  companyName: string
  branchName: string
  employeeName: string
  previousAdvancesDue: string
  advanceAmount: string
  reason: string
  status: AdvanceStatus
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  manageEmployeeID?: number
}

interface ManagerData {
  id: number
  username: string
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  companyName:string
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend"

export function SalaryAdvanceManagement() {
  const [advances, setAdvances] = useState<SalaryAdvance[]>([])
  const table = useClientTable("employeeName")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAdvance, setEditingAdvance] = useState<SalaryAdvance | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [managerData, setManagerData] = useState<ManagerData | null>(null)
  
  const [formData, setFormData] = useState<SalaryAdvanceFormData>({
    serviceProvider: "",
    companyName: "",
    branchName: "",
    employeeName: "",
    previousAdvancesDue: "0",
    advanceAmount: "",
    reason: "",
    status: "Pending",
    serviceProviderID: undefined,
    companyID: undefined,
    branchesID: undefined,
    manageEmployeeID: undefined,
  })

  // ============ Repayment Modal State ============
  const [isRepaymentOpen, setIsRepaymentOpen] = useState(false)
  const [repaymentAdvance, setRepaymentAdvance] = useState<SalaryAdvance | null>(null)
  const [approvedAmount, setApprovedAmount] = useState("")
  const [repaymentRows, setRepaymentRows] = useState<RepaymentRow[]>([])
  const [financialYears, setFinancialYears] = useState<FinancialYearOption[]>([])
  const [salaryPeriods, setSalaryPeriods] = useState<SalaryPeriodOption[]>([])
  const [selectedFinancialYear, setSelectedFinancialYear] = useState("")
  const [selectedSalaryPeriod, setSelectedSalaryPeriod] = useState("")
  
  const user = useCurrentUser()
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || isCompanyAdminLikeRole(user?.role) || user?.role === "BRANCH_ADMIN"
  const isEmployee = !canManage

  const ctx = getSidebarContext();

  const resolvedServiceProviderID =
  user?.role === "SERVICE_PROVIDER"
    ? (managerData?.serviceProviderID ?? ctx?.serviceProviderID ?? user?.serviceProviderID)
    : formData.serviceProviderID;

const resolvedCompanyID =
  user?.role === "SERVICE_PROVIDER"
    ? (managerData?.companyID ?? ctx?.companyID ?? user?.companyID)
    : (isCompanyAdminLikeRole(user?.role) || user?.role === "BRANCH_ADMIN")
    ? (formData.companyID ?? ctx?.companyID ?? user?.companyID)
    : (
        formData.companyID ??
        resolveScopedCompanyId(user) ??
        ctx?.companyID ??
        user?.companyID
      );

const resolvedBranchID = formData.branchesID;


  // ============ Load Manager Data ============
  useEffect(() => {
    const loadManagerData = async () => {
      if (user?.role === "SERVICE_PROVIDER") {
        try {
          const usersData = await robustGet<any[]>(`${BACKEND_URL}/users`)
          const currentUser = usersData.find(u => u.username === user.username)
          if (currentUser) {
            setManagerData({
              id: currentUser.id,
              username: currentUser.username,
              serviceProviderID: currentUser.serviceProviderID,
              companyID: currentUser.companyID,
              branchesID: currentUser.branchesID,
              companyName: currentUser.companyName || ""
            })
            
            // Auto-populate form data for manager
            if (currentUser.companyID) {
              const companyData = await robustGet<Company>(`${BACKEND_URL}/company/${currentUser.companyID}`)
              setFormData(prev => ({
                ...prev,
                companyID: currentUser.companyID,
                companyName: companyData?.companyName || "",
                branchesID: currentUser.branchesID
              }))
            }
          }
        } catch (error) {
          console.error("Failed to load manager data:", error)
        }
      }
    }
    
    if (user) {
      loadManagerData()
    }
  }, [user])

  // ============ API helpers ============
  const robustGet = useCallback(async <T = any>(url: string): Promise<T> => {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) throw new Error(`${res.status}`)
    return res.json()
  }, [])

  const robustFetch = useCallback(async (url: string, init?: RequestInit) => {
    const res = await fetch(url, init)
    if (!res.ok) throw new Error(`${res.status}`)
    return res.json().catch(() => ({}))
  }, [])

  const fetchServiceProviders = useCallback(async (q: string) => {
    const data = await robustGet<any[]>(`${BACKEND_URL}/service-provider`)
    return data.filter(d => (d.companyName || "").toLowerCase().includes(q.toLowerCase()))
  }, [robustGet])

const fetchCompanies = useCallback(
  async (q: string) => {
    if (!resolvedServiceProviderID) return [];

    const data = await robustGet<any[]>(`${BACKEND_URL}/company`);
    const query = q.toLowerCase();

    return data.filter(
      (c) =>
        c.serviceProviderID === resolvedServiceProviderID &&
        (c.companyName || "").toLowerCase().includes(query)
    );
  },
  [robustGet, resolvedServiceProviderID]
);


 const fetchBranches = useCallback(
  async (q: string) => {
    if (!resolvedCompanyID) return [];

    const data = await robustGet<any[]>(`${BACKEND_URL}/branches`);
    const query = q.toLowerCase();
    const rows = Array.isArray(data) ? data : [];
    const seen = new Set<number>();

    return rows.filter((b) => {
      const id = Number(b.id);
      if (!Number.isFinite(id) || seen.has(id)) return false;
      if (Number(b.companyID) !== Number(resolvedCompanyID)) return false;
      if (user?.role === "BRANCH_ADMIN" && Number(b.id) !== Number(user?.branchesID)) return false;
      if (!(b.branchName || "").toLowerCase().includes(query)) return false;
      seen.add(id);
      return true;
    });
  },
  [robustGet, resolvedCompanyID, user?.role, user?.branchesID]
);


 const fetchEmployees = useCallback(
  async (q: string) => {
    if (!resolvedCompanyID) return [];

    const data = await robustGet<any[]>(`${BACKEND_URL}/manage-emp`);
    const query = q.toLowerCase();

    return data.filter((e) => {
      const name = `${e.employeeFirstName || ""} ${e.employeeLastName || ""}`
        .trim()
        .toLowerCase();
      const empId = (e.employeeID || "").toLowerCase();

      const matchesCompany = Number(e.companyID) === Number(resolvedCompanyID);
      const matchesBranch =
        !resolvedBranchID || Number(e.branchesID) === Number(resolvedBranchID);

      return (
        matchesCompany &&
        matchesBranch &&
        (name.includes(query) || empId.includes(query) || !query)
      );
    });
  },
  [robustGet, resolvedCompanyID, resolvedBranchID]
);

  // ============ Form Validation ============
  const validateForm = useCallback((): boolean => {
    const amount = parseFloat(formData.advanceAmount)
    return (
      formData.manageEmployeeID !== undefined &&
      formData.advanceAmount.trim() !== "" &&
      !isNaN(amount) &&
      amount > 0 &&
      formData.reason.trim() !== ""
    )
  }, [formData])

  // ============ Financial Year & Salary Period Logic ============
  const getFinancialYearOptions = useCallback((financialYearStart: string): FinancialYearOption[] => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    
    if (financialYearStart.includes('Jan')) {
      return [
        { value: `${currentYear}`, label: `${currentYear}` },
        { value: `${currentYear + 1}`, label: `${currentYear + 1}` }
      ]
    } else if (financialYearStart.includes('Apr')) {
      const options: FinancialYearOption[] = []
      
      if (currentMonth >= 4) {
        options.push({ 
          value: `${currentYear}-${currentYear + 1}`, 
          label: `${currentYear}-${currentYear + 1}` 
        })
        options.push({ 
          value: `${currentYear + 1}-${currentYear + 2}`, 
          label: `${currentYear + 1}-${currentYear + 2}` 
        })
      } else {
        options.push({ 
          value: `${currentYear - 1}-${currentYear}`, 
          label: `${currentYear - 1}-${currentYear}` 
        })
        options.push({ 
          value: `${currentYear}-${currentYear + 1}`, 
          label: `${currentYear}-${currentYear + 1}` 
        })
      }
      
      return options
    }
    
    return [
      { value: `${currentYear}`, label: `${currentYear}` },
      { value: `${currentYear + 1}`, label: `${currentYear + 1}` }
    ]
  }, [])

  const getSalaryPeriodOptions = useCallback((monthStartDay: string, financialYear: string): SalaryPeriodOption[] => {
    const monthStart = parseInt(monthStartDay) || 1
    const periods: SalaryPeriodOption[] = []
    
    if (monthStart === 1) {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ]
      
      if (financialYear.includes('-')) {
        const [startYear, endYear] = financialYear.split('-').map(Number)
        
        for (let i = 0; i < 12; i++) {
          const monthIndex = (i + 3) % 12
          const year = monthIndex >= 3 ? startYear : endYear
          periods.push({
            value: `${months[monthIndex]}-${year}`,
            label: `${months[monthIndex]} ${year}`
          })
        }
      } else {
        const year = parseInt(financialYear)
        months.forEach(month => {
          periods.push({
            value: `${month}-${year}`,
            label: `${month} ${year}`
          })
        })
      }
    } else {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ]
      
      if (financialYear.includes('-')) {
        const [startYear, endYear] = financialYear.split('-').map(Number)
        
        for (let i = 0; i < 12; i++) {
          const currentMonth = (i + 3) % 12
          const nextMonth = (currentMonth + 1) % 12
          const year = currentMonth >= 3 ? startYear : endYear
          const nextMonthYear = nextMonth >= 3 ? startYear : endYear
          
          periods.push({
            value: `${months[currentMonth]}-${year}`,
            label: `${monthStart} ${months[currentMonth]} to ${monthStart - 1} ${months[nextMonth]} ${nextMonthYear}`
          })
        }
      } else {
        const year = parseInt(financialYear)
        
        for (let i = 0; i < 12; i++) {
          const currentMonth = i
          const nextMonth = (i + 1) % 12
          const nextMonthYear = nextMonth === 0 ? year + 1 : year
          
          periods.push({
            value: `${months[currentMonth]}-${year}`,
            label: `${monthStart} ${months[currentMonth]} to ${monthStart - 1} ${months[nextMonth]} ${nextMonthYear}`
          })
        }
      }
    }
    
    return periods
  }, [])

  const loadCompanyAndSalaryCycleData = useCallback(async (companyID: number) => {
    try {
      const companyData = await robustGet<Company>(`${BACKEND_URL}/company/${companyID}`)
      const salaryCycles = await robustGet<SalaryCycle[]>(`${BACKEND_URL}/salary-cycle`)
      const companySalaryCycle = salaryCycles.find(sc => sc.companyID === companyID)
      
      if (companyData && companySalaryCycle) {
        const fyOptions = getFinancialYearOptions(companyData.financialYearStart)
        setFinancialYears(fyOptions)
        setSelectedFinancialYear(fyOptions[0]?.value || "")
        
        if (fyOptions[0]) {
          const spOptions = getSalaryPeriodOptions(companySalaryCycle.monthStartDay, fyOptions[0].value)
          setSalaryPeriods(spOptions)
          setSelectedSalaryPeriod(spOptions[0]?.value || "")
        }
      }
    } catch (error) {
      console.error("Error loading company and salary cycle data:", error)
    }
  }, [robustGet, getFinancialYearOptions, getSalaryPeriodOptions])



  // ============ Repayment Validation Helpers ============
  const getUsedSalaryPeriods = useCallback((): string[] => {
    return repaymentRows.map(row => row.month).filter(Boolean)
  }, [repaymentRows])

  const getAvailableSalaryPeriods = useCallback((): SalaryPeriodOption[] => {
    const usedPeriods = getUsedSalaryPeriods()
    return salaryPeriods.filter(period => !usedPeriods.includes(period.value))
  }, [salaryPeriods, getUsedSalaryPeriods])

  const getTotalRepaymentAmount = useCallback((): number => {
    return repaymentRows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0)
  }, [repaymentRows])

  const getRemainingAmount = useCallback((): number => {
    const approved = parseFloat(approvedAmount) || 0
    return approved - getTotalRepaymentAmount()
  }, [approvedAmount, getTotalRepaymentAmount])

  const hasDuplicateSalaryPeriods = useCallback((): boolean => {
    const periods = getUsedSalaryPeriods()
    return new Set(periods).size !== periods.length
  }, [getUsedSalaryPeriods])

  const isAmountExceeded = useCallback((): boolean => {
    return getRemainingAmount() < 0
  }, [getRemainingAmount])

  const canAddMoreRows = useCallback((): boolean => {
    return getAvailableSalaryPeriods().length > 0 && getRemainingAmount() > 0
  }, [getAvailableSalaryPeriods, getRemainingAmount])

  const isRepaymentFormValid = useCallback((): boolean => {
    return (
      !!approvedAmount &&
      parseFloat(approvedAmount) > 0 &&
      repaymentRows.length > 0 &&
      !hasDuplicateSalaryPeriods() &&
      !isAmountExceeded() &&
      repaymentRows.every(row => row.month && row.amount && parseFloat(row.amount) > 0)
    )
  }, [approvedAmount, repaymentRows, hasDuplicateSalaryPeriods, isAmountExceeded])

  // ============ Salary Advance CRUD ============
  useEffect(() => {
    if (user) {
      loadAdvances()
    }
  }, [user])

  const loadAdvances = useCallback(async () => {
    setLoading(true)
    try {
      const data = await robustGet<any[]>(`${BACKEND_URL}/salary-advance`)

      const mapped = data.map(a => ({
        id: String(a.id),
        serviceProviderID: a.serviceProviderID,
        companyID: a.companyID,
        branchesID: a.branchesID,
        manageEmployeeID: a.manageEmployeeID,
        serviceProvider: a.serviceProvider?.companyName || "",
        companyName: a.company?.companyName || "",
        branchName: a.branches?.branchName || "",
        employeeName: a.manageEmployee
          ? `${a.manageEmployee.employeeFirstName || ""} ${a.manageEmployee.employeeLastName || ""} (${a.manageEmployee.employeeID})`
          : "",
        previousAdvancesDue: a.previousAdvancesDue || "0",
        advanceAmount: a.advanceAmount || "",
        reason: a.reason || "",
        status: a.status || "Pending",
        createdAt: a.createdAt
          ? new Date(a.createdAt).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      }))

      if (user?.role === "SUPERADMIN") {
        setAdvances(mapped)
        return
      }

      if (user?.role === "SERVICE_PROVIDER") {
        const ctx = getSidebarContext()
        if (ctx?.companyID) {
          const filtered = mapped.filter(
            a => a.companyID === ctx.companyID
          )
          setAdvances(filtered)
          return
        }
        const usersData = await robustGet<any[]>(`${BACKEND_URL}/users`)
        const currentUser = usersData.find(u => u.username === user.username)
        if (currentUser?.serviceProviderID) {
          setAdvances(mapped.filter((a: any) => a.serviceProviderID === currentUser.serviceProviderID))
          return
        }
      }

      // COMPANY_ADMIN / BRANCH_ADMIN: filter by company
      if (isCompanyAdminLikeRole(user?.role) || user?.role === "BRANCH_ADMIN") {
        const ctx = getSidebarContext()
        const companyID = ctx?.companyID ?? user?.companyID
        if (companyID) {
          setAdvances(mapped.filter((a: any) => a.companyID === companyID))
        } else {
          setAdvances([])
        }
        return
      }

      const creds = await robustGet<any[]>(`${BACKEND_URL}/manage-emp/credentials/all`)
      const emp = creds.find(c => c.username === user?.username)
      if (emp) {
        const filtered = mapped.filter(
          a =>
            a.companyID === emp.companyID &&
            a.branchesID === emp.branchesID &&
            a.manageEmployeeID === emp.employeeID
        )
        setAdvances(filtered)
      } else {
        setAdvances([])
      }
    } catch (error) {
      console.error("Failed to load advances:", error)
      setAdvances([])
    } finally {
      setLoading(false)
    }
  }, [user, robustGet])

  const handleEmployeeSelect = useCallback(async (selected: SelectedItem) => {
    const emp = selected.item
    setFormData((p) => ({
      ...p,
     employeeName: `${emp.employeeFirstName || ""} ${emp.employeeLastName || ""} (${emp.employeeID})`,
    manageEmployeeID: emp.id,
    }))
    try {
      const data = await robustGet<any[]>(`${BACKEND_URL}/salary-advance`)
      const dues = data.filter((a) => a.manageEmployeeID === selected.value && a.status !== "Paid")
      const total = dues.reduce((sum, cur) => sum + (parseFloat(cur.advanceAmount || "0")), 0)
      setFormData((p) => ({ ...p, previousAdvancesDue: String(total) }))
    } catch {
      setFormData((p) => ({ ...p, previousAdvancesDue: "0" }))
    }
  }, [robustGet])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error("Please fill all required fields with valid data")
      return
    }

    setSubmitting(true)
    try {
      // For managers, auto-populate their company and branch data
      const submitData = {
        serviceProviderID: user?.role === "SERVICE_PROVIDER" ? managerData?.serviceProviderID : formData.serviceProviderID,
        companyID: user?.role === "SERVICE_PROVIDER" ? managerData?.companyID : formData.companyID,
        branchesID: user?.role === "SERVICE_PROVIDER" ? managerData?.branchesID : formData.branchesID,
        manageEmployeeID: formData.manageEmployeeID,
        previousAdvancesDue: formData.previousAdvancesDue,
        advanceAmount: formData.advanceAmount,
        reason: formData.reason,
        status: formData.status,
      }
      
      const url = editingAdvance 
        ? `${BACKEND_URL}/salary-advance/${editingAdvance.id}` 
        : `${BACKEND_URL}/salary-advance`
        
      const method = editingAdvance ? "PATCH" : "POST"
      
      await robustFetch(url, { 
        method, 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(submitData) 
      })
      
      await loadAdvances()
      resetForm()
      setIsDialogOpen(false)
      toast.success("Salary advance saved successfully")
    } catch (error) {
      console.error("Failed to save advance:", error)
      toast.error("Failed to save salary advance. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }, [formData, editingAdvance, validateForm, robustFetch, loadAdvances, user?.role, managerData])

  const resetForm = useCallback(() => {
    const ctx = getSidebarContext();
    const scopedCompany =
      resolveScopedCompanyId(user) ??
      ctx?.companyID ??
      user?.companyID ??
      undefined;
    setFormData({
      serviceProvider: "", 
      companyName: user?.role === "SERVICE_PROVIDER" ? managerData?.companyName || "" : "", 
      branchName: "", 
      employeeName: "",
      previousAdvancesDue: "0", 
      advanceAmount: "", 
      reason: "", 
      status: "Pending", 
      serviceProviderID: user?.role === "SERVICE_PROVIDER" ? managerData?.serviceProviderID : undefined,
      companyID: user?.role === "SERVICE_PROVIDER"
        ? managerData?.companyID
        : (isCompanyAdminLikeRole(user?.role) || user?.role === "BRANCH_ADMIN" || user?.role === "EMPLOYEE")
        ? scopedCompany
        : undefined,
      branchesID: user?.role === "SERVICE_PROVIDER" ? managerData?.branchesID : undefined,
      manageEmployeeID: undefined
    })
    setEditingAdvance(null)
  }, [user, managerData])

  const handleEdit = useCallback((a: SalaryAdvance) => {
    setFormData({
      serviceProvider: a.serviceProvider || "", 
      companyName: a.companyName || "", 
      branchName: a.branchName || "",
      employeeName: a.employeeName || "", 
      previousAdvancesDue: a.previousAdvancesDue || "0", 
      advanceAmount: a.advanceAmount || "",
      reason: a.reason || "", 
      status: a.status || "Pending",
      serviceProviderID: a.serviceProviderID, 
      companyID: a.companyID, 
      branchesID: a.branchesID, 
      manageEmployeeID: a.manageEmployeeID
    })
    setEditingAdvance(a)
    setIsDialogOpen(true)
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await robustFetch(`${BACKEND_URL}/salary-advance/${id}`, { method: "DELETE" })
      await loadAdvances()
      toast.success("Salary advance deleted successfully")
    } catch (error) {
      console.error("Failed to delete advance:", error)
      toast.error("Failed to delete salary advance. Please try again.")
    }
  }, [robustFetch, loadAdvances])

  const handleApprove = useCallback((advance: SalaryAdvance) => {
    openRepaymentModal(advance, true)
  }, [])

  const handleReject = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to reject this salary advance?")) {
      return
    }

    try {
      await robustFetch(`${BACKEND_URL}/salary-advance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Rejected" })
      })
      await loadAdvances()
    } catch (error) {
      console.error("Failed to reject advance:", error)
      toast.error("Failed to reject salary advance. Please try again.")
    }
  }, [robustFetch, loadAdvances])

  const filteredAdvances = useMemo(() => {
    const t = table.search.trim().toLowerCase()
    let list = advances.filter((a) =>
      !t ||
      (a.companyName || "").toLowerCase().includes(t) ||
      (a.employeeName || "").toLowerCase().includes(t) ||
      (a.advanceAmount || "").toLowerCase().includes(t)
    )
    return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
      const a = row as SalaryAdvance
      if (key === "employeeName") return a.employeeName ?? ""
      if (key === "previousAdvancesDue") return a.previousAdvancesDue ?? ""
      if (key === "advanceAmount") return a.advanceAmount ?? ""
      if (key === "reason") return a.reason ?? ""
      if (key === "status") return a.status ?? ""
      return ""
    })
  }, [advances, table.search, table.sortBy, table.sortDir])

  // ============ Repayment API ============
  const loadRepaymentsForAdvance = useCallback(async (advanceId: number) => {
    try {
      const rows = await robustGet<any[]>(`${BACKEND_URL}/salary-advance-repayment/advance/${advanceId}`)
      return rows
    } catch {
      return []
    }
  }, [robustGet])

  const clearRepaymentsForAdvance = useCallback(async (existing: Array<{ id: number }>) => {
    for (const r of existing) {
      await robustFetch(`${BACKEND_URL}/salary-advance-repayment/${r.id}`, { method: "DELETE" })
    }
  }, [robustFetch])

  const saveRepaymentPlan = useCallback(async (advanceId: number, approvedAmount: string, rows: RepaymentRow[]) => {
    const existing = await loadRepaymentsForAdvance(advanceId)
    if (existing && existing.length) {
      await clearRepaymentsForAdvance(existing)
    }

    for (const row of rows) {
      if (!row.month || !row.amount) continue
      
      const [monthName, year] = row.month.split('-')
      const monthIndex = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ].indexOf(monthName)
      
      if (monthIndex !== -1) {
        const startMonthISO = new Date(Date.UTC(parseInt(year), monthIndex, 1)).toISOString()
        
        await robustFetch(`${BACKEND_URL}/salary-advance-repayment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            salaryAdvanceID: advanceId,
            approvedAmount: approvedAmount,
            startMonth: startMonthISO,
            amount: row.amount
          })
        })
      }
    }
  }, [loadRepaymentsForAdvance, clearRepaymentsForAdvance, robustFetch])

  // ============ Repayment Modal Handlers ============
  const openRepaymentModal = useCallback((a: SalaryAdvance, isFromApproval: boolean = false) => {
    setRepaymentAdvance(a)
    setIsRepaymentOpen(true)
    
    setApprovedAmount(a.advanceAmount || "")
    setRepaymentRows([])
    setFinancialYears([])
    setSalaryPeriods([])
    setSelectedFinancialYear("")
    setSelectedSalaryPeriod("")
    
    if (a.companyID) {
      loadCompanyAndSalaryCycleData(a.companyID)
    }
    
    const advanceId = Number(a.id)
    if (Number.isFinite(advanceId)) {
      loadRepaymentsForAdvance(advanceId).then((rows) => {
        if (!rows || rows.length === 0) return
        
        if (rows[0]?.approvedAmount) {
          setApprovedAmount(rows[0].approvedAmount)
        }
        
        const repaymentRowsData = rows.map(r => {
          let monthValue = ""
          if (r.startMonth) {
            const d = new Date(r.startMonth)
            const monthName = [
              'January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December'
            ][d.getUTCMonth()]
            const year = d.getUTCFullYear()
            monthValue = `${monthName}-${year}`
          }
          return {
            id: r.id,
            month: monthValue,
            amount: r.amount || ""
          }
        })
        
        setRepaymentRows(repaymentRowsData)
      }).catch(() => { })
    }
  }, [loadCompanyAndSalaryCycleData, loadRepaymentsForAdvance])

  const addRepaymentRow = useCallback(() => {
    if (!selectedSalaryPeriod) {
      toast.error("Please select a salary period first")
      return
    }
    
    if (getUsedSalaryPeriods().includes(selectedSalaryPeriod)) {
      toast.error("This salary period is already selected. Please choose a different one.")
      return
    }
    
    if (!canAddMoreRows()) {
      toast.error("Cannot add more repayment entries. Either all periods are used or approved amount is fully allocated.")
      return
    }
    
    setRepaymentRows(prev => [...prev, { month: selectedSalaryPeriod, amount: "" }])
  }, [selectedSalaryPeriod, getUsedSalaryPeriods, canAddMoreRows])

  const removeRepaymentRow = useCallback((idx: number) => {
    setRepaymentRows(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const updateRepaymentRow = useCallback((idx: number, key: "month" | "amount", value: string) => {
    setRepaymentRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: value } : r))
  }, [])

  const saveRepayment = useCallback(async () => {
    if (!isRepaymentFormValid()) {
      toast.error("Please fix all validation errors before saving.")
      return
    }

    if (!repaymentAdvance) return

    const advanceId = Number(repaymentAdvance.id)
    if (!Number.isFinite(advanceId)) return

    try {
      await saveRepaymentPlan(advanceId, approvedAmount, repaymentRows)

      await robustFetch(`${BACKEND_URL}/salary-advance/${repaymentAdvance.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Approved" })
      })

      await loadAdvances()
      setIsRepaymentOpen(false)
      toast.success("Repayment plan saved successfully")
    } catch (error) {
      console.error("Error saving repayment plan:", error)
      toast.error("Error saving repayment plan. Please try again.")
    }
  }, [isRepaymentFormValid, repaymentAdvance, saveRepaymentPlan, approvedAmount, repaymentRows, robustFetch, loadAdvances])

  const advanceColumns = useMemo((): DataTableColumn<SalaryAdvance>[] => [
    {
      key: "employeeName",
      header: "Employee",
      sortable: true,
      colSpan: 3,
      cell: (a) => <span className="font-medium">{a.employeeName || "—"}</span>,
    },
    {
      key: "previousAdvancesDue",
      header: "Prev Due",
      sortable: true,
      colSpan: 2,
      cell: (a) => a.previousAdvancesDue || "0",
    },
    {
      key: "advanceAmount",
      header: "Amount",
      sortable: true,
      colSpan: 2,
      cell: (a) => a.advanceAmount || "—",
    },
    {
      key: "reason",
      header: "Reason",
      sortable: true,
      colSpan: 3,
      cell: (a) => a.reason || "—",
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      colSpan: 2,
      cell: (a) => (
        <Badge
          className={
            a.status === "Approved" ? "bg-green-600 hover:bg-green-600" :
            a.status === "Rejected" ? "bg-red-600 hover:bg-red-600" :
            "bg-yellow-500 hover:bg-yellow-500"
          }
        >
          {a.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      colSpan: 3,
      align: "right",
      cell: (a) => {
        const extras: { icon: typeof Settings; title: string; onClick: () => void; className?: string }[] = []
        if (canManage) {
          extras.push({
            icon: Settings,
            title: "Restructure Repayment",
            onClick: () => openRepaymentModal(a),
          })
          if (a.status === "Pending") {
            extras.push(
              { icon: Check, title: "Approve", onClick: () => handleApprove(a), className: "text-green-600" },
              { icon: X, title: "Reject", onClick: () => handleReject(a.id), className: "text-destructive" },
            )
          }
        }
        return (
          <EntityRowActions
            onEdit={
              (canManage || (isEmployee && a.status !== "Approved"))
                ? () => handleEdit(a)
                : undefined
            }
            onDelete={
              (canManage || (isEmployee && a.status !== "Approved"))
                ? () => handleDelete(a.id)
                : undefined
            }
            extra={extras.length > 0 ? extras : undefined}
          />
        )
      },
    },
  ], [canManage, isEmployee, handleApprove, handleReject, openRepaymentModal, handleEdit, handleDelete])

  // ===================== UI =====================
  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={Wallet}
        title="Salary Advances"
        description="Track advances, approvals, and repayments for your organization"
        actions={
          !isDialogOpen ? (
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />
              Add Salary Advance
            </Button>
          ) : null
        }
      />
      {/* FormDrawer for Add/Edit */}
      <FormDrawer
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={`${editingAdvance ? "Edit" : "Add"} Salary Advance`}
        description="Fill in the details for the salary advance."
      >
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Org Selection - Hidden for Managers */}
              {user?.role === "SUPERADMIN" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <SearchSuggestInput 
                    label="Service Provider" 
                    placeholder="Select Service Provider" 
                    value={formData.serviceProvider} 
                    onChange={v => setFormData(p => ({ ...p, serviceProvider: v }))} 
                    onSelect={s => setFormData(p => ({ ...p, serviceProvider: s.display, serviceProviderID: s.value }))} 
                    fetchData={fetchServiceProviders} 
                    displayField="companyName" 
                    valueField="id" 
                  />
                  <SearchSuggestInput 
                    label="Company" 
                    placeholder="Select Company" 
                    value={formData.companyName} 
                    onChange={v => setFormData(p => ({ ...p, companyName: v }))} 
                    onSelect={s => setFormData(p => ({ ...p, companyName: s.display, companyID: s.value }))} 
                    fetchData={fetchCompanies} 
                    displayField="companyName" 
                    valueField="id"  
                  />
                  <CompanyBranchField 
                    label="Branch" 
                    placeholder="Select Branch" 
                    value={formData.branchName} 
                    onChange={v => setFormData(p => ({ ...p, branchName: v }))} 
                    onSelect={s => setFormData(p => ({ ...p, branchName: s.display, branchesID: s.value }))} 
                    fetchData={fetchBranches} 
                    displayField="branchName" 
                    valueField="id"
                    companyID={formData.companyID ?? resolvedCompanyID}
                  />
                </div>
              )}

              {/* For Managers - Show read-only company info */}
              {user?.role === "SERVICE_PROVIDER" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 
                  <CompanyBranchField 
                    label="Branch" 
                    placeholder="Select Branch" 
                    value={formData.branchName} 
                    onChange={v => setFormData(p => ({ ...p, branchName: v }))} 
                    onSelect={s => setFormData(p => ({ ...p, branchName: s.display, branchesID: s.value }))} 
                    fetchData={fetchBranches} 
                    displayField="branchName" 
                    valueField="id"
                    companyID={formData.companyID ?? resolvedCompanyID}
                  />
                </div>
              )}

              {/* For COMPANY_ADMIN / BRANCH_ADMIN - Show branch input */}
              {(isCompanyAdminLikeRole(user?.role) || user?.role === "BRANCH_ADMIN") && (
                <div className="grid grid-cols-1 gap-4">
                  <CompanyBranchField 
                    label="Branch" 
                    placeholder="Select Branch" 
                    value={formData.branchName} 
                    onChange={v => setFormData(p => ({ ...p, branchName: v }))} 
                    onSelect={s => setFormData(p => ({ ...p, branchName: s.display, branchesID: s.value }))} 
                    fetchData={fetchBranches} 
                    displayField="branchName" 
                    valueField="id"
                    companyID={formData.companyID ?? resolvedCompanyID}
                  />
                </div>
              )}

              {/* Employee */}
              <SearchSuggestInput
                label="Employee"
                placeholder="Select Employee"
                value={formData.employeeName}
                onChange={(v) => setFormData((p) => ({ ...p, employeeName: v }))}
                onSelect={async (selected) => {
                  const data = await fetchEmployees("")
                  const item = data.find((d: any) => d.id === selected.value) || selected.item
                  const formatted = `${item?.employeeFirstName || ""} ${item?.employeeLastName || ""} (${item?.employeeID})`
                  await handleEmployeeSelect({ display: formatted, value: selected.value, item })
                }}
                fetchData={async (q: string) => {
                  const data = await fetchEmployees(q)
                  return data.map((emp: any) => ({
                    ...emp,
                    display: `${emp.employeeFirstName || ""} ${emp.employeeLastName || ""} (${emp.employeeID})`,
                    value: emp.id,
                  }))
                }}
                displayField="display"
                valueField="value"
                required
              />

              {/* Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Previous Advances Due</Label>
                  <Input 
                    type="text" 
                    value={formData.previousAdvancesDue} 
                    readOnly 
                    className="bg-gray-100" 
                  />
                </div>
                <div>
                  <Label>Advance Amount *</Label>
                  <Input 
                    type="text" 
                    value={formData.advanceAmount} 
                    onChange={e => setFormData(p => ({ ...p, advanceAmount: e.target.value }))} 
                    required 
                  />
                </div>
              </div>

              <div>
                <Label>Reason *</Label>
                <Input 
                  type="text" 
                  value={formData.reason} 
                  onChange={e => setFormData(p => ({ ...p, reason: e.target.value }))} 
                  required 
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingAdvance ? "Update Salary Advance" : "Add Salary Advance"}
                </Button>
              </div>
            </form>
      </FormDrawer>

      {!isDialogOpen && (
      <>
      <FilterBar
        search={{
          value: table.search,
          onChange: table.setSearch,
          placeholder: "Search advances…",
        }}
      />

      <EntityListShell
        title="Salary advances"
        columns={advanceColumns}
        rows={filteredAdvances}
        rowKey={(a) => a.id}
        isLoading={loading}
        sortBy={table.sortBy}
        sortDir={table.sortDir}
        onSort={table.setSort}
        emptyIcon={Wallet}
        emptyTitle="No salary advances found"
        emptyDescription="Add a salary advance request to get started."
        emptyAction={
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />
            Add Salary Advance
          </Button>
        }
      />
      </>
      )}

      {/* Repayment Modal */}
      <Dialog open={isRepaymentOpen} onOpenChange={setIsRepaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Repayment Plan</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Approved Amount */}
            <div>
              <Label>Approved Amount *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
                required
                className={parseFloat(approvedAmount) <= 0 ? "border-red-500" : ""}
              />
              {parseFloat(approvedAmount) <= 0 && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Approved amount must be greater than 0
                </p>
              )}
            </div>

            {/* Amount Summary */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <Label className="text-blue-700 font-semibold">Approved Amount</Label>
                  <div className="text-lg font-bold text-blue-900">{parseFloat(approvedAmount) || 0}</div>
                </div>
                <div>
                  <Label className="text-blue-700 font-semibold">Total Allocated</Label>
                  <div className={`text-lg font-bold ${isAmountExceeded() ? 'text-red-600' : 'text-blue-900'}`}>
                    {getTotalRepaymentAmount().toFixed(2)}
                  </div>
                </div>
                <div>
                  <Label className="text-blue-700 font-semibold">Remaining</Label>
                  <div className={`text-lg font-bold ${getRemainingAmount() < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {getRemainingAmount().toFixed(2)}
                  </div>
                </div>
              </div>
              
              {isAmountExceeded() && (
                <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded">
                  <p className="text-red-700 text-sm flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    Total allocated amount exceeds approved amount by {Math.abs(getRemainingAmount()).toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {/* Salary Period Selection */}
            {salaryPeriods.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <Label className="font-semibold">Select Salary Period</Label>
                <div className="flex gap-2 mt-2">
                  <select
                    className="flex-1 border px-2 py-2 rounded"
                    value={selectedSalaryPeriod}
                    onChange={(e) => setSelectedSalaryPeriod(e.target.value)}
                  >
                    <option value="">Choose a period...</option>
                    {getAvailableSalaryPeriods().map((sp) => (
                      <option key={sp.value} value={sp.value}>
                        {sp.label}
                      </option>
                    ))}
                  </select>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={addRepaymentRow}
                    disabled={!selectedSalaryPeriod || !canAddMoreRows()}
                  >
                    <PlusCircle className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>
                {getAvailableSalaryPeriods().length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">All salary periods have been allocated.</p>
                )}
              </div>
            )}

            {/* Repayment Schedule */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Repayment Schedule</Label>
                <div className="text-sm text-gray-500">
                  {repaymentRows.length} period(s) added
                </div>
              </div>
              
              {repaymentRows.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500">No repayment entries yet.</p>
                  <p className="text-sm text-gray-400 mt-1">Select a salary period above and click "Add"</p>
                </div>
              )}
              
              {repaymentRows.map((row, idx) => {
                const periodLabel = salaryPeriods.find(sp => sp.value === row.month)?.label || row.month
                return (
                  <div key={idx} className="border rounded-lg p-4 bg-white shadow-sm">
                    <div className="grid grid-cols-12 gap-4 items-end">
                      <div className="col-span-7">
                        <Label>Salary Period</Label>
                        <select
                          className="w-full border px-2 py-2 rounded mt-1"
                          value={row.month}
                          onChange={(e) => updateRepaymentRow(idx, "month", e.target.value)}
                        >
                          <option value="">Select Period</option>
                          {salaryPeriods.map((sp) => (
                            <option 
                              key={sp.value} 
                              value={sp.value}
                              disabled={getUsedSalaryPeriods().includes(sp.value) && sp.value !== row.month}
                            >
                              {sp.label}
                            </option>
                          ))}
                        </select>
                        <div className="text-sm text-gray-600 mt-1">{periodLabel}</div>
                      </div>
                      <div className="col-span-4 my-6">
                        <Label>Amount</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.amount}
                          onChange={(e) => updateRepaymentRow(idx, "amount", e.target.value)}
                          className={parseFloat(row.amount) <= 0 ? "border-red-500" : ""}
                        />
                        {parseFloat(row.amount) <= 0 && (
                          <p className="text-red-500 text-xs mt-1">Amount must be greater than 0</p>
                        )}
                      </div>
                      <div className="col-span-1 my-6 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-800"
                          onClick={() => removeRepaymentRow(idx)}
                          title="Remove Row"
                        >
                          <MinusCircle className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
              
              {/* Validation Messages */}
              {hasDuplicateSalaryPeriods() && (
                <div className="p-3 bg-red-100 border border-red-300 rounded">
                  <p className="text-red-700 text-sm flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    Duplicate salary periods detected. Please ensure each period is used only once.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2">
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => setIsRepaymentOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                onClick={saveRepayment}
                disabled={!isRepaymentFormValid()}
              >
                Save & Approve
              </Button>
            </div>
            
            {!isRepaymentFormValid() && (
              <div className="w-full text-center">
                <p className="text-sm text-gray-500">
                  {!approvedAmount ? "Enter approved amount" :
                   repaymentRows.length === 0 ? "Add at least one repayment entry" :
                   hasDuplicateSalaryPeriods() ? "Fix duplicate periods" :
                   isAmountExceeded() ? "Reduce total allocated amount" :
                   "All fields must be valid"}
                </p>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}