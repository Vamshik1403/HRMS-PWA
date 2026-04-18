"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "../components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { RefreshCw, Save, Users, Calendar, Filter, Trash2, AlertCircle } from "lucide-react"
import { Skeleton } from "../components/ui/skeleton"
import { toast } from "sonner"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { FixedCalendar as CalendarComponent } from "@/app/components/ui/color-calendar"

// ==================== TYPES ====================
type ID = number
type RosterLeaveType = "CASUAL" | "SICK" | "LOP" | "PL" | "COMP_OFF"

interface ServiceProvider { id: ID; companyName: string }
interface Company { id: ID; serviceProviderID: ID; companyName: string }
interface Branch { id: ID; serviceProviderID: ID; companyID: ID; branchName: string }
interface Department { id: ID; serviceProviderID: ID; companyID: ID; branchesID: ID; departmentName: string }
interface Designation { id: ID; serviceProviderID: ID; companyID: ID; branchesID: ID; departmentID: ID; designation: string }

interface WorkShift {
  id: ID
  workShiftName?: string
  shiftName?: string
  shiftCode?: string
  isActive?: string
}

interface RosterDay {
  id: ID
  rosterEmployeeID: ID
  workDate: string
  workShiftID: ID | null
  dayType: string
  leaveType: string | null
  isLocked: boolean
  workShift?: WorkShift | null
}

interface RosterEmployee {
  id: ID
  rosterID: ID
  employeeID: ID
  manageEmployee: ManageEmployee
  days: RosterDay[]
}

interface ManageEmployee {
  id: ID
  employeeFirstName?: string | null
  employeeLastName?: string | null
  employeeID?: string | null
  departmentNameID?: ID | null
  designationID?: ID | null
  serviceProviderID?: ID | null
  companyID?: ID | null
  branchesID?: ID | null
}

interface LeaveApplication {
  id: ID
  serviceProviderID: ID
  companyID: ID
  branchesID: ID
  manageEmployeeID: ID
  remainingSickLeave: number
  remainingCasualLeave: number
  remainingEarnedLeave: number | null
  dayStatuses: Array<{
    date: string
    status: string
  }>
  revokedAt: string | null
  revokedReason: string | null
  appliedLeaveType: string
  fromDate: string
  toDate: string
  purpose: string
  status: "Approved"
}

// ==================== CONSTANTS ====================
const BASE = "/backend"
const API = {
  sp: `${BASE}/service-provider`,
  company: `${BASE}/company`,
  branches: `${BASE}/branches`,
  departments: `${BASE}/departments`,
  designations: `${BASE}/designations`,
  selectEmployees: `${BASE}/roster-employees/select-employees`,
  workShifts: `${BASE}/work-shift`,
  bulkUpsert: `${BASE}/roster-days/bulk`,
  deleteRosterDay: (id: ID) => `${BASE}/roster-days/${id}`,
  getRosterEmployeeByEmployee: (employeeId: ID) => `${BASE}/roster-employees/by-employee/${employeeId}`,
  leaveApplications: `${BASE}/leave-application`,
  users: `${BASE}/users`,
  manageEmployees: `${BASE}/manage-emp`,
}

// ==================== UTILITIES ====================
function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

function formatDateForDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}.${month}.${year}`
}

function formatDateForTable(dateStr: string): string {
  const date = new Date(dateStr)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear().toString().slice(-2)
  return `${day}/${month}/${year}`
}

function formatDateCustom(dateStr: string): string {
  const date = new Date(dateStr)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear().toString().slice(-2)
  return `${day}/${month}/${year}`
}

function formatWeekday(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

function parseISODateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function dateRange(fromISO: string, toISO: string): string[] {
  const start = parseISODateOnly(fromISO)
  const end = parseISODateOnly(toISO)
  const out: string[] = []
  const cur = new Date(start)
  while (cur <= end) {
    out.push(isoDate(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

async function safeFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errorText}`)
  }
  return response.json()
}

function empName(e: ManageEmployee): string {
  const fn = e.employeeFirstName ?? ""
  const ln = e.employeeLastName ?? ""
  const full = `${fn} ${ln}`.trim()
  return full || `EMP-${e.id}`
}

