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
import { useCompanyBranches } from "../hooks/useCompanyBranches";
import { formatDevicePunchForDisplay } from "../utils/devicePunchTime";

interface AttendanceRegularisation {
  id: string
  approvalActionTaken?: boolean
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  departmentID?: number
  designationID?: number

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

type AttendanceConditionField =
  | "BRANCH"
  | "DEPARTMENT"
  | "DESIGNATION"
  | "EMPLOYEE"
  | "REGULARISATION_TYPE"
  | "REGULARISATION_DAYS"

type AttendanceConditionOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "IN"
  | "NOT_IN"
  | "GREATER_THAN"
  | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN"
  | "LESS_THAN_OR_EQUAL"
  | "BETWEEN"

interface AttendanceWorkflowCondition {
  id: number
  conditionNo: number
  fieldKey: AttendanceConditionField
  operator: AttendanceConditionOperator
  branchesID?: number | null
  departmentID?: number | null
  designationID?: number | null
  numberValue?: number | string | null
  numberValueTo?: number | string | null
  textValue?: string | null
  isActive?: boolean
  employees?: Array<{
    id?: number
    manageEmployeeID: number
  }>
}

type WorkflowApproverType = "REPORTING_MANAGER" | "DESIGNATION"

interface AttendanceWorkflowStep {
  id: number
  approvalWorkflowID: number
  stepNo: number
  approverType: WorkflowApproverType
  designationID?: number | null
  stepName?: string | null
  isMandatory: boolean
  canReject: boolean
  canSendBack: boolean
  approvalTimeout?: number | null
  designation?: {
    id: number
    designation?: string | null
    companyID?: number | null
    branchesID?: number | null
    departmentID?: number | null
  } | null
}

interface AttendanceWorkflow {
  id: number
  serviceProviderID?: number | null
  companyID: number
  branchesID?: number | null
  companyModuleID: number
  workflowName: string
  workflowDescription?: string | null
  effectiveFrom: string
  conditionMatchType: "ALL" | "ANY"
  allowAnySameDesignation: boolean
  workflowStatus: boolean
  companyModule: {
    id: number
    moduleKey: string
    moduleName: string
    moduleStatus: boolean
  }
  steps: AttendanceWorkflowStep[]
  conditions: AttendanceWorkflowCondition[]
}

interface CurrentEmployeeContext {
  id: number
  companyID?: number | null
  branchesID?: number | null
  departmentNameID?: number | null
  designationID?: number | null

  isCompanyOwner?: boolean
}


interface MyApprovalAssignment {
  id: number
  approvalRequestID: number
  status: string
  approvalRequest: {
    id: number
    subjectType: string
    subjectID: number
    subjectEmployeeID?: number | null
    status: string
    currentStepNo?: number | null
    allowAnySameDesignationSnapshot?: boolean
  }
  approvalRequestStep: {
    id: number
    stepNo: number
    stepNameSnapshot?: string | null
    canRejectSnapshot?: boolean
    status: string
  }
}

interface LinkedManager {
  id: number
  employeeFirstName?: string
  employeeLastName?: string
  employeeID?: string
}

function getAuthHeaders(json = false): HeadersInit {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : ""

  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend"
const ATTENDANCE_MODULE_KEY = "ATTENDANCE_MODULE"

function normalizeStatusCode(value: unknown): string {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

  const aliases: Record<string, string> = {
    PRESENT: "PRESENT",
    FULLDAY: "FULL_DAY",
    FULL_DAY: "FULL_DAY",
    HALFDAY: "HALF_DAY",
    HALF_DAY: "HALF_DAY",
    LATE: "LATE_MARK",
    LATE_MARK: "LATE_MARK",
    SICK_LEAVE: "SL",
    CASUAL_LEAVE: "CL",
    PRIVILEGE_LEAVE: "PL",
    PRIVILEGED_LEAVE: "PL",
    LOSS_OF_PAY: "LOP",
  }

  return aliases[normalized] ?? normalized
}

export function AttendanceRegularisationManagement() {
  const { isSingleBranch, autoBranchId, autoBranchName } = useCompanyBranches();
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
designationID: undefined as number | undefined,
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
  const [attendanceWorkflows, setAttendanceWorkflows] = useState<AttendanceWorkflow[]>([])
  const [currentEmployee, setCurrentEmployee] = useState<CurrentEmployeeContext | null>(null)
  const [myPendingApprovals, setMyPendingApprovals] = useState<MyApprovalAssignment[]>([])
  const [myAssignedApprovals, setMyAssignedApprovals] = useState<MyApprovalAssignment[]>([])
  const [linkedManagersByEmployee, setLinkedManagersByEmployee] = useState<Record<number, LinkedManager[]>>({})
  
  const user = useCurrentUser()
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN"
  const isCompanyOwner =
  user?.role === "EMPLOYEE" &&
  currentEmployee?.isCompanyOwner === true

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
          const credsRes = await fetch(`${BACKEND_URL}/manage-emp/credentials/all`, {
            cache: "no-store",
          })
          const creds = await credsRes.json()

          const me = Array.isArray(creds)
            ? creds.find((item: any) => item.username === user.username)
            : null

          setEmpCreds(me || null)

          const manageEmployeeID = Number(
            me?.manageEmployeeID ??
            me?.employee?.id ??
            0,
          )

          if (manageEmployeeID > 0) {
            const employeeRes = await fetch(
              `${BACKEND_URL}/manage-emp/${manageEmployeeID}`,
              { cache: "no-store" },
            )

            if (employeeRes.ok) {
              const employee = await employeeRes.json()

              setCurrentEmployee({
  id: Number(employee.id),

  companyID:
    employee.companyID ??
    null,

  branchesID:
    employee.branchesID ??
    null,

  departmentNameID:
    employee.departmentNameID ??
    employee.departments?.id ??
    null,

  designationID:
    employee.designationID ??
    employee.designations?.id ??
    employee.empDesignation?.[0]?.designationID ??
    employee.empDesignation?.[0]?.designation?.id ??
    null,

  isCompanyOwner:
    employee.isCompanyOwner === true,
})
            } else {
              setCurrentEmployee(null)
            }
          } else {
            setCurrentEmployee(null)
          }
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

  useEffect(() => {
    if (!isSingleBranch || !autoBranchId) return

    setFormData((prev) => ({
      ...prev,
      branchesID:
        prev.branchesID != null
          ? prev.branchesID
          : Number(autoBranchId),
      branchName: prev.branchName || autoBranchName || "",
    }))
  }, [isSingleBranch, autoBranchId, autoBranchName])

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

  // Updated fetchEmployees: search by name/employee ID; no department filter.
  // Company owner sees all company employees; others see reportees (or self).
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
        if (!q) return true
        const fullName = `${item?.employeeFirstName || ""} ${item?.employeeLastName || ""}`.trim().toLowerCase()
        const employeeId = (item?.employeeID || "").toLowerCase()
        return fullName.includes(q) || employeeId.includes(q)
      }).map(mapDisplay)

