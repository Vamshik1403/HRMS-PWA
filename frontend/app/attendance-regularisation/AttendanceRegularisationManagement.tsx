"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { FormDrawer } from "../components/ui/form-drawer"
import { Badge } from "../components/ui/badge"
import { Plus, Search, Clock, Check, X, CalendarCheck2 } from "lucide-react"
import { PageHeader } from "../components/app/page-header";
import { FilterBar, FilterSelect } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import type { DataTableColumn } from "../components/app/data-table";
import { EntityRowActions } from "../components/app/entity-row-actions";
import { useClientTable, sortRows } from "../hooks/use-client-table";
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
  departmentID?: number

  manageEmployeeID?: number
  serviceProvider?: string
  companyName?: string
  branchName?: string
  departmentName?: string
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
  const [listLoading, setListLoading] = useState(true);
  const [regularisations, setRegularisations] = useState<AttendanceRegularisation[]>([])
  const table = useClientTable("employeeName")
  const [branchFilterList, setBranchFilterList] = useState<any[]>([])
  const [departmentFilterList, setDepartmentFilterList] = useState<any[]>([])
  const [branchFilter, setBranchFilter] = useState("ALL")
  const [departmentFilter, setDepartmentFilter] = useState("ALL")

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRegularisation, setEditingRegularisation] = useState<AttendanceRegularisation | null>(null)
  const [formData, setFormData] = useState({
    serviceProvider: "",
    companyName: "",
    branchName: "",
departmentName: "",
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
departmentID: undefined as number | undefined,
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


  const fetchDepartments = async (query: string = "") => {
  try {
    const res = await fetch(`${BACKEND_URL}/departments`, { cache: "no-store" })
    const data = await res.json()
    const q = query.toLowerCase()

    const ctx = getSidebarContext()
    const companyID = formData.companyID ?? ctx?.companyID ?? user?.companyID
    const branchID = formData.branchesID

    let filtered = Array.isArray(data) ? data : []

    if (companyID) {
      filtered = filtered.filter((d: any) => Number(d.companyID) === Number(companyID))
    }

    if (branchID) {
      filtered = filtered.filter((d: any) => Number(d.branchesID) === Number(branchID))
    }

    return q
      ? filtered.filter((d: any) => (d.departmentName || "").toLowerCase().includes(q))
      : filtered
  } catch (error) {
    console.error("Error fetching departments:", error)
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
      if (!companyID || !formData.branchesID || !formData.departmentID) return []
return applySearch(
  data.filter(
    (item: any) =>
      Number(item.companyID) === Number(companyID) &&
      Number(item.branchesID) === Number(formData.branchesID) &&
      Number(item.departmentNameID ?? item.departmentID ?? item.departments?.id) === Number(formData.departmentID)
  )
)
      }

      // SERVICE_PROVIDER → filter by company + selected branch
      if (user?.role === "SERVICE_PROVIDER") {
if (!formData.branchesID || !formData.departmentID) return []
        const ctx = getSidebarContext();
        const companyID = managerData?.companyID ?? ctx?.companyID ?? user?.companyID;
        const spID = managerData?.serviceProviderID ?? ctx?.serviceProviderID ?? user?.serviceProviderID;
        let filtered;
        if (companyID) {
filtered = data.filter(
  (item: any) =>
    Number(item.companyID) === Number(companyID) &&
    Number(item.branchesID) === Number(formData.branchesID) &&
    Number(item.departmentNameID ?? item.departmentID ?? item.departments?.id) === Number(formData.departmentID)
)
        } else if (spID) {
filtered = data.filter(
  (item: any) =>
    Number(item.serviceProviderID) === Number(spID) &&
    Number(item.branchesID) === Number(formData.branchesID) &&
    Number(item.departmentNameID ?? item.departmentID ?? item.departments?.id) === Number(formData.departmentID)
)
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
       if (companyID && formData.branchesID && formData.departmentID) {
  return applySearch(
    data.filter(
      (item: any) =>
        Number(item.companyID) === Number(companyID) &&
        Number(item.branchesID) === Number(formData.branchesID) &&
        Number(item.departmentNameID ?? item.departmentID ?? item.departments?.id) === Number(formData.departmentID)
    )
  )
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
if (user) {
  loadAttendanceRegularisations()
  loadFilterLookups()
}
  }, [user, managerData, empCreds])

  useEffect(() => {
  const handler = () => {
    if (user) {
      loadAttendanceRegularisations();
      loadFilterLookups();
    }
  };

  const sidebarPageClickHandler = (e: any) => {
    if (e.detail?.path === "/attendance-regularisation") {
      closeRegularisationPagePanels();

      if (user) {
        loadAttendanceRegularisations();
        loadFilterLookups();
      }
    }
  };

  window.addEventListener("sidebar-context-changed", handler);
  window.addEventListener("app-data-refresh", handler);
  window.addEventListener("sidebar-main-page-click", sidebarPageClickHandler);

  return () => {
    window.removeEventListener("sidebar-context-changed", handler);
    window.removeEventListener("app-data-refresh", handler);
    window.removeEventListener("sidebar-main-page-click", sidebarPageClickHandler);
  };
}, [user, managerData, empCreds]);


  const loadFilterLookups = async () => {
  try {
    const [brRes, deptRes] = await Promise.all([
      fetch(`${BACKEND_URL}/branches`, { cache: "no-store" }),
      fetch(`${BACKEND_URL}/departments`, { cache: "no-store" }),
    ])

    const branchesRaw = await brRes.json()
    const departmentsRaw = await deptRes.json()

    const ctx = getSidebarContext()
    const companyID = ctx?.companyID ?? user?.companyID

    let branches = Array.isArray(branchesRaw) ? branchesRaw : []
    let departments = Array.isArray(departmentsRaw) ? departmentsRaw : []

    if (companyID && user?.role !== "SUPERADMIN") {
      branches = branches.filter((b: any) => Number(b.companyID) === Number(companyID))
      departments = departments.filter((d: any) => Number(d.companyID) === Number(companyID))
    }

    if (ctx?.companyID && user?.role === "SUPERADMIN") {
      branches = branches.filter((b: any) => Number(b.companyID) === Number(ctx.companyID))
      departments = departments.filter((d: any) => Number(d.companyID) === Number(ctx.companyID))
    }

    if (user?.role === "BRANCH_ADMIN" && user?.branchesID) {
      branches = branches.filter((b: any) => Number(b.id) === Number(user.branchesID))
      departments = departments.filter((d: any) => Number(d.branchesID) === Number(user.branchesID))
      setBranchFilter(String(user.branchesID))
    }

    setBranchFilterList(branches)
    setDepartmentFilterList(departments)
  } catch (e) {
    console.error("Failed to load filters:", e)
    setBranchFilterList([])
    setDepartmentFilterList([])
  }
}

  const loadAttendanceRegularisations = async () => {
    setListLoading(true);
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
departmentID: regularisation.departmentID ?? regularisation.manageEmployee?.departmentNameID,
departmentName:
  regularisation.departments?.departmentName ||
  regularisation.manageEmployee?.departments?.departmentName ||
  "",
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
    } finally {
      setListLoading(false);
    }
  }

const visibleFilterDepartments = departmentFilterList.filter((d: any) =>
  branchFilter === "ALL" || branchFilter === String(d.branchesID)
)

const handleBranchFilterChange = (value: string) => {
  setBranchFilter(value)
  if (departmentFilter !== "ALL") {
    const dept = departmentFilterList.find((d: any) => String(d.id) === departmentFilter)
    if (dept && value !== "ALL" && String(dept.branchesID) !== value) {
      setDepartmentFilter("ALL")
    }
  }
}

const filteredRegularisations = useMemo(() => {
  const t = table.search.trim().toLowerCase()

  let list = regularisations.filter((regularisation) => {
    const matchesBranch =
      branchFilter === "ALL" || branchFilter === String(regularisation.branchesID)

    const matchesDepartment =
      departmentFilter === "ALL" || departmentFilter === String(regularisation.departmentID)

    const matchesSearch =
      !t ||
      (regularisation.serviceProvider || "").toLowerCase().includes(t) ||
      (regularisation.companyName || "").toLowerCase().includes(t) ||
      (regularisation.branchName || "").toLowerCase().includes(t) ||
      (regularisation.departmentName || "").toLowerCase().includes(t) ||
      (regularisation.employeeName || "").toLowerCase().includes(t) ||
      (regularisation.employeeId || "").toLowerCase().includes(t) ||
      (regularisation.attendanceDate || "").toLowerCase().includes(t)

    return matchesBranch && matchesDepartment && matchesSearch
  })

  return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
    const r = row as AttendanceRegularisation
    if (key === "branch") return r.branchName ?? ""
    if (key === "department") return r.departmentName ?? ""
    if (key === "employeeId") return r.employeeId ?? ""
    if (key === "employeeName") return r.employeeName ?? ""
    if (key === "attendanceDate") return r.attendanceDate ?? ""
    if (key === "actualStatus") return r.actualStatus ?? ""
    if (key === "requestedStatus") return r.requestedStatus ?? ""
    if (key === "reason") return r.reason ?? ""
    if (key === "status") return r.status ?? ""
    if (key === "createdAt") return r.createdAt ?? ""
    return ""
  })
}, [regularisations, table.search, table.sortBy, table.sortDir, branchFilter, departmentFilter])

const branchFilterOptions = useMemo(
  () => [
    { value: "ALL", label: "All branches" },
    ...branchFilterList.map((b: any) => ({
      value: String(b.id),
      label: b.branchName || `Branch #${b.id}`,
    })),
  ],
  [branchFilterList],
)

const departmentFilterOptions = useMemo(
  () => [
    { value: "ALL", label: "All departments" },
    ...visibleFilterDepartments.map((d: any) => ({
      value: String(d.id),
      label: d.departmentName || `Department #${d.id}`,
    })),
  ],
  [visibleFilterDepartments],
)

const statusBadgeVariant = (status?: AttendanceRegularisation["status"]) => {
  if (status === "Approved") return "default" as const
  if (status === "Rejected") return "destructive" as const
  return "secondary" as const
}

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
departmentName: "",
departmentID: undefined,
employeeName: "",
manageEmployeeID: undefined,
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
departmentName: "",
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
      departmentID: undefined,
      manageEmployeeID: undefined,
      overtimeApplicable: false,
      otMealApply: false,
      otMealMinutes: "",
      otBreakMinutes: "",
    })
    setSelectedEmployee(null)
    setEditingRegularisation(null)
  }

  const closeRegularisationPagePanels = () => {
  resetForm();

  setIsDialogOpen(false);
  setEditingRegularisation(null);
  setSelectedEmployee(null);

  setIsFetchingStatus(false);
};

  const handleEdit = (regularisation: AttendanceRegularisation) => {
    setFormData({
      serviceProvider: regularisation.serviceProvider || "",
      companyName: regularisation.companyName || "",
      branchName: regularisation.branchName || "",
      departmentName: regularisation.departmentName || "",
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
      departmentID: regularisation.departmentID,
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

  const regularisationColumns = useMemo((): DataTableColumn<AttendanceRegularisation>[] => [
    {
      key: "branch",
      header: "Branch",
      sortable: true,
      colSpan: 1,
      cell: (r) => <span className="truncate" title={r.branchName}>{r.branchName || "—"}</span>,
    },
    {
      key: "department",
      header: "Department",
      sortable: true,
      colSpan: 1,
      cell: (r) => <span className="truncate" title={r.departmentName}>{r.departmentName || "—"}</span>,
    },
    {
      key: "employeeId",
      header: "Employee ID",
      sortable: true,
      colSpan: 1,
      cell: (r) => r.employeeId || "—",
    },
    {
      key: "employeeName",
      header: "Employee",
      sortable: true,
      colSpan: 1,
      cell: (r) => <span className="truncate" title={r.employeeName}>{r.employeeName || "—"}</span>,
    },
    {
      key: "attendanceDate",
      header: "Date",
      sortable: true,
      colSpan: 1,
      cell: (r) => r.attendanceDate || "—",
    },
    {
      key: "actualStatus",
      header: "Actual",
      sortable: true,
      colSpan: 1,
      cell: (r) => r.actualStatus ? <Badge variant="outline">{r.actualStatus}</Badge> : "—",
    },
    {
      key: "requestedStatus",
      header: "Requested",
      sortable: true,
      colSpan: 1,
      cell: (r) => r.requestedStatus ? <Badge variant="secondary">{r.requestedStatus}</Badge> : "—",
    },
    {
      key: "reason",
      header: "Reason",
      sortable: true,
      colSpan: 1,
      cell: (r) => <span className="truncate" title={r.reason}>{r.reason || "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      colSpan: 1,
      cell: (r) => (
        <Badge variant={statusBadgeVariant(r.status)}>
          {r.status || "Pending"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      colSpan: 1,
      cell: (r) => r.createdAt || "—",
    },
    {
      key: "actions",
      header: "Actions",
      colSpan: 1,
      align: "right",
      cell: (r) => {
        const extra = canManage && r.status === "Pending"
          ? [
              {
                icon: Check,
                title: "Approve",
                onClick: () => handleApprove(r.id),
                className: "text-green-600",
              },
              {
                icon: X,
                title: "Reject",
                onClick: () => handleReject(r.id),
                className: "text-destructive",
              },
            ]
          : undefined

        return (
          <EntityRowActions
            onEdit={() => handleEdit(r)}
            onDelete={() => handleDelete(r.id)}
            extra={extra}
          />
        )
      },
    },
  ], [canManage])

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={CalendarCheck2}
        title="Regularisation"
        description="Manage attendance corrections and time adjustments"
        actions={
          !isDialogOpen ? (
            <Button onClick={() => { closeRegularisationPagePanels(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />
              Submit Regularisation
            </Button>
          ) : null
        }
      />

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

                <div className="space-y-4">
  <h3 className="text-lg font-semibold">Department Selection</h3>
  <SearchSuggestInput
    label="Department Name"
    placeholder={
      !formData.branchesID
        ? "Select branch first"
        : "Start typing department name..."
    }
    value={formData.departmentName}
    onChange={(value) =>
      setFormData((prev) => ({ ...prev, departmentName: value }))
    }
    onSelect={(selected) =>
      setFormData((prev) => ({
        ...prev,
        departmentName: selected.display,
        departmentID: selected.value,
        employeeName: "",
        manageEmployeeID: undefined,
      }))
    }
    fetchData={fetchDepartments}
    displayField="departmentName"
    valueField="id"
    required
    disabled={!formData.branchesID}
  />
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
                  <Button type="button" variant="outline" onClick={closeRegularisationPagePanels}>
                    Cancel
                  </Button>
                  <Button type="submit" className="">
                    {editingRegularisation ? "Update Regularisation" : "Submit Regularisation"}
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
              placeholder: "Search regularisations…",
            }}
            filters={
              <>
                <FilterSelect
                  id="attendance-regularisation-branch"
                  value={branchFilter}
                  onChange={handleBranchFilterChange}
                  options={branchFilterOptions}
                  width="w-56"
                  ariaLabel="Filter by branch"
                />
                <FilterSelect
                  id="attendance-regularisation-department"
                  value={departmentFilter}
                  onChange={setDepartmentFilter}
                  options={departmentFilterOptions}
                  width="w-56"
                  ariaLabel="Filter by department"
                />
              </>
            }
          />

          <EntityListShell
            title="All attendance regularisations"
            columns={regularisationColumns}
            rows={filteredRegularisations}
            rowKey={(r) => r.id}
            isLoading={listLoading}
            sortBy={table.sortBy}
            sortDir={table.sortDir}
            onSort={table.setSort}
            emptyIcon={CalendarCheck2}
            emptyTitle="No attendance regularisations found"
            emptyDescription="Try adjusting your search or filters."
            emptyAction={
              <Button onClick={() => { closeRegularisationPagePanels(); setIsDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Submit Regularisation
              </Button>
            }
          />
        </>
      )}
    </div>
  )
}