// ==================== MAIN COMPONENT ====================
export function RosterManagement() {
  // ==================== STATE ====================
  const [spList, setSpList] = useState<ServiceProvider[]>([])
  const [coList, setCoList] = useState<Company[]>([])
  const [brList, setBrList] = useState<Branch[]>([])
  const [depList, setDepList] = useState<Department[]>([])
  const [desList, setDesList] = useState<Designation[]>([])
  const [shiftList, setShiftList] = useState<WorkShift[]>([])
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([])
  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null)
  const [managerCompanies, setManagerCompanies] = useState<Company[]>([])
  const [managerBranches, setManagerBranches] = useState<Branch[]>([])

  const [serviceProviderID, setServiceProviderID] = useState<ID | "">("")
  const [companyID, setCompanyID] = useState<ID | "">("")
  const [branchesID, setBranchesID] = useState<ID | "">("")
  const [departmentID, setDepartmentID] = useState<ID | "">("")
  const [designationID, setDesignationID] = useState<ID | "">("")

  const today = useMemo(() => isoDate(new Date()), [])
  const [fromDate, setFromDate] = useState<string>(today)
  const [toDate, setToDate] = useState<string>(today)

  const [employees, setEmployees] = useState<ManageEmployee[]>([])
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<ID>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  const [bulkFrom, setBulkFrom] = useState<Date>()
  const [bulkTo, setBulkTo] = useState<Date>()
  const [bulkMode, setBulkMode] = useState<"SHIFT" | "WEEKLY_OFF" | "LEAVE">("SHIFT")
  const [bulkShiftID, setBulkShiftID] = useState<ID | "">("")
  const [bulkLeaveType, setBulkLeaveType] = useState<RosterLeaveType>("CASUAL")

  const [rosterData, setRosterData] = useState<Map<ID, RosterEmployee>>(new Map())
  const [isLoading, setIsLoading] = useState({
    employees: false,
    roster: false,
    bulk: false,
    initial: true,
    leaves: false
  })
  const [deletingDays, setDeletingDays] = useState<Set<ID>>(new Set())
  const [openFromCalendar, setOpenFromCalendar] = useState(false)
  const [openToCalendar, setOpenToCalendar] = useState(false)

  // Get user from localStorage
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<"SUPERADMIN" | "SERVICE_PROVIDER" | "EMPLOYEE" | null>(null)

  // ==================== USER AUTHENTICATION ====================
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData)
        console.log("✅ User data from localStorage:", parsedUser)
        setUser(parsedUser)
        setUserRole(parsedUser.role)
      } catch (error) {
        console.error("❌ Error parsing user data:", error)
      }
    } else {
      console.log("❌ No user data in localStorage")
      window.alert("⚠️ Please log in first!")
    }
  }, [])

  // Load user mapping for MANAGER
  useEffect(() => {
    if (userRole !== "SERVICE_PROVIDER" || !user) return

    const loadUserMapping = async () => {
      try {
        const res = await fetch(API.users)
        const users = await res.json()
        const me = users.find((u: any) => u.username === user.username)

        if (me) {
          setCurrentUserMapping(me)
          console.log("👨‍💼 Manager mapping loaded:", me)

          // Set service provider for manager
          if (me.serviceProvider) {
            const sp: ServiceProvider = {
              id: me.serviceProviderID,
              companyName: me.serviceProvider.companyName
            }
            setSpList([sp])
            setServiceProviderID(me.serviceProviderID)
          }

          // Set only the mapped company
          if (me.company) {
            const company: Company = {
              id: me.companyID,
              serviceProviderID: me.serviceProviderID,
              companyName: me.company.companyName
            }
            setManagerCompanies([company]) // Only one company
            setCoList([company])
            setCompanyID(me.companyID) // Auto-select mapped company
          }

          // Set only the mapped branch
          if (me.branches) {
            const branch: Branch = {
              id: me.branchesID,
              serviceProviderID: me.serviceProviderID,
              companyID: me.companyID,
              branchName: me.branches.branchName
            }
            setManagerBranches([branch]) // Only one branch
            setBrList([branch])
            setBranchesID(me.branchesID) // Auto-select mapped branch
          }
        }
      } catch (error) {
        console.error("Error loading user mapping:", error)
      }
    }

    loadUserMapping()
  }, [userRole, user])

  const isSuperAdmin = userRole === "SUPERADMIN"
  const isServiceProvider = userRole === "SERVICE_PROVIDER"

  // ✅ EFFECTIVE SCOPE
  const effectiveServiceProviderID = useMemo(() => {
    if (isServiceProvider && currentUserMapping) return currentUserMapping.serviceProviderID
    return serviceProviderID
  }, [isServiceProvider, currentUserMapping, serviceProviderID])

  const effectiveCompanyID = useMemo(() => {
    if (isServiceProvider) return companyID
    return companyID
  }, [isServiceProvider, currentUserMapping, companyID])

  const effectiveBranchesID = useMemo(() => {
    if (isServiceProvider) return branchesID
    return branchesID
  }, [isServiceProvider, currentUserMapping, branchesID])

  // ==================== COMPUTED VALUES ====================
  const dates = useMemo(() => {
    try {
      const dateArray = dateRange(fromDate, toDate)
      return dateArray
    } catch {
      return []
    }
  }, [fromDate, toDate])

  const canLoadEmployees = useMemo(() => {
    if (isSuperAdmin) {
      return (
        !!serviceProviderID &&
        !!companyID &&
        !!branchesID &&
        !!fromDate &&
        !!toDate
      )
    }

    if (isServiceProvider) {
      return (
        !!currentUserMapping?.serviceProviderID &&
        !!companyID &&
        !!branchesID &&
        !!fromDate &&
        !!toDate
      )
    }

    return false
  }, [
    isSuperAdmin,
    isServiceProvider,
    serviceProviderID,
    companyID,
    branchesID,
    currentUserMapping,
    fromDate,
    toDate
  ])

  const selectedCompany = useMemo(() =>
    coList.find(c => c.id === effectiveCompanyID),
    [coList, effectiveCompanyID]
  )

  const shiftOptions = useMemo(() =>
    shiftList.map((s) => ({
      id: s.id,
      name: s.shiftName ?? s.workShiftName ?? s.shiftCode ?? `Shift-${s.id}`,
    })),
    [shiftList]
  )

  const bulkFromISO = useMemo(() => bulkFrom ? isoDate(bulkFrom) : "", [bulkFrom])
  const bulkToISO = useMemo(() => bulkTo ? isoDate(bulkTo) : "", [bulkTo])

  // ==================== DATA FETCHING ====================
  const fetchInitialData = useCallback(async () => {
    try {
      // Fetch shifts for both roles
      const shifts = await safeFetch<WorkShift[]>(API.workShifts).catch(() => [])
      setShiftList(shifts)

      // Only SUPERADMIN fetches Service Providers
      if (isSuperAdmin) {
        const sps = await safeFetch<ServiceProvider[]>(API.sp)
        setSpList(sps)
      }
    } catch (error) {
      console.error("Failed to load initial data:", error)
      toast.error("Failed to load initial data")
    } finally {
      setIsLoading(prev => ({ ...prev, initial: false }))
    }
  }, [isSuperAdmin])

  const fetchLeaveApplications = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, leaves: true }))
    try {
      const applications = await safeFetch<LeaveApplication[]>(API.leaveApplications)
      const approvedLeaves = applications.filter(app => app.status === "Approved")
      setLeaveApplications(approvedLeaves)
    } catch (error) {
      console.error("Failed to load leave applications:", error)
      toast.error("Failed to load leave applications")
      setLeaveApplications([])
    } finally {
      setIsLoading(prev => ({ ...prev, leaves: false }))
    }
  }, [])

  const fetchEmployees = useCallback(async () => {
    if (!canLoadEmployees) return

    setIsLoading(prev => ({ ...prev, employees: true }))
    try {
      const params = new URLSearchParams({
        serviceProviderID: String(effectiveServiceProviderID),
        companyID: String(effectiveCompanyID),
        branchesID: String(effectiveBranchesID),
      })

      // Only add departmentID if it's selected (not empty/"All Departments")
      if (departmentID) {
        params.append("departmentID", String(departmentID))
      }

      // Only add designationID if it's selected (not empty/"All Designations")
      if (designationID) {
        params.append("designationID", String(designationID))
      }

      const url = `${API.selectEmployees}?${params}`
      const response = await safeFetch<ManageEmployee[]>(url)

      setEmployees(response)
      setSelectedEmpIds(new Set())
      setSelectAll(false)

      await Promise.all([
        fetchRosterData(response.map(e => e.id)),
        fetchLeaveApplications()
      ])
    } catch (error) {
      console.error("Failed to load employees:", error)
      toast.error("Failed to load employees")
      setEmployees([])
    } finally {
      setIsLoading(prev => ({ ...prev, employees: false }))
    }
  }, [canLoadEmployees, effectiveServiceProviderID, effectiveCompanyID, effectiveBranchesID, departmentID, designationID, fetchLeaveApplications])

  const fetchRosterData = useCallback(async (employeeIds: ID[]) => {
    if (employeeIds.length === 0) return

    setIsLoading(prev => ({ ...prev, roster: true }))
    try {
      const rosterMap = new Map<ID, RosterEmployee>()

      const promises = employeeIds.map(async (empId) => {
        try {
          const response = await safeFetch<RosterEmployee>(
            API.getRosterEmployeeByEmployee(empId),
            {
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
              }
            }
          )
          if (response) {
            rosterMap.set(empId, response)
          }
        } catch (error) {
          console.warn(`No roster data for employee ${empId}:`, error)
        }
      })

      await Promise.all(promises)
      setRosterData(rosterMap)
    } catch (error) {
      console.error("Failed to load roster data:", error)
    } finally {
      setIsLoading(prev => ({ ...prev, roster: false }))
    }
  }, [])

  // ==================== EFFECTS ====================
  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  // SUPERADMIN: Load companies when service provider changes
  useEffect(() => {
    if (!isSuperAdmin) return

    setCompanyID("")
    setBranchesID("")
    setDepartmentID("")
    setDesignationID("")
    setCoList([])
    setBrList([])
    setDepList([])
    setDesList([])
    setEmployees([])
    setSelectedEmpIds(new Set())

    if (!serviceProviderID) return

    const loadCompanies = async () => {
      try {
        const all = await safeFetch<Company[]>(API.company)
        setCoList(all.filter(c => c.serviceProviderID === serviceProviderID))
      } catch (e) {
        console.error(e)
      }
    }

    loadCompanies()
  }, [serviceProviderID, isSuperAdmin])

  // SUPERADMIN: Load branches when company changes
  useEffect(() => {
    if (!isSuperAdmin) return

    setBranchesID("")
    setDepartmentID("")
    setDesignationID("")
    setBrList([])
    setDepList([])
    setDesList([])
    setEmployees([])
    setSelectedEmpIds(new Set())

    if (!serviceProviderID || !companyID) return

    const loadBranches = async () => {
      const all = await safeFetch<Branch[]>(API.branches)
      setBrList(
        all.filter(
          b =>
            b.serviceProviderID === serviceProviderID &&
            b.companyID === companyID
        )
      )
    }

    loadBranches()
  }, [serviceProviderID, companyID, isSuperAdmin])

  // Load departments when branch changes
  useEffect(() => {
    if (isSuperAdmin) {
      setDepartmentID("")
      setDesignationID("")
      setDepList([])
      setDesList([])
    }

    if (isSuperAdmin && (!serviceProviderID || !companyID || !branchesID)) return
    if (isServiceProvider && (!companyID || !branchesID)) return

    const loadDepartments = async () => {
      try {
        const depsAll = await safeFetch<Department[]>(API.departments)

        // Filter departments based on SP, Company, and Branch
        const filteredDeps = depsAll.filter(d =>
          d.serviceProviderID === effectiveServiceProviderID &&
          d.companyID === effectiveCompanyID &&
          d.branchesID === effectiveBranchesID
        )
        setDepList(filteredDeps)
      } catch (error) {
        console.error("Failed to load departments:", error)
      }
    }

    loadDepartments()
  }, [effectiveServiceProviderID, effectiveCompanyID, effectiveBranchesID, isSuperAdmin, isServiceProvider])

  // Load designations when department changes
  useEffect(() => {
    if (isSuperAdmin && (!serviceProviderID || !companyID || !branchesID)) return
    if (isServiceProvider && (!companyID || !branchesID)) return

    const loadDesignations = async () => {
      try {
        const desAll = await safeFetch<Designation[]>(API.designations)
        
        let filteredDes = desAll.filter(d =>
          d.serviceProviderID === effectiveServiceProviderID &&
          d.companyID === effectiveCompanyID &&
          d.branchesID === effectiveBranchesID
        )

        // Filter by department if one is selected
        if (departmentID) {
          filteredDes = filteredDes.filter(d => d.departmentID === departmentID)
        }

        setDesList(filteredDes)
      } catch (error) {
        console.error("Failed to load designations:", error)
      }
    }

    loadDesignations()
  }, [effectiveServiceProviderID, effectiveCompanyID, effectiveBranchesID, departmentID, isSuperAdmin, isServiceProvider])

  // Auto-refresh roster data
  useEffect(() => {
    if (employees.length > 0) {
      const interval = setInterval(() => {
        fetchRosterData(employees.map(e => e.id))
      }, 30000)

      return () => clearInterval(interval)
    }
  }, [employees, fetchRosterData])

  // ==================== UTILITY FUNCTIONS ====================
  const hasApprovedLeave = useCallback((employeeId: ID, dateStr: string): boolean => {
    const targetDate = new Date(dateStr).toISOString().split('T')[0]
    return leaveApplications.some(leave =>
      leave.manageEmployeeID === employeeId &&
      leave.status === "Approved" &&
      leave.dayStatuses.some(day => {
        const leaveDate = new Date(day.date).toISOString().split('T')[0]
        return leaveDate === targetDate
      })
    )
  }, [leaveApplications])

  const getLeaveTypeForDate = useCallback((employeeId: ID, dateStr: string): string | null => {
    const targetDate = new Date(dateStr).toISOString().split('T')[0]
    const leave = leaveApplications.find(l =>
      l.manageEmployeeID === employeeId &&
      l.status === "Approved"
    )
    if (!leave) return null

    const dayStatus = leave.dayStatuses.find(d => {
      const leaveDate = new Date(d.date).toISOString().split('T')[0]
      return leaveDate === targetDate
    })
    return dayStatus?.status || null
  }, [leaveApplications])

  const getDayForDate = useCallback((empId: ID, dateStr: string): RosterDay | undefined => {
    const rosterEmp = rosterData.get(empId)
    if (!rosterEmp?.days) return undefined

    const targetDate = new Date(dateStr).toISOString().split('T')[0]
    return rosterEmp.days.find(day =>
      new Date(day.workDate).toISOString().split('T')[0] === targetDate
    )
  }, [rosterData])

  const getCellDisplay = useCallback((empId: ID, dateStr: string) => {
    if (hasApprovedLeave(empId, dateStr)) {
      const leaveType = getLeaveTypeForDate(empId, dateStr)
      return {
        text: leaveType || "LEAVE",
        color: "bg-yellow-100 border-yellow-300",
        icon: "⚠️",
        hasApprovedLeave: true,
        leaveType: leaveType
      }
    }

    const day = getDayForDate(empId, dateStr)

    if (!day) {
      return {
        text: "-",
        color: "bg-gray-50 border-gray-200",
        icon: null,
        hasApprovedLeave: false
      }
    }

    switch (day.dayType) {
      case "WORK":
        const shiftName = day.workShift?.workShiftName || day.workShift?.shiftName || "WORK"
        return {
          text: shiftName,
          color: "bg-blue-50 border-blue-200 text-blue-700",
          icon: "👨‍💼",
          details: day.workShift?.shiftCode,
          hasApprovedLeave: false,
          rosterDayId: day.id
        }

      case "WEEKLY_OFF":
        return {
          text: "WO",
          color: "bg-green-50 border-green-200 text-green-700",
          icon: "🏖️",
          hasApprovedLeave: false,
          rosterDayId: day.id
        }

      case "LEAVE":
        return {
          text: day.leaveType || "LEAVE",
          color: "bg-yellow-50 border-yellow-200 text-yellow-700",
          icon: "🏥",
          hasApprovedLeave: false,
          rosterDayId: day.id
        }

      default:
        return {
          text: "-",
          color: "bg-gray-50 border-gray-200",
          icon: null,
          hasApprovedLeave: false
        }
    }
  }, [getDayForDate, hasApprovedLeave, getLeaveTypeForDate])

  // ==================== EVENT HANDLERS ====================
  const handleDeleteAssignment = async (rosterDayId: ID, employeeId: ID) => {
    if (!window.confirm("Are you sure you want to remove this assignment?")) return

    setDeletingDays(prev => new Set([...prev, rosterDayId]))
    try {
      await safeFetch(API.deleteRosterDay(rosterDayId), { method: "DELETE" })

      setRosterData(prev => {
        const newMap = new Map(prev)
        const rosterEmp = newMap.get(employeeId)
        if (rosterEmp) {
          const updatedDays = rosterEmp.days.filter(day => day.id !== rosterDayId)
          newMap.set(employeeId, { ...rosterEmp, days: updatedDays })
        }
        return newMap
      })

      toast.success("Assignment removed successfully!")
    } catch (error) {
      console.error("Error deleting roster day:", error)
      toast.error("Failed to remove assignment")
    } finally {
      setDeletingDays(prev => {
        const newSet = new Set(prev)
        newSet.delete(rosterDayId)
        return newSet
      })
    }
  }

  const handleBulkApply = async () => {
    if (selectedEmpIds.size === 0) {
      toast.error("Please select at least one employee")
      return
    }

    if (!bulkFrom || !bulkTo) {
      toast.error("Please select date range")
      return
    }

    if (bulkMode === "SHIFT" && !bulkShiftID) {
      toast.error("Please select a shift")
      return
    }

    const bulkFromDate = bulkFrom
    const bulkToDate = bulkTo

    if (isNaN(bulkFromDate.getTime()) || isNaN(bulkToDate.getTime())) {
      toast.error("Invalid date format")
      return
    }

    if (bulkFromDate > bulkToDate) {
      toast.error("From date cannot be after To date")
      return
    }

    const selectedDates: string[] = []
    const curDate = new Date(bulkFromDate)
    while (curDate <= bulkToDate) {
      selectedDates.push(isoDate(curDate))
      curDate.setDate(curDate.getDate() + 1)
    }

    const conflicts: Array<{
      empId: ID,
      empName: string,
      date: string,
      type: string,
      currentAssignment?: string,
      dayType?: string
    }> = []

    Array.from(selectedEmpIds).forEach(empId => {
      const emp = employees.find(e => e.id === empId)
      if (!emp) return

      selectedDates.forEach(date => {
        if (hasApprovedLeave(empId, date)) {
          const leaveType = getLeaveTypeForDate(empId, date)
          conflicts.push({
            empId,
            empName: empName(emp),
            date: formatDateForTable(date),
            type: "approved_leave",
            currentAssignment: leaveType || "Approved Leave",
            dayType: "APPROVED_LEAVE"
          })
          return
        }

        const day = getDayForDate(empId, date)
        if (day) {
          let currentType = ""
          let currentAssignment = ""

          switch (day.dayType) {
            case "WORK":
              currentType = "shift"
              currentAssignment = day.workShift?.workShiftName || day.workShift?.shiftName || day.workShift?.shiftCode || "Shift"
              break
            case "WEEKLY_OFF":
              currentType = "weekly_off"
              currentAssignment = "Weekly Off"
              break
            case "LEAVE":
              currentType = "roster_leave"
              currentAssignment = day.leaveType || "Leave"
              break
          }

          conflicts.push({
            empId,
            empName: empName(emp),
            date: formatDateForTable(date),
            type: currentType,
            currentAssignment,
            dayType: day.dayType
          })
        }
      })
    })

    if (conflicts.length > 0) {
      window.alert(
        "❌ Bulk assignment blocked\n\n" +
        "Reason:\n" +
        conflicts.slice(0, 10).map(c => `• ${c.empName} | ${c.date} | ${c.currentAssignment || c.type}`).join("\n") +
        (conflicts.length > 10 ? `\n...and ${conflicts.length - 10} more` : "") +
        "\n\nFix:\nDelete existing assignments first."
      )
      return
    }

    const totalCells = selectedEmpIds.size * selectedDates.length

    setIsLoading(prev => ({ ...prev, bulk: true }))
    try {
      const requests = Array.from(selectedEmpIds).map((employeeId) => {
        const payload: any = {
          employeeID: employeeId,
          fromDate: bulkFromISO,
          toDate: bulkToISO,
          dayType: bulkMode === "SHIFT" ? "WORK" : bulkMode,
        }

        if (bulkMode === "SHIFT") payload.workShiftID = bulkShiftID
        if (bulkMode === "LEAVE") payload.leaveType = bulkLeaveType

        return safeFetch(API.bulkUpsert, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      })

      await Promise.all(requests)
      toast.success(`✅ Success! Applied ${bulkMode.toLowerCase()} to ${totalCells} cells`, {
        duration: 5000,
        position: 'top-center',
        style: {
          backgroundColor: '#d1fae5',
          border: '2px solid #a7f3d0',
          color: '#065f46',
        }
      })

      await fetchRosterData(employees.map(e => e.id))
    } catch (error) {
      console.error("Bulk assignment failed:", error)
      toast.error("❌ Failed to apply bulk assignment. Please try again.", {
        duration: 8000,
        position: 'top-center',
      })
    } finally {
      setIsLoading(prev => ({ ...prev, bulk: false }))
    }
  }

  const toggleEmp = (id: ID) => {
    setSelectedEmpIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedEmpIds(new Set())
    } else {
      setSelectedEmpIds(new Set(employees.map(e => e.id)))
    }
    setSelectAll(!selectAll)
  }

  // ==================== RENDER ====================
  if (isLoading.initial) {
    return (
      <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full max-w-[95vw] mx-auto px-4 overflow-hidden">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-600 mt-1">
            {isServiceProvider ? (
              `👨‍💼 Manager: ${user?.username || "Unknown"} - Role: ${userRole}`
            ) : isSuperAdmin ? (
              `👑 Super Admin: ${user?.username || "Unknown"}`
            ) : (
              "Manage employee work schedules, shifts, and assignments"
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRosterData(employees.map(e => e.id))}
            disabled={isLoading.roster || employees.length === 0}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading.roster ? 'animate-spin' : ''}`} />
            {isLoading.roster ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </div>
      </div>

      {/* From Date and To Date Display */}
      <div className="flex items-center gap-4 p-4 bg-[#eef2ff]/40 rounded-lg border border-[#d1d5db]">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-600" />
          <span className="font-medium">From Date:</span>
          <span className="text-gray-700">{formatDateCustom(fromDate)}</span>
        </div>
        <div className="h-4 w-px bg-gray-300"></div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-600" />
          <span className="font-medium">To Date:</span>
          <span className="text-gray-700">{formatDateCustom(toDate)}</span>
        </div>
        <div className="h-4 w-px bg-gray-300"></div>
        <div className="flex items-center gap-2">
          <span className="font-medium">Total Days:</span>
          <Badge variant="outline" className="px-3 py-1">
            {dates.length} days
          </Badge>
        </div>
        {userRole && (
          <>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Role:</span>
              <Badge className={`px-3 py-1 ${userRole === "SUPERADMIN" ? "bg-purple-100 text-purple-700 border-purple-300" :
                userRole === "SERVICE_PROVIDER" ? "bg-blue-100 text-blue-700 border-blue-300" :
                  "bg-gray-100 text-gray-700 border-gray-300"
                }`}>
                {userRole}
              </Badge>
            </div>
          </>
        )}
      </div>

      {/* FILTERS CARD */}
      <Card className="shadow-sm">
        <CardHeader className="bg-[#eef2ff]/40 border-b border-[#d1d5db]">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <CardTitle className="text-lg">Filters & Selection</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {/* Service Provider - SUPERADMIN ONLY */}
            {isSuperAdmin && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Service Provider</Label>
                <select
                  className="w-full border rounded-lg h-10 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={serviceProviderID}
                  onChange={(e) => {
                    const newSP = e.target.value ? Number(e.target.value) : ""
                    setServiceProviderID(newSP)
                    setCompanyID("")
                    setBranchesID("")
                    setDepartmentID("")
                    setDesignationID("")
                  }}
                >
                  <option value="">Select Provider</option>
                  {spList.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.companyName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Company */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Company</Label>
              <select
                className="w-full border rounded-lg h-10 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                value={companyID}
                onChange={(e) => {
                  const newCompanyID = e.target.value ? Number(e.target.value) : ""
                  setCompanyID(newCompanyID)
                  // Reset branch when company changes
                  setBranchesID("")
                }}
                disabled={
                  (isSuperAdmin && !serviceProviderID) ||
                  (isServiceProvider && coList.length === 0)
                }
              >
                <option value="">Select Company</option>
                {coList.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            </div>

            {/* Branch */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Branch</Label>
              <select
                className="w-full border rounded-lg h-10 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                value={branchesID}
                onChange={(e) => setBranchesID(e.target.value ? Number(e.target.value) : "")}
                disabled={
                  (isSuperAdmin && (!serviceProviderID || !companyID)) ||
                  (isServiceProvider && (!companyID || brList.length === 0))
                }
              >
                <option value="">Select Branch</option>
                {brList.map((b) => (
                  <option key={b.id} value={b.id}>{b.branchName}</option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Department *</Label>
              <select
                className="w-full border rounded-lg h-10 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                value={departmentID}
                onChange={(e) => {
                  const newDeptID = e.target.value ? Number(e.target.value) : ""
                  setDepartmentID(newDeptID)
                  setDesignationID("") // Reset designation when department changes
                }}
                disabled={
                  (isSuperAdmin && (!serviceProviderID || !companyID || !branchesID)) ||
                  (isServiceProvider && (!companyID || !branchesID))
                }
                required
              >
                <option value="">Select Department</option>
                {depList.map((d) => (
                  <option key={d.id} value={d.id}>{d.departmentName}</option>
                ))}
              </select>
            </div>

            {/* Designation */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Designation</Label>
              <select
                className="w-full border rounded-lg h-10 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                value={designationID}
                onChange={(e) => setDesignationID(e.target.value ? Number(e.target.value) : "")}
                disabled={
                  (isSuperAdmin && (!serviceProviderID || !companyID || !branchesID)) ||
                  (isServiceProvider && (!companyID || !branchesID)) ||
                  !departmentID // Disable if no department selected
                }
              >
                <option value="">All Designations</option>
                {desList.map((d) => (
                  <option key={d.id} value={d.id}>{d.designation}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label className="text-sm font-medium">From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">To Date</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Button
                className="w-full h-10 bg-[#4f46e5] hover:bg-[#4338ca]"
                onClick={fetchEmployees}
                disabled={!canLoadEmployees || isLoading.employees}
              >
                {isLoading.employees ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Load Employees
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* STATS */}
          <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t">
            <Badge variant="outline" className="px-3 py-1">
              <Users className="w-3 h-3 mr-1" />
              Employees: {employees.length}
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              <Calendar className="w-3 h-3 mr-1" />
              Days: {dates.length}
            </Badge>
            {selectedEmpIds.size > 0 && (
              <Badge className="px-3 py-1 bg-[#eef2ff] text-[#4338ca] border border-[#d1d5db]">
                Selected: {selectedEmpIds.size}
              </Badge>
            )}
            {isLoading.roster && (
              <Badge variant="outline" className="px-3 py-1">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Loading assignments...
              </Badge>
            )}
            {leaveApplications.length > 0 && (
              <Badge variant="outline" className="px-3 py-1 bg-yellow-100 text-yellow-800">
                <AlertCircle className="w-3 h-3 mr-1" />
                Approved Leaves: {leaveApplications.length}
              </Badge>
            )}
            {isServiceProvider && (
              <Badge variant="outline" className="px-3 py-1 bg-[#eef2ff] text-[#4338ca] border-[#d1d5db]">
                <Users className="w-3 h-3 mr-1" />
                Manager Mode
              </Badge>
            )}
            {isServiceProvider && currentUserMapping && (
              <Badge variant="outline" className="px-3 py-1 bg-green-100 text-green-700 border-green-300">
                Companies: {managerCompanies.length}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ROSTER GRID */}
      {employees.length > 0 && (
        <Card>
          <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <CardTitle className="text-base">
              Roster Grid - {selectedCompany?.companyName || "Company"}
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                Total {dates.length} days
                {dates.length > 0 && (
                  <span className="ml-2">
                    ({formatDateForDisplay(dates[0])} → {formatDateForDisplay(dates[dates.length - 1])})
                  </span>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="w-full overflow-x-auto border rounded-md">
              <div className="min-w-max">
                <Table>
                  <TableHeader className="sticky top-0 z-20 bg-white">
                    <TableRow>
                      <TableHead className="w-[50px] sticky left-0 bg-white z-30 border-r shadow-sm">
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded"
                        />
                      </TableHead>
                      <TableHead className="min-w-[200px] sticky left-[50px] bg-white z-30 border-r shadow-sm">
                        Employee
                      </TableHead>
                      {dates.map((d) => (
                        <TableHead key={d} className="min-w-[120px] text-center px-1">
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-medium truncate">
                              {formatDateForTable(d)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatWeekday(d)}
                            </span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {employees.map((emp) => {
                      const checked = selectedEmpIds.has(emp.id)
                      return (
                        <TableRow key={emp.id} className="hover:bg-[#eef2ff]/40">
                          <TableCell className="sticky left-0 bg-white z-20 border-r shadow-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleEmp(emp.id)}
                              className="h-4 w-4 rounded"
                            />
                          </TableCell>

                          <TableCell className="sticky left-[50px] bg-white z-20 border-r shadow-sm">
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-900 truncate">
                                {empName(emp)}
                              </span>
                              <span className="text-xs text-gray-600 truncate">
                                ID: {emp.employeeID || emp.id}
                              </span>
                            </div>
                          </TableCell>

                          {dates.map((d) => {
                            const cellData = getCellDisplay(emp.id, d)
                            const day = getDayForDate(emp.id, d)
                            const isDeleting = deletingDays.has(day?.id || 0)

                            return (
                              <TableCell key={`${emp.id}-${d}`} className="text-center p-1">
                                <div className={`h-14 min-h-[56px] w-[84px] border rounded-md flex flex-col items-center justify-center relative group ${cellData.color} hover:shadow-sm transition-shadow`}>
                                  {cellData.hasApprovedLeave ? (
                                    <>
                                      <div className="flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3 text-yellow-600" />
                                        <span className="text-xs font-medium text-yellow-700 truncate max-w-[60px]">
                                          {cellData.text}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-yellow-600 mt-0.5">
                                        Approved
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      {cellData.icon && (
                                        <span className="text-xs mb-0.5">{cellData.icon}</span>
                                      )}
                                      <span className={`text-xs font-medium truncate max-w-[70px] ${cellData.text.length > 8 ? 'text-[10px]' : ''}`}>
                                        {cellData.text}
                                      </span>
                                      {day?.dayType === "WORK" && day?.workShift?.shiftCode && (
                                        <span className="text-[10px] text-gray-600 mt-0.5 truncate max-w-[70px]">
                                          {day.workShift.shiftCode}
                                        </span>
                                      )}
                                      {cellData.rosterDayId && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeleteAssignment(cellData.rosterDayId!, emp.id)
                                          }}
                                          disabled={isDeleting}
                                          className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                          title="Remove assignment"
                                        >
                                          {isDeleting ? (
                                            <RefreshCw className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <Trash2 className="w-3 h-3" />
                                          )}
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* BULK ASSIGNMENT */}
      {employees.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Bulk Assignment</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Apply assignments to selected employees for a date range
            </p>
          </CardHeader>

          <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t">
            <Badge variant="outline" className="px-3 py-1">
              Selected Employees: {selectedEmpIds.size}
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              Shifts Available: {shiftOptions.length}
            </Badge>
            <Badge variant="outline" className="px-3 py-1 bg-red-100 text-red-800 border-red-300">
              <AlertCircle className="w-3 h-3 mr-1" />
              No overrides allowed
            </Badge>

            {selectedEmpIds.size === 0 && (
              <div className="text-sm text-amber-600 flex items-center">
                ⓘ Select employees from the table to apply bulk assignment
              </div>
            )}
          </div>

          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* From Date with Calendar Popover */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">From Date</Label>
                <Popover open={openFromCalendar} onOpenChange={setOpenFromCalendar}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {bulkFrom ? format(bulkFrom, "dd/MM/yy") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={bulkFrom}
                      onSelect={(date) => {
                        if (date) {
                          setBulkFrom(date)
                          setOpenFromCalendar(false)
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* To Date with Calendar Popover */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">To Date</Label>
                <Popover open={openToCalendar} onOpenChange={setOpenToCalendar}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !bulkTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {bulkTo ? format(bulkTo, "dd/MM/yy") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={bulkTo}
                      onSelect={(date) => {
                        if (date) {
                          setBulkTo(date)
                          setOpenToCalendar(false)
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Assignment Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Assignment Type</Label>
                <select
                  className="w-full border rounded-lg h-10 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={bulkMode}
                  onChange={(e) => setBulkMode(e.target.value as any)}
                >
                  <option value="SHIFT">Shift</option>
                  <option value="WEEKLY_OFF">Weekly Off</option>
                </select>
              </div>

              {/* Assignment Value */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {bulkMode === "SHIFT" ? "Select Shift" : bulkMode === "LEAVE" ? "Leave Type" : "Value"}
                </Label>
                {bulkMode === "SHIFT" ? (
                  <select
                    className="w-full border rounded-lg h-10 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={bulkShiftID}
                    onChange={(e) => setBulkShiftID(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">Select Shift</option>
                    {shiftOptions.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                ) : bulkMode === "LEAVE" ? (
                  <select
                    className="w-full border rounded-lg h-10 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={bulkLeaveType}
                    onChange={(e) => setBulkLeaveType(e.target.value as RosterLeaveType)}
                  >
                    <option value="CASUAL">Casual Leave (CL)</option>
                    <option value="SICK">Sick Leave (SL)</option>
                    <option value="PL">Privilege Leave (PL)</option>
                    <option value="COMP_OFF">Comp Off Leave</option>
                    <option value="LOP">Loss of Pay (LOP)</option>
                  </select>
                ) : (
                  <div className="h-10 px-3 border rounded-lg flex items-center bg-gray-50 text-gray-600">
                    Weekly Off
                  </div>
                )}
              </div>

              {/* Apply Button */}
              <div className="space-y-2">
                <Label className="text-sm font-medium opacity-0">Apply</Label>
                <Button
                  className="w-full h-10 "
                  onClick={handleBulkApply}
                  disabled={isLoading.bulk || selectedEmpIds.size === 0}
                >
                  {isLoading.bulk ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Apply
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}