      const ctx = getSidebarContext();
      const companyID = formData.companyID ?? ctx?.companyID ?? user?.companyID ?? managerData?.companyID;
      const isOwner = !!(user as any)?.employee?.isCompanyOwner || !!(user as any)?.isCompanyOwner;

      let filtered = Array.isArray(data) ? data : []
      if (companyID) {
        filtered = filtered.filter((item: any) => Number(item.companyID) === Number(companyID))
      }
      if (formData.branchesID) {
        filtered = filtered.filter((item: any) => Number(item.branchesID) === Number(formData.branchesID))
      }

      // Non-owners with employee role: prefer reportee list when available
      if (user?.role === "EMPLOYEE" && !isOwner) {
        try {
          const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
          const scopeRes = await fetch(`${BACKEND_URL}/emp-manager-scope/reportees`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            cache: "no-store",
          })
          if (scopeRes.ok) {
            const scope = await scopeRes.json()
            const ids: number[] = Array.isArray(scope?.directReporteeIds) && scope.directReporteeIds.length
              ? scope.directReporteeIds
              : Array.isArray(scope?.reporteeIds) ? scope.reporteeIds : []
            if (ids.length > 0) {
              filtered = filtered.filter((item: any) => ids.includes(Number(item.id)))
            } else if (empCreds?.manageEmployeeID) {
              filtered = filtered.filter((item: any) => item.id === empCreds.manageEmployeeID)
            }
          }
        } catch {
          if (empCreds?.manageEmployeeID) {
            filtered = filtered.filter((item: any) => item.id === empCreds.manageEmployeeID)
          }
        }
      }

      return applySearch(filtered)
    } catch (error) {
      console.error("Error fetching employees:", error)
      return []
    }
  }

  const loadAttendanceWorkflows = async (): Promise<AttendanceWorkflow[]> => {
    try {
      const res = await fetch(`${BACKEND_URL}/approval-workflows`, {
        cache: "no-store",
      })

      if (!res.ok) {
        throw new Error(`Failed to load workflows (${res.status})`)
      }

      const raw = await res.json()
      const workflows: AttendanceWorkflow[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : []

      const attendanceOnly = workflows.filter(
        (workflow) =>
          workflow.workflowStatus === true &&
          workflow.companyModule?.moduleStatus !== false &&
          workflow.companyModule?.moduleKey?.trim().toUpperCase() ===
            ATTENDANCE_MODULE_KEY,
      )

      setAttendanceWorkflows(attendanceOnly)
      return attendanceOnly
    } catch (error) {
      console.error("Failed to load Attendance workflows:", error)
      setAttendanceWorkflows([])
      return []
    }
  }

  const loadMyPendingApprovals = async (): Promise<MyApprovalAssignment[]> => {
    if (
  user?.role !== "EMPLOYEE" ||
  currentEmployee?.isCompanyOwner === true
) {
  setMyPendingApprovals([])
  return []
}

    try {
      const response = await fetch(
        `${BACKEND_URL}/approval-requests/my-pending`,
        {
          headers: getAuthHeaders(),
          credentials: "include",
          cache: "no-store",
        },
      )

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        console.error(
          "Failed to load my pending approvals:",
          errorBody?.message || response.status,
        )
        setMyPendingApprovals([])
        return []
      }

      const raw = await response.json()
      const rows: MyApprovalAssignment[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : []

      const attendanceRows = rows.filter((item) => {
        const subjectType = String(item.approvalRequest?.subjectType ?? "")
          .trim()
          .toUpperCase()

        return [
          "ATTENDANCE_REGULARISATION",
          "ATTENDANCE_REGULARIZATION",
          "ATTENDANCE_REGULARISE",
        ].includes(subjectType)
      })

      setMyPendingApprovals(attendanceRows)
      return attendanceRows
    } catch (error) {
      console.error("Failed to load my pending approvals:", error)
      setMyPendingApprovals([])
      return []
    }
  }

  const loadMyAssignedApprovals = async (): Promise<MyApprovalAssignment[]> => {
    if (
  user?.role !== "EMPLOYEE" ||
  currentEmployee?.isCompanyOwner === true
) {
  setMyAssignedApprovals([])
  return []
}

    try {
      const response = await fetch(
        `${BACKEND_URL}/approval-requests/my-assigned`,
        {
          headers: getAuthHeaders(),
          credentials: "include",
          cache: "no-store",
        },
      )

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        console.error(
          "Failed to load my assigned approvals:",
          errorBody?.message || response.status,
        )
        setMyAssignedApprovals([])
        return []
      }

      const raw = await response.json()
      const rows: MyApprovalAssignment[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : []

      const attendanceRows = rows.filter((item) => {
        const subjectType = String(item.approvalRequest?.subjectType ?? "")
          .trim()
          .toUpperCase()

        return [
          "ATTENDANCE_REGULARISATION",
          "ATTENDANCE_REGULARIZATION",
          "ATTENDANCE_REGULARISE",
        ].includes(subjectType)
      })

      setMyAssignedApprovals(attendanceRows)
      return attendanceRows
    } catch (error) {
      console.error("Failed to load my assigned approvals:", error)
      setMyAssignedApprovals([])
      return []
    }
  }

  const loadLinkedManagersForRows = async (
    rows: AttendanceRegularisation[],
  ): Promise<Record<number, LinkedManager[]>> => {
    const employeeIDs = Array.from(
      new Set(
        rows
          .map((row) => Number(row.manageEmployeeID ?? 0))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    )

    if (employeeIDs.length === 0) {
      setLinkedManagersByEmployee({})
      return {}
    }

    const entries = await Promise.all(
      employeeIDs.map(async (employeeID) => {
        try {
          const response = await fetch(
            `${BACKEND_URL}/manage-emp/${employeeID}/linked-employees`,
            {
              headers: getAuthHeaders(),
              credentials: "include",
              cache: "no-store",
            },
          )

          if (!response.ok) return [employeeID, []] as const

          const raw = await response.json()
          return [employeeID, Array.isArray(raw) ? raw : []] as const
        } catch (error) {
          console.error(
            `Failed to load linked managers for employee ${employeeID}:`,
            error,
          )
          return [employeeID, []] as const
        }
      }),
    )

    const managerMap = Object.fromEntries(entries) as Record<number, LinkedManager[]>
    setLinkedManagersByEmployee(managerMap)
    return managerMap
  }

  const refreshPageData = async () => {
    if (!user) return

    const [workflowRows, pendingRows, assignedRows] = await Promise.all([
      loadAttendanceWorkflows(),
      loadMyPendingApprovals(),
      loadMyAssignedApprovals(),
    ])

    await Promise.all([
      loadFilterLookups(),
      loadAttendanceRegularisations(
        workflowRows,
        pendingRows,
        assignedRows,
      ),
    ])
  }

  useEffect(() => {
    if (!user) return
    void refreshPageData()
  }, [user, managerData, empCreds, currentEmployee?.id])

  useEffect(() => {
    const handler = () => {
      void refreshPageData()
    }

    const sidebarPageClickHandler = (e: any) => {
      if (e.detail?.path === "/attendance-regularisation") {
        closeRegularisationPagePanels()
        void refreshPageData()
      }
    }

    window.addEventListener("sidebar-context-changed", handler)
    window.addEventListener("app-data-refresh", handler)
    window.addEventListener("sidebar-main-page-click", sidebarPageClickHandler)

    return () => {
      window.removeEventListener("sidebar-context-changed", handler)
      window.removeEventListener("app-data-refresh", handler)
      window.removeEventListener("sidebar-main-page-click", sidebarPageClickHandler)
    }
  }, [user, managerData, empCreds, currentEmployee?.id])


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

  const loadAttendanceRegularisations = async (
    workflowSource: AttendanceWorkflow[] = attendanceWorkflows,
    pendingAssignments: MyApprovalAssignment[] = myPendingApprovals,
    assignedAssignments: MyApprovalAssignment[] = myAssignedApprovals,
  ) => {
    setListLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/emp-attendance-regularise`, {
        cache: "no-store",
      })
      const data = await res.json()
      const regularisationsData = (Array.isArray(data) ? data : []).map(
        (regularisation: any) => ({
          id: regularisation.id.toString(),

approvalActionTaken:
  regularisation.approvalActionTaken === true,

serviceProviderID:
  regularisation.serviceProviderID,
          companyID: regularisation.companyID,
          branchesID: regularisation.branchesID,
          manageEmployeeID: regularisation.manageEmployeeID,
          serviceProvider: regularisation.serviceProvider?.companyName || "",
          companyName: regularisation.company?.companyName || "",
   branchName: regularisation.branches?.branchName || "",
departmentID:
  regularisation.departmentID ??
  regularisation.manageEmployee?.departmentNameID ??
  regularisation.manageEmployee?.departments?.id,
designationID:
  regularisation.designationID ??
  regularisation.manageEmployee?.designationID ??
  regularisation.manageEmployee?.designations?.id ??
  regularisation.manageEmployee?.empDesignation?.[0]?.designationID ??
  regularisation.manageEmployee?.empDesignation?.[0]?.designation?.id,
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

      const managerMap = await loadLinkedManagersForRows(regularisationsData)

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

      if (user.role === "EMPLOYEE") {
        const filtered = regularisationsData.filter(
          (row: AttendanceRegularisation) =>
            canEmployeeSeeRow(
              row,
              workflowSource,
              managerMap,
              pendingAssignments,
              assignedAssignments,
            ),
        )

        setRegularisations(filtered)
        return
      }

      setRegularisations([])
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
      branchesID: Number(selected.value),
      departmentName: "",
      departmentID: undefined,
      designationID: undefined,
      employeeName: "",
      manageEmployeeID: undefined,
    }))
    setSelectedEmployee(null)
  }

  const handleEmployeeSelect = (selected: SelectedItem) => {
    const employee = selected.item

    setSelectedEmployee(employee)

    setFormData((prev) => ({
      ...prev,
      employeeName: selected.display,
      manageEmployeeID: Number(selected.value),
      serviceProviderID:
        employee?.serviceProviderID ??
        prev.serviceProviderID,
      companyID:
        employee?.companyID ??
        prev.companyID,
      branchesID:
        employee?.branchesID ??
        prev.branchesID,
      departmentID:
        employee?.departmentNameID ??
        employee?.departmentID ??
        employee?.departments?.id ??
        prev.departmentID,
      departmentName:
        employee?.departments?.departmentName ??
        prev.departmentName,
      designationID:
        employee?.designationID ??
        employee?.designations?.id ??
        employee?.empDesignation?.[0]?.designationID ??
        employee?.empDesignation?.[0]?.designation?.id ??
        undefined,
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
        fetch(`${BACKEND_URL}/process-att-logs?dateFrom=${date}&dateTo=${date}&manageEmployeeIds=${employeeId}&limit=1000`, { cache: "no-store" }),
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

      const isFlexible: boolean = !!(workShift?.isFlexible || String(policy?.workingHoursType || "").toLowerCase().includes("flex"))
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
          if (Number(h.companyID) !== Number(resolvedCompanyID)) return false
          if (h.branchesID != null && String(h.branchesID) !== "") {
            if (Number(h.branchesID) !== Number(resolvedBranchID)) return false
          }
          const rawStart = String(h.startDate ?? "")
          const rawEnd = String(h.endDate ?? "")
          const hs = rawStart.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || new Date(rawStart).toISOString().split("T")[0]
          const he = rawEnd.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || new Date(rawEnd).toISOString().split("T")[0] || hs
          return !!hs && date >= hs && date <= he
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
        if (isPublicHoliday()) return applyStatus("PUBLIC_HOLIDAY")
        if (isWeekOff()) return applyStatus("WEEK_OFF")
        const leave = approvedLeave()
        if (leave) return applyStatus(leave.appliedLeaveType)
        return applyStatus("ABSENT")
      }

      if (isPublicHoliday()) return applyStatus("PUBLIC_HOLIDAY")
      if (isWeekOff()) return applyStatus("WEEK_OFF")
      const leave = approvedLeave()
      if (leave) return applyStatus(leave.appliedLeaveType)

      if (punches.length === 1) {
        return applyStatus(policy?.markAs === "Absent" ? "ABSENT" : "HALFDAY")
      }

      if (shiftDay && policy) {
        const firstMin = timeToMin(punches[0])
        const lastMin = timeToMin(punches[punches.length - 1])
        const shiftStartMin = timeToMin(shiftDay.startTime)
        const shiftEndMin = timeToMin(shiftDay.endTime)
        const graceTime = policy.checkin_grace_time_min || 0
        const maxLateWindow = policy.max_late_check_in_time || 0
        const graceEnd = shiftStartMin + graceTime
        const maxLateCutoff = graceEnd + maxLateWindow
        const workedMinutes = calculateWorkedMinutes(punches)
        const totalShiftMinutes = shiftDay.totalMinutes || 480
        const halfDayMin = policy.min_work_hours_half_day_min || 0
        const earlyAllow = policy.earlyCheckoutBeforeEndMin || 0

        if (isFlexible) {
          if (workedMinutes < halfDayMin) return applyStatus("ABSENT")
          if (workedMinutes < totalShiftMinutes) return applyStatus("HALFDAY")
          return applyStatus("FULLDAY")
        }

        if (workedMinutes < halfDayMin) return applyStatus("ABSENT")
        if (firstMin > maxLateCutoff) {
          const markAs = policy.maxLateCheckinMarkAs || "Absent"
          return applyStatus(markAs === "Absent" ? "ABSENT" : "HALFDAY")
        }
        if (lastMin < shiftEndMin - earlyAllow) return applyStatus("HALFDAY")
        if (firstMin > graceEnd && firstMin <= maxLateCutoff) return applyStatus("LATE_MARK")
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

  const compareIDCondition = (
    actual: number | null | undefined,
    expected: number | null | undefined,
    operator: AttendanceConditionOperator,
  ): boolean => {
    if (actual == null || expected == null) return false

    const left = Number(actual)
    const right = Number(expected)

    if (operator === "EQUALS") return left === right
    if (operator === "NOT_EQUALS") return left !== right

    return false
  }

  const compareNumberCondition = (
    actual: number,
    condition: AttendanceWorkflowCondition,
  ): boolean => {
    const first = Number(condition.numberValue)

    if (!Number.isFinite(first)) return false

    switch (condition.operator) {
      case "EQUALS":
        return actual === first
      case "NOT_EQUALS":
        return actual !== first
      case "GREATER_THAN":
        return actual > first
      case "GREATER_THAN_OR_EQUAL":
        return actual >= first
      case "LESS_THAN":
        return actual < first
      case "LESS_THAN_OR_EQUAL":
        return actual <= first
      case "BETWEEN": {
        const second = Number(condition.numberValueTo)

        return (
          Number.isFinite(second) &&
          actual >= first &&
          actual <= second
        )
      }
      default:
        return false
    }
  }

  const evaluateAttendanceCondition = (
    condition: AttendanceWorkflowCondition,
    subject: {
      branchesID?: number | null
      departmentID?: number | null
      designationID?: number | null
      manageEmployeeID?: number | null
      requestedStatus?: string | null
      regularisationDays: number
    },
  ): boolean => {
    switch (condition.fieldKey) {
      case "BRANCH":
        return compareIDCondition(
          subject.branchesID,
          condition.branchesID,
          condition.operator,
        )

      case "DEPARTMENT":
        return compareIDCondition(
          subject.departmentID,
          condition.departmentID,
          condition.operator,
        )

      case "DESIGNATION":
        return compareIDCondition(
          subject.designationID,
          condition.designationID,
          condition.operator,
        )

      case "EMPLOYEE": {
        const configuredIDs = (condition.employees ?? [])
          .map((employee) => Number(employee.manageEmployeeID))
          .filter((id) => Number.isInteger(id) && id > 0)

        const employeeID = Number(subject.manageEmployeeID)
        const included = configuredIDs.includes(employeeID)

        if (condition.operator === "IN") return included
        if (condition.operator === "NOT_IN") return !included

        return false
      }

      case "REGULARISATION_TYPE": {
        const actual = normalizeStatusCode(subject.requestedStatus)
        const expected = normalizeStatusCode(condition.textValue)

        if (!expected) return false

        if (condition.operator === "EQUALS") {
          return actual === expected
        }

        if (condition.operator === "NOT_EQUALS") {
          return actual !== expected
        }

        return false
      }

      case "REGULARISATION_DAYS":
        return compareNumberCondition(
          subject.regularisationDays,
          condition,
        )

      default:
        return false
    }
  }

  const workflowMatchesConditions = (
    workflow: AttendanceWorkflow,
    subject: {
      branchesID?: number | null
      departmentID?: number | null
      designationID?: number | null
      manageEmployeeID?: number | null
      requestedStatus?: string | null
      regularisationDays: number
    },
  ): boolean => {
    const conditions = (workflow.conditions ?? [])
      .filter((condition) => condition.isActive !== false)
      .sort((a, b) => a.conditionNo - b.conditionNo)

    if (conditions.length === 0) return false

    const results = conditions.map((condition) =>
      evaluateAttendanceCondition(condition, subject),
    )

    return workflow.conditionMatchType === "ANY"
      ? results.some(Boolean)
      : results.every(Boolean)
  }

  const findAttendanceWorkflow = (
    subject: {
      companyID: number
      branchesID: number
      departmentID?: number | null
      designationID?: number | null
      manageEmployeeID?: number | null
      requestedStatus?: string | null
      regularisationDays: number
    },
    workflowSource: AttendanceWorkflow[] = attendanceWorkflows,
  ): AttendanceWorkflow | null => {
    const now = Date.now()

    const candidates = workflowSource
      .filter(
        (workflow) =>
          workflow.workflowStatus === true &&
          workflow.companyModule?.moduleStatus !== false &&
          workflow.companyModule?.moduleKey?.trim().toUpperCase() ===
            ATTENDANCE_MODULE_KEY &&
          Number(workflow.companyID) === Number(subject.companyID) &&
          (workflow.branchesID == null ||
            Number(workflow.branchesID) ===
              Number(subject.branchesID)) &&
          new Date(workflow.effectiveFrom).getTime() <= now,
      )
      .sort((a, b) => {
        const aExact =
          a.branchesID != null &&
          Number(a.branchesID) === Number(subject.branchesID)

        const bExact =
          b.branchesID != null &&
          Number(b.branchesID) === Number(subject.branchesID)

        if (aExact !== bExact) {
          return aExact ? -1 : 1
        }

        const dateDiff =
          new Date(b.effectiveFrom).getTime() -
          new Date(a.effectiveFrom).getTime()

        if (dateDiff !== 0) return dateDiff

        return b.id - a.id
      })

    // Exact branch workflows are evaluated first.
    // Company-wide branchesID=null workflows act as fallback.
    for (const workflow of candidates) {
      if (workflowMatchesConditions(workflow, subject)) {
        return workflow
      }
    }

    return null
  }

  const getWorkflowForRow = (
    row: AttendanceRegularisation,
    workflowSource: AttendanceWorkflow[] = attendanceWorkflows,
  ): AttendanceWorkflow | null => {
    if (!row.companyID || !row.branchesID) return null

    return findAttendanceWorkflow(
      {
        companyID: Number(row.companyID),
        branchesID: Number(row.branchesID),
        departmentID: row.departmentID ?? null,
        designationID: row.designationID ?? null,
        manageEmployeeID: row.manageEmployeeID ?? null,
        requestedStatus: row.requestedStatus ?? null,
        regularisationDays: 1,
      },
      workflowSource,
    )
  }

  const canEmployeeSeeRow = (
    row: AttendanceRegularisation,
    workflowSource: AttendanceWorkflow[],
    managerMap: Record<number, LinkedManager[]>,
    pendingAssignments: MyApprovalAssignment[],
    assignedAssignments: MyApprovalAssignment[],
  ): boolean => {
    if (
  user?.role !== "EMPLOYEE" ||
  !currentEmployee
) {
  return false
}

const loggedEmployeeID =
  Number(currentEmployee.id)

const requestEmployeeID =
  Number(row.manageEmployeeID ?? 0)

/*
 * COMPANY OWNER
 *
 * Company owner can VIEW every regularisation
 * belonging to their company.
 *
 * This is visibility only.
 * Approval permission is handled separately.
 */
if (
  currentEmployee.isCompanyOwner === true
) {
  return (
    Number(row.companyID ?? 0) ===
    Number(currentEmployee.companyID ?? 0)
  )
}

    /*
     * Request owner always keeps the record.
     */
    if (
      loggedEmployeeID > 0 &&
      requestEmployeeID === loggedEmployeeID
    ) {
      return true
    }

    /*
     * PRODUCTION RULE:
     * Once this approval request was ever assigned to this employee,
     * it stays visible permanently, regardless of:
     * PENDING / WAITING / APPROVED / REJECTED / SKIPPED / CANCELLED.
     */
    const wasEverAssigned = assignedAssignments.some(
      (assignment) =>
        Number(assignment.approvalRequest?.subjectID) === Number(row.id),
    )

    if (wasEverAssigned) {
      return true
    }

    /*
     * Current actionable assignment also guarantees visibility.
     * This is mostly redundant once my-assigned is available, but is kept
     * defensively while rolling out the new endpoint.
     */
    const assignedNow = pendingAssignments.some(
      (assignment) =>
        Number(assignment.approvalRequest?.subjectID) === Number(row.id) &&
        assignment.approvalRequest?.status === "PENDING",
    )

    if (assignedNow) {
      return true
    }

    /*
     * Legacy fallback for old rows created before ApprovalRequest integration.
     * It is visibility-only and NEVER grants approve/reject permission.
     */
    if (row.status !== "Pending") {
      return false
    }

    const workflow = getWorkflowForRow(row, workflowSource)
    if (!workflow) return false

    /*
     * For sequential mode, never guess the active approver in the browser.
     * Backend assignment is required.
     */
    if (workflow.allowAnySameDesignation !== true) {
      return false
    }

    const steps = [...(workflow.steps ?? [])].sort(
      (a, b) => a.stepNo - b.stepNo,
    )

    return steps.some((step) => {
      if (step.approverType === "REPORTING_MANAGER") {
        const managers = managerMap[requestEmployeeID] ?? []

        const isActualLinkedManager = managers.some(
          (manager) => Number(manager.id) === loggedEmployeeID,
        )

        if (!isActualLinkedManager) return false

        if (
          Number(currentEmployee.companyID ?? 0) !==
          Number(workflow.companyID)
        ) {
          return false
        }

        if (step.designationID != null) {
          return (
            Number(currentEmployee.designationID ?? 0) ===
            Number(step.designationID)
          )
        }

        return true
      }

      if (step.approverType === "DESIGNATION") {
        return (
          Number(currentEmployee.companyID ?? 0) ===
            Number(workflow.companyID) &&
          Number(currentEmployee.designationID ?? 0) ===
            Number(step.designationID ?? 0)
        )
      }

      return false
    })
  }

  const getAssignedApproval = (
    row: AttendanceRegularisation,
  ): MyApprovalAssignment | null => {
    return (
      myAssignedApprovals.find(
        (assignment) =>
          Number(assignment.approvalRequest?.subjectID) === Number(row.id),
      ) ?? null
    )
  }

  const getApprovalDisplayState = (
    row: AttendanceRegularisation,
  ): {
    label: string
    variant: "default" | "secondary" | "destructive" | "outline"
  } => {
    const assigned = getAssignedApproval(row)

    if (!assigned) {
      if (row.status === "Approved") {
        return {
          label: "Final Approved",
          variant: "default",
        }
      }

      if (row.status === "Rejected") {
        return {
          label: "Rejected",
          variant: "destructive",
        }
      }

      return {
        label: row.status || "Pending",
        variant: "secondary",
      }
    }

    const requestStatus = String(
      assigned.approvalRequest?.status ?? "",
    ).toUpperCase()

    const assignmentStatus = String(
      assigned.status ?? "",
    ).toUpperCase()

    if (requestStatus === "APPROVED") {
      return {
        label: "Final Approved",
        variant: "default",
      }
    }

    if (requestStatus === "REJECTED") {
      return {
        label: "Rejected",
        variant: "destructive",
      }
    }

    if (requestStatus === "CANCELLED") {
      return {
        label: "Cancelled",
        variant: "outline",
      }
    }

    /*
     * Employee already approved his stage but the whole workflow
     * is still moving to another approver/step.
     */
    if (
      requestStatus === "PENDING" &&
      assignmentStatus === "APPROVED"
    ) {
      return {
        label: "Soft Approved",
        variant: "outline",
      }
    }

    if (
      requestStatus === "PENDING" &&
      assignmentStatus === "PENDING"
    ) {
      return {
        label: assigned.approvalRequestStep?.stepNameSnapshot
          ? `Pending • ${assigned.approvalRequestStep.stepNameSnapshot}`
          : `Pending • Step ${assigned.approvalRequestStep?.stepNo ?? ""}`,
        variant: "secondary",
      }
    }

    if (
      requestStatus === "PENDING" &&
      assignmentStatus === "WAITING"
    ) {
      return {
        label: assigned.approvalRequestStep?.stepNameSnapshot
          ? `Waiting • ${assigned.approvalRequestStep.stepNameSnapshot}`
          : `Waiting • Step ${assigned.approvalRequestStep?.stepNo ?? ""}`,
        variant: "outline",
      }
    }

    if (assignmentStatus === "SKIPPED") {
      return {
        label: "Completed Elsewhere",
        variant: "outline",
      }
    }

    return {
      label: assignmentStatus || requestStatus || "Pending",
      variant: "outline",
    }
  }

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()


    const serviceProviderID =
      user?.role === "SUPERADMIN"
        ? formData.serviceProviderID
        : managerData?.serviceProviderID ||
          empCreds?.serviceProviderID ||
          formData.serviceProviderID ||
          user?.serviceProviderID

    const companyID =
      user?.role === "SUPERADMIN"
        ? formData.companyID
        : managerData?.companyID ||
          empCreds?.companyID ||
          currentEmployee?.companyID ||
          formData.companyID ||
          user?.companyID

    if (!companyID || !formData.branchesID || !formData.manageEmployeeID) {
      toast.error(
        "Please make sure all required fields are selected: Branch and Employee",
      )
      return
    }

    if (!formData.attendanceDate) {
      toast.error("Attendance date is required")
      return
    }

    if (!formData.requestedStatus) {
      toast.error("Requested status is required")
      return
    }

    if (!formData.reason.trim()) {
      toast.error("Reason is required")
      return
    }

    const matchedWorkflow = findAttendanceWorkflow({
      companyID: Number(companyID),
      branchesID: Number(formData.branchesID),
      departmentID: formData.departmentID ?? null,
      designationID: formData.designationID ?? null,
      manageEmployeeID: Number(formData.manageEmployeeID),
      requestedStatus: formData.requestedStatus,
      regularisationDays: 1,
    })

    const status: "Pending" | "Approved" =
      matchedWorkflow != null
        ? "Pending"
        : "Approved"

    try {
      const attendanceRegularisationData = {
        serviceProviderID,
        companyID: Number(companyID),
        branchesID: Number(formData.branchesID),
        manageEmployeeID: Number(formData.manageEmployeeID),
        attendanceDate: new Date(formData.attendanceDate),
        day: formData.day,
        checkInTime: formData.checkInTime
          ? new Date(`2000-01-01T${formData.checkInTime}`)
          : null,
        checkOutTime: formData.checkOutTime
          ? new Date(`2000-01-01T${formData.checkOutTime}`)
          : null,
        actualStatus: formData.actualStatus
          ? formData.actualStatus.replace(" (Regularized)", "")
          : null,
        requestedStatus: formData.requestedStatus,
        reason: formData.reason.trim(),
        remarks: formData.remarks,
        status,
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
        const message =
          errorData?.message ||
          `Failed to save attendance regularisation: ${res.status}`

        toast.error(message)
        return
      }

      await refreshPageData()
      resetForm()
      setIsDialogOpen(false)

      if (matchedWorkflow) {
        toast.success(
          `Regularisation submitted for approval through "${matchedWorkflow.workflowName}"`,
        )
      } else {
        toast.success(
          "No workflow condition matched. Regularisation approved directly.",
        )
      }
    } catch (error) {
      console.error("Error saving attendance regularisation:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong",
      )
    }
  }

  const resetForm = () => {
    const ctx = getSidebarContext();
    setFormData({
      serviceProvider: ctx?.serviceProviderName ?? "",
      companyName: ctx?.companyName ?? "",
      branchName: isSingleBranch ? autoBranchName || "" : "",
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
      branchesID:
        isSingleBranch && autoBranchId
          ? Number(autoBranchId)
          : undefined,
      departmentID: undefined,
      designationID: undefined,
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

const canModifyRegularisation = (
  row: AttendanceRegularisation,
): boolean => {
  /*
   * Only Pending requests can be changed.
   */
  if (
    String(row.status ?? "")
      .trim()
      .toUpperCase() !== "PENDING"
  ) {
    return false
  }

  /*
   * Once ANY workflow approver has acted,
   * editing/deleting is permanently blocked.
   *
   * Example:
   * Step 1 approved → row still Pending →
   * approvalActionTaken = true →
   * Edit/Delete hidden.
   */
  if (
    row.approvalActionTaken === true
  ) {
    return false
  }

  return true
}

 const handleEdit = (
  regularisation: AttendanceRegularisation,
) => {
  if (
    !canModifyRegularisation(
      regularisation,
    )
  ) {
    toast.error(
      "This regularisation can no longer be edited because approval has already started.",
    )
    return
  }

  setFormData({
    serviceProvider:
      regularisation.serviceProvider ||
      "",

    companyName:
      regularisation.companyName ||
      "",

    branchName:
      regularisation.branchName ||
      "",

    departmentName:
      regularisation.departmentName ||
      "",

    employeeName:
      regularisation.employeeName ||
      "",

    attendanceDate:
      regularisation.attendanceDate ||
      "",

    checkInTime:
      regularisation.checkInTime ||
      "",

    checkOutTime:
      regularisation.checkOutTime ||
      "",

    actualStatus:
      regularisation.actualStatus ||
      "",

    requestedStatus:
      regularisation.requestedStatus ||
      "",

    reason:
      regularisation.reason ||
      "",

    remarks:
      regularisation.remarks ||
      "",

    day:
      regularisation.day ||
      "",

    serviceProviderID:
      regularisation.serviceProviderID,

    companyID:
      regularisation.companyID,

    branchesID:
      regularisation.branchesID,

    departmentID:
      regularisation.departmentID,

    designationID:
      regularisation.designationID,

    manageEmployeeID:
      regularisation.manageEmployeeID,

    overtimeApplicable:
      (regularisation as any)
        .overtimeApplicable ??
      false,

    otMealApply:
      (regularisation as any)
        .otMealApply ??
      false,

    otMealMinutes:
      (regularisation as any)
        .otMealMinutes ??
      "",

    otBreakMinutes:
      (regularisation as any)
        .otBreakMinutes ??
      "",
  })

  setSelectedEmployee({
    id:
      regularisation.manageEmployeeID,

    employeeID:
      regularisation.employeeId,

    employeeFirstName:
      regularisation.employeeName
        ?.split(" ")[0] ||
      "",

    employeeLastName:
      regularisation.employeeName
        ?.split(" ")
        .slice(1)
        .join(" ") ||
      "",
  })

  setEditingRegularisation(
    regularisation,
  )

  setIsDialogOpen(
    true,
  )
}

  const handleDelete = async (
  id: string,
) => {
  const row =
    regularisations.find(
      (item) =>
        String(item.id) ===
        String(id),
    )

  if (!row) {
    toast.error(
      "Regularisation record not found",
    )
    return
  }

  if (
    !canModifyRegularisation(
      row,
    )
  ) {
    toast.error(
      "This regularisation can no longer be deleted because approval has already started.",
    )
    return
  }

  const confirmed =
    window.confirm(
      "Delete this attendance regularisation request?",
    )

  if (!confirmed) {
    return
  }

  try {
    const response =
      await fetch(
        `${BACKEND_URL}/emp-attendance-regularise/${id}`,
        {
          method:
            "DELETE",

          headers:
            getAuthHeaders(),

          credentials:
            "include",
        },
      )

    const result =
      await response
        .json()
        .catch(
          () => ({}),
        )

    if (
      !response.ok
    ) {
      throw new Error(
        result?.message ||
        `Failed to delete attendance regularisation (${response.status})`,
      )
    }

    await refreshPageData()

    toast.success(
      "Regularisation deleted successfully",
    )
  } catch (
    error
  ) {
    console.error(
      "Error deleting attendance regularisation:",
      error,
    )

    toast.error(
      error instanceof Error
        ? error.message
        : "Something went wrong",
    )
  }
}

  const getApprovalAssignment = (
    row: AttendanceRegularisation,
  ): MyApprovalAssignment | null => {
    if (row.status !== "Pending") return null

    return (
      myPendingApprovals.find(
        (assignment) =>
          Number(assignment.approvalRequest?.subjectID) === Number(row.id) &&
          assignment.approvalRequest?.status === "PENDING",
      ) ?? null
    )
  }

  const getApprovalPermission = (
    row: AttendanceRegularisation,
  ): {
    
    canApprove: boolean
    canReject: boolean
    assignment: MyApprovalAssignment | null
    linkedManagers: LinkedManager[]
  } => {

    /*
 * Company Owner has company-wide read-only visibility.
 * Owner must never receive Approve / Reject actions
 * from this page.
 */
if (
  currentEmployee?.isCompanyOwner === true
) {
  return {
    canApprove: false,
    canReject: false,
    assignment: null,
    linkedManagers:
      linkedManagersByEmployee[
        Number(row.manageEmployeeID ?? 0)
      ] ?? [],
  }
}
    const assignment = getApprovalAssignment(row)
    const linkedManagers =
      linkedManagersByEmployee[Number(row.manageEmployeeID ?? 0)] ?? []

    if (!assignment) {
      return {
        canApprove: false,
        canReject: false,
        assignment: null,
        linkedManagers,
      }
    }

    /*
     * IMPORTANT:
     * Frontend does NOT recalculate workflow/designation/current-step access.
     * /approval-requests/my-pending is the backend authority.
     *
     * Therefore:
     * - sequential mode: only currently activated employee receives the row
     * - any-approver mode: all currently eligible assigned employees receive it
     * - REPORTING_MANAGER: backend assignment engine must use linked manager
     * - DESIGNATION: backend assignment engine must assign matching company employees
     */
    return {
      canApprove: true,
      canReject:
        assignment.approvalRequestStep?.canRejectSnapshot !== false,
      assignment,
      linkedManagers,
    }
  }

  const refreshApprovalData = async () => {
    await refreshPageData()
  }

  const handleApprove = async (id: string) => {
    const row = regularisations.find(
      (item) => String(item.id) === String(id),
    )

    if (!row) {
      toast.error("Regularisation record not found")
      return
    }

    const permission = getApprovalPermission(row)

    if (!permission.canApprove || !permission.assignment) {
      toast.error(
        "This regularisation is not currently assigned to you for approval",
      )
      return
    }

    try {
      const response = await fetch(
        `${BACKEND_URL}/approval-requests/${permission.assignment.approvalRequest.id}/approve`,
        {
          method: "POST",
          headers: getAuthHeaders(true),
          credentials: "include",
          body: JSON.stringify({
            remark: "Attendance regularisation approved",
          }),
        },
      )

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          result?.message ||
          `Failed to approve attendance regularisation (${response.status})`,
        )
      }

      await refreshApprovalData()

      toast.success(
        result?.completed
          ? "Regularisation fully approved"
          : result?.message || "Approval recorded successfully",
      )
    } catch (error) {
      console.error("Error approving attendance regularisation:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong",
      )
    }
  }

  const handleReject = async (id: string) => {
    const row = regularisations.find(
      (item) => String(item.id) === String(id),
    )

    if (!row) {
      toast.error("Regularisation record not found")
      return
    }

    const permission = getApprovalPermission(row)

    if (!permission.canReject || !permission.assignment) {
      toast.error(
        "You are not allowed to reject this regularisation",
      )
      return
    }

    const reason = window.prompt("Enter rejection reason:")

    if (reason == null) return

    const remark = reason.trim()

    if (!remark) {
      toast.error("Rejection reason is required")
      return
    }

    try {
      const response = await fetch(
        `${BACKEND_URL}/approval-requests/${permission.assignment.approvalRequest.id}/reject`,
        {
          method: "POST",
          headers: getAuthHeaders(true),
          credentials: "include",
          body: JSON.stringify({ remark }),
        },
      )

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          result?.message ||
          `Failed to reject attendance regularisation (${response.status})`,
        )
      }

      await refreshApprovalData()
      toast.success("Regularisation rejected")
    } catch (error) {
      console.error("Error rejecting attendance regularisation:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong",
      )
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
      key: "approval",
      header: "Approval Status",
      colSpan: 1,
      cell: (r) => {
        const state = getApprovalDisplayState(r)

        return (
          <Badge variant={state.variant}>
            {state.label}
          </Badge>
        )
      },
    },
    {
  key: "actions",
  header: "Actions",
  colSpan: 1,
  align: "right",

  cell: (r) => {
    const permission =
      getApprovalPermission(r)

    /*
     * EDIT / DELETE RULE
     *
     * Visible to ANY user who can already see this row,
     * but only while:
     *
     * status = Pending
     * AND
     * no approval action has happened.
     */
    const canModify =
      canModifyRegularisation(r)

    const extra =
      permission.canApprove
        ? [
            {
              icon:
                Check,

              title:
                permission.assignment
                  ?.approvalRequestStep
                  ?.stepNameSnapshot
                  ? `Approve — ${permission.assignment.approvalRequestStep.stepNameSnapshot}`
                  : "Approve",

              onClick:
                () =>
                  void handleApprove(
                    r.id,
                  ),

              className:
                "text-green-600",
            },

            ...(permission.canReject
              ? [
                  {
                    icon:
                      X,

                    title:
                      "Reject",

                    onClick:
                      () =>
                        void handleReject(
                          r.id,
                        ),

                    className:
                      "text-destructive",
                  },
                ]
              : []),
          ]
        : undefined

    return (
      <EntityRowActions
        onEdit={
          canModify
            ? () =>
                handleEdit(
                  r,
                )
            : undefined
        }
        onDelete={
          canModify
            ? () =>
                void handleDelete(
                  r.id,
                )
            : undefined
        }
        extra={
          extra
        }
      />
    )
  },
},
  ], [
    canManage,
    attendanceWorkflows,
    currentEmployee,
    empCreds,
    myPendingApprovals,
    myAssignedApprovals,
    linkedManagersByEmployee,
    regularisations,
  ])

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={CalendarCheck2}
        title="Regularisation"
        description="Manage attendance corrections and time adjustments"
 actions={
  !isDialogOpen ? (
    <Button
      onClick={() => {
        closeRegularisationPagePanels()
        setIsDialogOpen(true)
      }}
    >
      <Plus className="w-4 h-4 mr-1" />
      Submit Regularisation
    </Button>
  ) : null
}
      />

      <FormDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen}  title={
    editingRegularisation
      ? "Edit Attendance Regularisation"
      : "Submit Attendance Regularisation"
  }
   description={editingRegularisation ? "Update the attendance regularisation information below." : "Fill in the details to submit a new attendance regularisation."}>
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

                    {/* Branch Name - hidden when company has only one branch */}
                    <div style={{ 
                      gridColumn: user?.role !== "SUPERADMIN" ? "span 3" : "span 1"
                    }}>
                      {isSingleBranch ? (
                        <div className="space-y-2">
                          <Label>Branch</Label>
                          <Input
                            value={formData.branchName || autoBranchName || ""}
                            readOnly
                            className="bg-muted"
                          />
                        </div>
                      ) : (
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
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Employee Selection</h3>
                  <div className="space-y-2">
                    <SearchSuggestInput
                      label="Employee"
                      placeholder="Search by employee name or employee ID…"
                      value={formData.employeeName}
                      onChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          employeeName: value,
                          manageEmployeeID: undefined,
                          designationID: undefined,
                        }))
                      }
                      onSelect={handleEmployeeSelect}
                      fetchData={fetchEmployees}
                      displayField="displayName"
                      valueField="id"
                      required
                    />
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
<option value="HALF_DAY">Half Day</option>
<option value="LATE_MARK">Late Mark</option>
<option value="SL">Sick Leave (SL)</option>
<option value="CL">Casual Leave (CL)</option>
<option value="PL">Privilege Leave (PL)</option>
<option value="LOP">Loss of Pay (LOP)</option>
<option value="WEEKOFF">Week Off</option>
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
  <Button
    onClick={() => {
      closeRegularisationPagePanels()
      setIsDialogOpen(true)
    }}
  >
    <Plus className="w-4 h-4 mr-1" />
    Submit Regularisation
  </Button>
}
          />
        </>
      )}
    </div>
  )
}
