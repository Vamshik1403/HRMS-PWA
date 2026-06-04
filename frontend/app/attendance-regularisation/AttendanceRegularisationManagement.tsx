"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { FormDrawer } from "../components/ui/form-drawer"
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
import { Plus, Search, Edit, Trash2, Clock, Check, X, ArrowLeft } from "lucide-react"
import { SearchSuggestInput } from "../components/SearchSuggestInput"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";
import { formatDevicePunchForDisplay } from "../utils/devicePunchTime";

interface AttendanceRegularisation {
  id: string
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  manageEmployeeID?: number
  serviceProvider?: string
  companyName?: string
  branchName?: string
  employeeId?: string
  employeeName?: string
  attendanceDate: string
  day?: string
  checkInTime: string
  checkOutTime: string
  actualStatus?: string
  requestedStatus?: string
  reason?: string
  remarks?: string
  status?: "Pending" | "Approved" | "Rejected"
  createdAt: string
}

interface SelectedItem {
  display: string
  value: number
  item: any
}

// Backend URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend"

export function AttendanceRegularisationManagement() {
  const [regularisations, setRegularisations] = useState<AttendanceRegularisation[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRegularisation, setEditingRegularisation] = useState<AttendanceRegularisation | null>(null)
  const [formData, setFormData] = useState({
    serviceProvider: "",
    companyName: "",
    branchName: "",
    employeeName: "",
    attendanceDate: "",
    checkInTime: "",
    day: "",
    checkOutTime: "",
    actualStatus: "",
    requestedStatus: "",
    reason: "",
    remarks: "",
    serviceProviderID: undefined as number | undefined,
    companyID: undefined as number | undefined,
    branchesID: undefined as number | undefined,
    manageEmployeeID: undefined as number | undefined,
    overtimeApplicable: false,
    otMealApply: false,
    otMealMinutes: "" as string | number,
    otBreakMinutes: "" as string | number,
  })

  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null)
  const [managerData, setManagerData] = useState<any>(null)
  const [empCreds, setEmpCreds] = useState<any>(null)
  const [holidays, setHolidays] = useState<any[]>([])
  const [isFetchingStatus, setIsFetchingStatus] = useState(false)
  
  const user = useCurrentUser()
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN"

  // Load user data based on role
  useEffect(() => {
    if (!user) return;

    const loadUserData = async () => {
      try {
        // --- MANAGER ---
        if (user.role === "SERVICE_PROVIDER") {
          const usersRes = await fetch(`${BACKEND_URL}/users`);
          const users = await usersRes.json();
          const me = users.find((u: any) => u.username === user.username);
          setManagerData(me || null);
        }

        // --- EMPLOYEE ---
        if (user.role === "EMPLOYEE") {
          const credsRes = await fetch(`${BACKEND_URL}/manage-emp/credentials/all`);
          const creds = await credsRes.json();
          const me = creds.find((u: any) => u.username === user.username);
          setEmpCreds(me || null);
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };

    loadUserData();
  }, [user]);

  // Fetch holidays
  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/manage-holiday`, { cache: "no-store" });
        const data = await res.json();
        setHolidays(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching holidays:", error);
        setHolidays([]);
      }
    };
    loadHolidays();
  }, []);

  // API functions for search and suggest
  const fetchServiceProviders = async (query: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/service-provider`, {
        cache: "no-store",
      })
      const data = await res.json()
      const q = query.toLowerCase()
      return Array.isArray(data)
        ? data.filter((item: any) =>
          (item?.companyName || "").toLowerCase().includes(q)
        )
        : []
    } catch (error) {
      console.error("Error fetching service providers:", error)
      return []
    }
  }

  const fetchCompanies = async (query: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/company`, { cache: "no-store" })
      const data = await res.json()
      const q = query.toLowerCase()
      return Array.isArray(data)
        ? data.filter((item: any) =>
          (item?.companyName || "").toLowerCase().includes(q)
        )
        : []
    } catch (error) {
      console.error("Error fetching companies:", error)
      return []
    }
  }

  // Updated fetchBranches with role-based filtering
  const fetchBranches = async (query: string = "") => {
    try {
      // SUPERADMIN: filter by sidebar context companyID
      if (user?.role === "SUPERADMIN") {
        const ctx = getSidebarContext();
        const companyID = formData.companyID ?? ctx?.companyID;
        if (!companyID) return [];
        const res = await fetch(`${BACKEND_URL}/branches`, { cache: "no-store" })
        const data = await res.json()
        const q = query.toLowerCase()
        const filtered = data.filter((item: any) => item.companyID === companyID)
        return q ? filtered.filter((item: any) => (item?.branchName || "").toLowerCase().includes(q)) : filtered
      }

      const res = await fetch(`${BACKEND_URL}/branches`, { cache: "no-store" })
      const data = await res.json()
      const q = query.toLowerCase()

      // SERVICE_PROVIDER → filter by company from sidebar context
      if (user?.role === "SERVICE_PROVIDER") {
        const ctx = getSidebarContext();
        const companyID = managerData?.companyID ?? ctx?.companyID ?? user?.companyID;
        const spID = managerData?.serviceProviderID ?? ctx?.serviceProviderID ?? user?.serviceProviderID;
        let filteredByCompany;
        if (companyID) {
          filteredByCompany = data.filter((item: any) => item.companyID === companyID)
        } else if (spID) {
          filteredByCompany = data.filter((item: any) => item.serviceProviderID === spID)
        } else {
          filteredByCompany = []
        }
        return q ? filteredByCompany.filter((item: any) => (item?.branchName || "").toLowerCase().includes(q)) : filteredByCompany
      }

      // EMPLOYEE → only branches of their company
      if (user?.role === "EMPLOYEE" && empCreds) {
        const filteredByCompany = data.filter((item: any) => item.companyID === empCreds.companyID)
        return q ? filteredByCompany.filter((item: any) => (item?.branchName || "").toLowerCase().includes(q)) : filteredByCompany
      }

      // COMPANY_ADMIN / BRANCH_ADMIN → filter by sidebar context or user companyID
      {
        const ctx = getSidebarContext();
        const companyID = formData.companyID ?? ctx?.companyID ?? user?.companyID;
        if (companyID) {
          const filteredByCompany = data.filter(
            (item: any) => item.companyID === companyID &&
            (user?.role !== "BRANCH_ADMIN" || Number(item.id) === Number(user?.branchesID))
          )
          return q ? filteredByCompany.filter((item: any) => (item?.branchName || "").toLowerCase().includes(q)) : filteredByCompany
        }
      }

      return []
    } catch (error) {
      console.error("Error fetching branches:", error)
      return []
    }
  }

  // Updated fetchEmployees with role-based filtering
  const fetchEmployees = async (query: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/manage-emp`, { cache: "no-store" })
      const data = await res.json()
      const q = query.toLowerCase()

      const mapDisplay = (item: any) => ({
        ...item,
        displayName: `${item?.employeeFirstName || ""} ${item?.employeeLastName || ""}`.trim() + (item?.employeeID ? ` (${item.employeeID})` : "")
      })
      const applySearch = (arr: any[]) => arr.filter((item: any) => {
        const fullName = `${item?.employeeFirstName || ""} ${item?.employeeLastName || ""}`.trim().toLowerCase()
        const employeeId = (item?.employeeID || "").toLowerCase()
        return fullName.includes(q) || employeeId.includes(q)
      }).map(mapDisplay)

      // SUPERADMIN → filter by sidebar context company + selected branch
      if (user?.role === "SUPERADMIN") {
        const ctx = getSidebarContext();
        const companyID = formData.companyID ?? ctx?.companyID;
        if (!companyID || !formData.branchesID) return []
        return applySearch(data.filter((item: any) => item.companyID === companyID && item.branchesID === formData.branchesID))
      }

      // SERVICE_PROVIDER → filter by company + selected branch
      if (user?.role === "SERVICE_PROVIDER") {
        if (!formData.branchesID) return []
        const ctx = getSidebarContext();
        const companyID = managerData?.companyID ?? ctx?.companyID ?? user?.companyID;
        const spID = managerData?.serviceProviderID ?? ctx?.serviceProviderID ?? user?.serviceProviderID;
        let filtered;
        if (companyID) {
          filtered = data.filter((item: any) => item.companyID === companyID && item.branchesID === formData.branchesID)
        } else if (spID) {
          filtered = data.filter((item: any) => item.serviceProviderID === spID && item.branchesID === formData.branchesID)
        } else {
          filtered = []
        }
        return applySearch(filtered)
      }

      // EMPLOYEE → only themselves
      if (user?.role === "EMPLOYEE" && empCreds) {
        return applySearch(data.filter((item: any) => item.id === empCreds.manageEmployeeID))
      }

      // COMPANY_ADMIN / BRANCH_ADMIN → filter by sidebar context company + selected branch
      {
        const ctx = getSidebarContext();
        const companyID = formData.companyID ?? ctx?.companyID ?? user?.companyID;
        if (companyID && formData.branchesID) {
          return applySearch(data.filter((item: any) => item.companyID === companyID && item.branchesID === formData.branchesID))
        }
      }

      return []
    } catch (error) {
      console.error("Error fetching employees:", error)
      return []
    }
  }

  // Load attendance regularisations on component mount
  useEffect(() => {
    if (user) loadAttendanceRegularisations()
  }, [user, managerData, empCreds])

  useEffect(() => {
    const handler = () => { if (user) loadAttendanceRegularisations(); };
    window.addEventListener("sidebar-context-changed", handler);
    window.addEventListener("app-data-refresh", handler);
    return () => {
      window.removeEventListener("sidebar-context-changed", handler);
      window.removeEventListener("app-data-refresh", handler);
    };
  }, [user, managerData, empCreds]);

  const loadAttendanceRegularisations = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/emp-attendance-regularise`, {
        cache: "no-store",
      })
      const data = await res.json()
      const regularisationsData = (Array.isArray(data) ? data : []).map(
        (regularisation: any) => ({
          id: regularisation.id.toString(),
          serviceProviderID: regularisation.serviceProviderID,
          companyID: regularisation.companyID,
          branchesID: regularisation.branchesID,
          manageEmployeeID: regularisation.manageEmployeeID,
          serviceProvider: regularisation.serviceProvider?.companyName || "",
          companyName: regularisation.company?.companyName || "",
          branchName: regularisation.branches?.branchName || "",
          employeeId: regularisation.manageEmployee?.employeeID || "",
          day: regularisation.day || "",
          employeeName: regularisation.manageEmployee ?
            `${regularisation.manageEmployee.employeeFirstName || ""} ${regularisation.manageEmployee.employeeLastName || ""}`.trim() : "",
          attendanceDate: regularisation.attendanceDate
            ? new Date(regularisation.attendanceDate).toISOString().split("T")[0]
            : "",
          checkInTime: regularisation.checkInTime
            ? new Date(regularisation.checkInTime).toTimeString().split(' ')[0]
            : "",
          checkOutTime: regularisation.checkOutTime
            ? new Date(regularisation.checkOutTime).toTimeString().split(' ')[0]
            : "",
          actualStatus: regularisation.actualStatus || "",
          requestedStatus: regularisation.requestedStatus || "",
          reason: regularisation.reason || "",
          remarks: regularisation.remarks,
          status: (regularisation.status || "Pending") as "Pending" | "Approved" | "Rejected",
          createdAt: regularisation.createdAt
            ? new Date(regularisation.createdAt).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
        })
      )

      // Role-based filtering
      if (!user) {
        setRegularisations([])
        return
      }

      if (user.role === "SUPERADMIN") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          setRegularisations(regularisationsData.filter((r: any) => r.companyID === ctx.companyID));
        } else {
          setRegularisations(regularisationsData);
        }
        return
      }

      if (user.role === "SERVICE_PROVIDER") {
        const ctx = getSidebarContext()
        if (ctx?.companyID) {
          setRegularisations(regularisationsData.filter((a: any) => a.companyID === ctx.companyID))
          return
        }
        const usersData = await fetch(`${BACKEND_URL}/users`).then((r) => r.json())
        const currentUser = usersData.find((u: any) => u.username === user.username)
        if (currentUser?.serviceProviderID) {
          setRegularisations(regularisationsData.filter((a: any) => a.serviceProviderID === currentUser.serviceProviderID))
          return
        }
      }

      // COMPANY_ADMIN / BRANCH_ADMIN → filter by company
      if (user.role === "COMPANY_ADMIN" || user.role === "BRANCH_ADMIN") {
        const ctx = getSidebarContext()
        const companyID = ctx?.companyID ?? user?.companyID
        if (companyID) {
          setRegularisations(regularisationsData.filter((a: any) => a.companyID === companyID))
        } else {
          setRegularisations([])
        }
        return
      }

      // For employees or others → get from /manage-emp/credentials/all
      const creds = await fetch(`${BACKEND_URL}/manage-emp/credentials/all`).then((r) => r.json())
      const emp = creds.find((c: any) => c.username === user.username)
      if (emp) {
        const filtered = regularisationsData.filter(
          (a) => a.companyID === emp.companyID && a.branchesID === emp.branchesID
        )
        setRegularisations(filtered)
      } else {
        setRegularisations([])
      }
    } catch (error) {
      console.error("Error loading attendance regularisations:", error)
    }
  }

  const filteredRegularisations = regularisations.filter(regularisation =>
    (regularisation.serviceProvider || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (regularisation.companyName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (regularisation.branchName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (regularisation.employeeName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (regularisation.employeeId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (regularisation.attendanceDate || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleServiceProviderSelect = (selected: SelectedItem) => {
    setFormData((prev) => ({
      ...prev,
      serviceProvider: selected.display,
      serviceProviderID: selected.value,
    }))
  }

  const handleCompanySelect = (selected: SelectedItem) => {
    setFormData((prev) => ({
      ...prev,
      companyName: selected.display,
      companyID: selected.value,
    }))
  }

  const handleBranchSelect = (selected: SelectedItem) => {
    setFormData((prev) => ({
      ...prev,
      branchName: selected.display,
      branchesID: selected.value,
    }))
  }

  const handleEmployeeSelect = (selected: SelectedItem) => {
    const employee = selected.item
    setSelectedEmployee(employee)
    setFormData((prev) => ({
      ...prev,
      employeeName: selected.display,
      manageEmployeeID: selected.value,
    }))
  }

  const fetchActualStatus = async () => {
    if (!formData.manageEmployeeID || !formData.attendanceDate) {
      toast.error("Please select an employee and attendance date first")
      return
    }
    setIsFetchingStatus(true)
    try {
      const employeeId = formData.manageEmployeeID
      const date = formData.attendanceDate // "YYYY-MM-DD"
      const ctx = getSidebarContext()
      const resolvedCompanyID = formData.companyID ?? managerData?.companyID ?? empCreds?.companyID ?? ctx?.companyID ?? user?.companyID
      const resolvedBranchID = formData.branchesID ?? managerData?.branchesID ?? empCreds?.branchesID ?? user?.branchesID

      // ── Helpers ──────────────────────────────────────────────────────
      const timeToMin = (t: string): number => {
        if (!t) return 0
        const p = t.split(":")
        return (parseInt(p[0]) || 0) * 60 + (parseInt(p[1]) || 0) + (parseInt(p[2]) || 0) / 60
      }

      const parsePunchTime = (pt: string): string | null => {
        const f = formatDevicePunchForDisplay(pt)
        return f?.timeStr ?? null
      }

      const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      const dayOfWeek = WEEKDAYS[new Date(date).getDay()]

      // ── Fetch all data in parallel ────────────────────────────────────
      const [logsRes, empRes, policyRes, holidayRes, leaveRes, regRes, rosterRes] = await Promise.all([
        fetch(`${BACKEND_URL}/process-att-logs?dateFrom=${date}&dateTo=${date}&limit=1000`, { cache: "no-store" }),
        fetch(`${BACKEND_URL}/manage-emp/${employeeId}`, { cache: "no-store" }),
        fetch(`${BACKEND_URL}/attendance-policy`, { cache: "no-store" }),
        fetch(`${BACKEND_URL}/public-holiday`, { cache: "no-store" }),
        fetch(`${BACKEND_URL}/leave-application`, { cache: "no-store" }),
        fetch(`${BACKEND_URL}/emp-attendance-regularise`, { cache: "no-store" }),
        fetch(`${BACKEND_URL}/rosters`, { cache: "no-store" }),
      ])

      const logsRaw = await logsRes.json()
      const allLogs: any[] = Array.isArray(logsRaw) ? logsRaw : (logsRaw?.data ?? [])
      const empLogs = allLogs.filter((l: any) => Number(l.manage_employee_id) === Number(employeeId))
      const punches: string[] = empLogs.map((l: any) => parsePunchTime(l.punch_time)).filter(Boolean).sort() as string[]

      const empData: any = empRes.ok ? await empRes.json() : null
      const allPolicies: any[] = policyRes.ok ? await policyRes.json() : []
      const allHolidays: any[] = holidayRes.ok ? await holidayRes.json() : []
      const allLeaves: any[] = leaveRes.ok ? await leaveRes.json() : []
      const allRegs: any[] = regRes.ok ? await regRes.json() : []
      const allRosters: any[] = rosterRes.ok ? await rosterRes.json() : []

      const policy = Array.isArray(allPolicies)
        ? (allPolicies.find((p: any) => Number(p.companyID) === Number(resolvedCompanyID) && Number(p.branchesID) === Number(resolvedBranchID)) ?? null)
        : null

      // ── Resolve work shift (fetch with workShiftDay) ─────────────────
      let workShift: any = null
      const empShiftEntry = empData?.empWorkShift?.[0]
      const workShiftID = empShiftEntry?.workShiftID ?? empData?.workShiftID
      if (workShiftID) {
        const wsRes = await fetch(`${BACKEND_URL}/work-shift/${workShiftID}`, { cache: "no-store" })
        if (wsRes.ok) workShift = await wsRes.json()
      }

      const isFlexible: boolean = workShift?.isFlexible || false
      const isRotating: boolean = workShift?.isRotating || false
      const shiftDay: any = workShift?.workShiftDay?.find((d: any) => d.weekDay === dayOfWeek && d.shiftType === "WORK") ?? null

      // ── Check existing approved regularization ───────────────────────
      const existingReg = allRegs.find((r: any) =>
        Number(r.manageEmployeeID) === Number(employeeId) &&
        r.status === "Approved" &&
        new Date(r.attendanceDate).toISOString().split("T")[0] === date
      )
      if (existingReg) {
        const checkIn = existingReg.checkInTime ? new Date(existingReg.checkInTime).toTimeString().split(" ")[0] : ""
        const checkOut = existingReg.checkOutTime ? new Date(existingReg.checkOutTime).toTimeString().split(" ")[0] : ""
        setFormData(prev => ({
          ...prev,
          actualStatus: `${existingReg.requestedStatus || existingReg.actualStatus} (Regularized)`,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          day: dayOfWeek,
        }))
        toast.info("This date has already been regularized")
        return
      }

      const checkIn = punches.length > 0 ? punches[0] : ""
      const checkOut = punches.length >= 2 ? punches[punches.length - 1] : ""

      const applyStatus = (status: string) => {
        setFormData(prev => ({ ...prev, actualStatus: status, checkInTime: checkIn, checkOutTime: checkOut, day: dayOfWeek }))
        toast.success(`Status: ${status}`)
      }

      // ── Week-off helper ───────────────────────────────────────────────
      const isWeekOff = (): boolean => {
        if (!workShift) return false
        if (isRotating) {
          const roster = allRosters.find((r: any) => Number(r.employeeID) === Number(employeeId))
          const rDay = roster?.days?.find((d: any) => new Date(d.workDate).toISOString().split("T")[0] === date)
          return rDay?.dayType === "WEEKLY_OFF"
        }
        return shiftDay?.weeklyOff || false
      }

      // ── Public-holiday helper ─────────────────────────────────────────
      const isPublicHoliday = (): boolean =>
        allHolidays.some((h: any) => {
          if (Number(h.companyID) !== Number(resolvedCompanyID) || Number(h.branchesID) !== Number(resolvedBranchID)) return false
          const hs = new Date(h.startDate).toISOString().split("T")[0]
          const he = new Date(h.endDate).toISOString().split("T")[0]
          return date >= hs && date <= he
        })

      // ── Approved-leave helper ─────────────────────────────────────────
      const approvedLeave = (): any =>
        allLeaves.find((l: any) =>
          Number(l.manageEmployeeID) === Number(employeeId) &&
          l.status === "Approved" &&
          date >= new Date(l.fromDate).toISOString().split("T")[0] &&
          date <= new Date(l.toDate).toISOString().split("T")[0]
        )

      // ── calculateWorkedMinutes – exact mirror of attendance reports ───
      const calculateWorkedMinutes = (p: string[]): number => {
        if (p.length < 2) return 0
        let st = timeToMin(p[0])
        let et = timeToMin(p[p.length - 1])
        if (!isFlexible && policy && shiftDay) {
          const ss = timeToMin(shiftDay.startTime)
          const se = timeToMin(shiftDay.endTime)
          if (st < ss - (policy.checkin_begin_before_min || 0)) st = ss
          if (!policy.overtimeApplicable) {
            const maxEnd = se + (policy.checkout_end_after_min || 0)
            if (et > maxEnd) et = se
          }
        }
        let worked = et - st
        if (worked < 0) worked += 24 * 60
        if (shiftDay?.breakStart && shiftDay?.breakEnd) {
          const bs = timeToMin(shiftDay.breakStart)
          const be = timeToMin(shiftDay.breakEnd)
          if (bs > 0 && be > 0 && st <= bs && et >= be) worked -= (be - bs)
        }
        if (!isFlexible && policy) {
          worked -= (policy.trimPreshiftMin || 0)
          worked -= (policy.trimPostshiftMin || 0)
        }
        return Math.max(0, worked)
      }

      // ── 0 punches ────────────────────────────────────────────────────
      if (punches.length === 0) {
        if (isWeekOff()) return applyStatus("WEEK_OFF")
        if (isPublicHoliday()) return applyStatus("PUBLIC_HOLIDAY")
        const leave = approvedLeave()
        if (leave) return applyStatus(leave.appliedLeaveType)
        return applyStatus("ABSENT")
      }

      // ── 1+ punch: check special days first ───────────────────────────
      if (isWeekOff()) return applyStatus("WEEK_OFF")
      if (isPublicHoliday()) return applyStatus("PUBLIC_HOLIDAY")
      const leave = approvedLeave()
      if (leave) return applyStatus(leave.appliedLeaveType)

      // ── 1 punch: single-punch policy ─────────────────────────────────
      if (punches.length === 1) {
        return applyStatus(policy?.markAs === "Absent" ? "ABSENT" : "HALFDAY")
      }

      // ── 2+ punches: full policy calculation ──────────────────────────
      if (shiftDay && policy) {
        const firstMin = timeToMin(punches[0])
        const shiftStartMin = timeToMin(shiftDay.startTime)
        const maxLateWindow = policy.max_late_check_in_time || 0

        if (!isFlexible && firstMin > shiftStartMin + maxLateWindow) {
          const markAs = policy.maxLateCheckinMarkAs || "Absent"
          return applyStatus(markAs === "Absent" ? "ABSENT" : "HALFDAY")
        }

        const workedMinutes = calculateWorkedMinutes(punches)
        const totalShiftMinutes = shiftDay.totalMinutes || 480
        const halfDayMin = policy.min_work_hours_half_day_min || 0
        const graceTime = policy.checkin_grace_time_min || 0
        const isLate = !isFlexible && firstMin > shiftStartMin + graceTime && firstMin <= shiftStartMin + maxLateWindow

        if (workedMinutes < halfDayMin) return applyStatus("ABSENT")
        if (workedMinutes < totalShiftMinutes) return applyStatus("HALFDAY")
        if (isLate) return applyStatus("LATE_MARK")
        return applyStatus("FULLDAY")
      }

      // ── Fallback: no shift/policy data ───────────────────────────────
      return applyStatus(punches.length >= 2 ? "FULLDAY" : "HALFDAY")
    } catch (error) {
      console.error("Error fetching attendance status:", error)
      toast.error("Failed to fetch attendance status")
    } finally {
      setIsFetchingStatus(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Auto-populate serviceProviderID and companyID for MANAGER/EMPLOYEE
    const serviceProviderID = user?.role === "SUPERADMIN" 
      ? formData.serviceProviderID 
      : managerData?.serviceProviderID || empCreds?.serviceProviderID || formData.serviceProviderID || user?.serviceProviderID;

    const companyID = user?.role === "SUPERADMIN" 
      ? formData.companyID 
      : managerData?.companyID || empCreds?.companyID || formData.companyID || user?.companyID;

    // Ensure we have the required IDs
    if (!companyID || !formData.branchesID || !formData.manageEmployeeID) {
      toast.error("Please make sure all required fields are selected: Branch and Employee");
      return;
    }

    try {
      const attendanceRegularisationData = {
        serviceProviderID: serviceProviderID,
        companyID: companyID,
        branchesID: formData.branchesID,
        manageEmployeeID: formData.manageEmployeeID,
        attendanceDate: formData.attendanceDate ? new Date(formData.attendanceDate) : null,
        day: formData.day,
        checkInTime: formData.checkInTime ? new Date(`2000-01-01T${formData.checkInTime}`) : null,
        checkOutTime: formData.checkOutTime ? new Date(`2000-01-01T${formData.checkOutTime}`) : null,
        actualStatus: formData.actualStatus ? formData.actualStatus.replace(" (Regularized)", "") : null,
        requestedStatus: formData.requestedStatus || null,
        reason: formData.reason || null,
        remarks: formData.remarks,
        overtimeApplicable: false,
        otMealApply: false,
        otMealMinutes: null,
        otBreakMinutes: null,
      }

      const url = editingRegularisation
        ? `${BACKEND_URL}/emp-attendance-regularise/${editingRegularisation.id}`
        : `${BACKEND_URL}/emp-attendance-regularise`
      const method = editingRegularisation ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attendanceRegularisationData),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const message = errorData?.message || `Failed to save attendance regularisation: ${res.status}`
        toast.error(message)
        return
      }

      await loadAttendanceRegularisations()
      resetForm()
      setIsDialogOpen(false)
      toast.success("Attendance regularisation saved successfully")
    } catch (error) {
      console.error("Error saving attendance regularisation:", error)
      toast.error((error as any)?.message || "Something went wrong")
    }
  }

  const resetForm = () => {
    const ctx = getSidebarContext();
    setFormData({
      serviceProvider: ctx?.serviceProviderName ?? "",
      companyName: ctx?.companyName ?? "",
      branchName: "",
      employeeName: "",
      attendanceDate: "",
      checkInTime: "",
      checkOutTime: "",
      actualStatus: "",
      requestedStatus: "",
      reason: "",
      remarks: "",
      day: "",
      serviceProviderID: ctx?.serviceProviderID ?? undefined,
      companyID: ctx?.companyID ?? undefined,
      branchesID: undefined,
      manageEmployeeID: undefined,
      overtimeApplicable: false,
      otMealApply: false,
      otMealMinutes: "",
      otBreakMinutes: "",
    })
    setSelectedEmployee(null)
    setEditingRegularisation(null)
  }

  const handleEdit = (regularisation: AttendanceRegularisation) => {
    setFormData({
      serviceProvider: regularisation.serviceProvider || "",
      companyName: regularisation.companyName || "",
      branchName: regularisation.branchName || "",
      employeeName: regularisation.employeeName || "",
      attendanceDate: regularisation.attendanceDate,
      checkInTime: regularisation.checkInTime,
      checkOutTime: regularisation.checkOutTime,
      actualStatus: regularisation.actualStatus || "",
      requestedStatus: regularisation.requestedStatus || "",
      reason: regularisation.reason || "",
      remarks: regularisation.remarks || "",
      day: regularisation.day || "",
      serviceProviderID: regularisation.serviceProviderID,
      companyID: regularisation.companyID,
      branchesID: regularisation.branchesID,
      manageEmployeeID: regularisation.manageEmployeeID,
      overtimeApplicable: (regularisation as any).overtimeApplicable || false,
      otMealApply: (regularisation as any).otMealApply || false,
      otMealMinutes: (regularisation as any).otMealMinutes || "",
      otBreakMinutes: (regularisation as any).otBreakMinutes || "",
    })
    setSelectedEmployee({
      employeeID: regularisation.employeeId,
      employeeFirstName: regularisation.employeeName?.split(' ')[0] || "",
      employeeLastName: regularisation.employeeName?.split(' ').slice(1).join(' ') || "",
    })
    setEditingRegularisation(regularisation)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/emp-attendance-regularise/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        throw new Error(`Failed to delete attendance regularisation: ${res.status}`)
      }
      await loadAttendanceRegularisations()
      toast.success("Record deleted successfully")
    } catch (error) {
      console.error("Error deleting attendance regularisation:", error)
      toast.error((error as any)?.message || "Something went wrong")
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/emp-attendance-regularise/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Approved" }),
      })
      if (!res.ok) {
        throw new Error(`Failed to approve attendance regularisation: ${res.status}`)
      }
      await loadAttendanceRegularisations()
      toast.success("Approved successfully")
    } catch (error) {
      console.error("Error approving attendance regularisation:", error)
      toast.error((error as any)?.message || "Something went wrong")
    }
  }

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/emp-attendance-regularise/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Rejected" }),
      })
      if (!res.ok) {
        throw new Error(`Failed to reject attendance regularisation: ${res.status}`)
      }
      await loadAttendanceRegularisations()
      toast.success("Rejected successfully")
    } catch (error) {
      console.error("Error rejecting attendance regularisation:", error)
      toast.error((error as any)?.message || "Something went wrong")
    }
  }

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage attendance corrections and time adjustments</p>
        </div>
        <div className="flex items-center gap-3">
          {!isDialogOpen && (
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="flex-shrink-0 text-sm px-3 py-2">
              <Plus className="w-4 h-4 mr-1" />
              Submit Regularisation
            </Button>
          )}
        </div>
      </div>

      <FormDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen} title={editingRegularisation ? "Edit Attendance Regularisation" : "Submit Attendance Regularisation"} description={editingRegularisation ? "Update the attendance regularisation information below." : "Fill in the details to submit a new attendance regularisation."}>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Organization Selection */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Organization Selection</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Service Provider - auto-filled from sidebar */}
                    {false && (
                      <SearchSuggestInput
                        label="Service Provider"
                        placeholder="Select Service Provider"
                        value={formData.serviceProvider}
                        onChange={(value) =>
                          setFormData((prev) => ({ ...prev, serviceProvider: value }))
                        }
                        onSelect={handleServiceProviderSelect}
                        fetchData={fetchServiceProviders}
                        displayField="companyName"
                        valueField="id"
                        required
                      />
                    )}
                    
                    {/* Company Name - auto-filled from sidebar */}
                    {false && (
                      <SearchSuggestInput
                        label="Company Name"
                        placeholder="Select Company"
                        value={formData.companyName}
                        onChange={(value) =>
                          setFormData((prev) => ({ ...prev, companyName: value }))
                        }
                        onSelect={handleCompanySelect}
                        fetchData={fetchCompanies}
                        displayField="companyName"
                        valueField="id"
                        required
                      />
                    )}

                    {/* Branch Name - Always visible */}
                    <div style={{ 
                      gridColumn: user?.role !== "SUPERADMIN" ? "span 3" : "span 1"
                    }}>
                      <SearchSuggestInput
                        label="Branch Name"
                        placeholder="Start typing branch name..."
                        value={formData.branchName}
                        onChange={(value) =>
                          setFormData((prev) => ({ ...prev, branchName: value }))
                        }
                        onSelect={handleBranchSelect}
                        fetchData={fetchBranches}
                        displayField="branchName"
                        valueField="id"
                        required
                      />
                      {(user?.role === "SERVICE_PROVIDER" || user?.role === "EMPLOYEE") && (
                        <p className="text-xs text-gray-500 mt-1">
                          You can only select from your assigned branches
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Employee Selection */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Employee Selection</h3>
                  <div className="space-y-2">
                    <SearchSuggestInput
                      label="Employee Name"
                      placeholder="Select Employee"
                      value={formData.employeeName}
                      onChange={(value) =>
                        setFormData((prev) => ({ ...prev, employeeName: value }))
                      }
                      onSelect={handleEmployeeSelect}
                      fetchData={fetchEmployees}
                      displayField="displayName"
                      valueField="id"
                      required
                    />
                    <p className="text-xs text-gray-500">Show FirstName + LastName + Emp ID</p>
                    {(user?.role === "SERVICE_PROVIDER" || user?.role === "EMPLOYEE") && (
                      <p className="text-xs text-gray-500">
                        {user?.role === "SERVICE_PROVIDER" 
                          ? "You can only select employees from your assigned branch" 
                          : "You can only select yourself"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Attendance Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Attendance Details</h3>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="attendanceDate">Attendance Date *</Label>
                      <Input
                        id="attendanceDate"
                        type="date"
                        value={formData.attendanceDate}
                        max={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setFormData(prev => ({ ...prev, attendanceDate: e.target.value, actualStatus: "" }))}
                        className="w-full"
                        required
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={fetchActualStatus}
                      disabled={isFetchingStatus || !formData.manageEmployeeID || !formData.attendanceDate}
                      className="flex-shrink-0"
                    >
                      {isFetchingStatus ? (
                        <Clock className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4 mr-1" />
                      )}
                      Fetch
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">Select employee and date, then click Fetch to get system-detected status</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="actualStatus">Actual Status (System Detected)</Label>
                      <Input
                        id="actualStatus"
                        type="text"
                        value={formData.actualStatus}
                        readOnly
                        className="w-full bg-gray-100 cursor-not-allowed font-medium"
                        placeholder="Click Fetch to detect status"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="requestedStatus">Request To Change As *</Label>
                      <select
                        id="requestedStatus"
                        value={formData.requestedStatus}
                        onChange={(e) => setFormData(prev => ({ ...prev, requestedStatus: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                        required
                      >
                        <option value="">Select Requested Status</option>
                        <option value="PRESENT">Present</option>
                        <option value="SL">Late Mark</option>
                        <option value="SL">Half Day</option>
                        <option value="SL">Sick Leave (SL)</option>
                        <option value="CL">Casual Leave (CL)</option>
                        <option value="PL">Privilege Leave (PL)</option>
                        <option value="LOP">Loss of Pay (LOP)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason *</Label>
                    <textarea
                      id="reason"
                      value={formData.reason}
                      onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Explain the reason for attendance regularisation"
                      className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0] min-h-[80px] resize-y"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="remarks">Remarks</Label>
                    <Input
                      id="remarks"
                      type="text"
                      value={formData.remarks}
                      onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                      placeholder="Additional remarks (optional)"
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="">
                    {editingRegularisation ? "Update Regularisation" : "Submit Regularisation"}
                  </Button>
                </div>
              </form>
      </FormDrawer>

      {!isDialogOpen && (<>
      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search attendance regularisations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredRegularisations.length} regularisations
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Regularisations Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:clock-edit" className="w-5 h-5" />
            Attendance Regularisations List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Branch Name</TableHead>
                  <TableHead className="w-[70px]">Employee ID</TableHead>
                  <TableHead className="w-[100px]">Employee Name</TableHead>
                  <TableHead className="w-[80px]">Attendance Date</TableHead>
                  <TableHead className="w-[80px]">Actual Status</TableHead>
                  <TableHead className="w-[80px]">Requested As</TableHead>
                  <TableHead className="w-[100px]">Reason</TableHead>
                  <TableHead className="w-[70px]">Status</TableHead>
                  <TableHead className="w-[80px]">Created</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegularisations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:clock-edit" className="w-12 h-12 text-gray-300" />
                        <p>No attendance regularisations found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRegularisations.map((regularisation, index) => (
                    <TableRow key={regularisation.id}>
                      <TableCell className="truncate" title={regularisation.branchName}>{regularisation.branchName}</TableCell>
                      <TableCell className="truncate">{regularisation.employeeId}</TableCell>
                      <TableCell className="truncate" title={regularisation.employeeName}>{regularisation.employeeName}</TableCell>
                      <TableCell className="truncate">{regularisation.attendanceDate}</TableCell>
                      <TableCell className="truncate">
                        {regularisation.actualStatus && (
                          <Badge variant="outline">{regularisation.actualStatus}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="truncate">
                        {regularisation.requestedStatus && (
                          <Badge variant="secondary">{regularisation.requestedStatus}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="truncate" title={regularisation.reason}>{regularisation.reason}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={
                          regularisation.status === "Approved" ? "default" :
                            regularisation.status === "Rejected" ? "destructive" : "secondary"
                        }>
                          {regularisation.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="truncate">{regularisation.createdAt}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {canManage && regularisation.status === "Pending" && (  
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApprove(regularisation.id)}
                                className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                title="Approve"
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReject(regularisation.id)}
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Reject"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(regularisation)}
                            className="h-7 w-7 p-0"
                            title="Edit"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(regularisation.id)}
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
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
  </>
  )}
    </div>
  )
}