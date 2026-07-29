"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/app/components/ui/table";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { authHeaders } from "@/lib/auth";
import SoftBarChart from "./components/SoftBarChart";
import type { SoftBarPoint } from "./components/SoftBarChart";
import { DashboardHero } from "./components/DashboardHero";
import { SuperadminPlatformDashboard } from "./components/SuperadminPlatformDashboard";
import { CompanyAdminEnterpriseDashboard } from "./components/CompanyAdminEnterpriseDashboard";
import EmployeeStatusCharts, {
  type StatusBreakdownItem,
} from "./components/EmployeeStatusCharts";
import { StatCard } from "./components/StatCard";
import {
  cardShell,
  panelTitle,
  actionTileStackClass,
  filterSelectClass,
  listItemClass,
  iconTileClass,
  sectionGap,
  gridGap,
} from "./components/dashboard-ui";
import { QuickActionGrid, type QuickActionItem } from "./components/QuickActionCard";
import { AttendanceTrendChart } from "./components/AttendanceTrendChart";
import { ActivityFeed, type ActivityItem } from "./components/ActivityFeed";
import { EmptyState } from "./components/EmptyState";
import { StatusChip } from "./components/StatusChip";
import { NoticeBanner } from "@/app/components/ui/notice-banner";
import {
  Users,
  UserCheck,
  UserX,
  CalendarClock,
  UserCog,
  MessageSquare,
  UserMinus,
  CalendarCheck,
  CalendarDays,
  CalendarX,
  Banknote,
  Wallet,
  IndianRupee,
  LineChart,
} from "lucide-react";
import { formatDevicePunchForDisplay } from "../utils/devicePunchTime";
import { useAppRefresh } from "../hooks/useAppRefresh";
import { isDesktopManagerFlagSet } from "@/lib/desktopManager";
import { getSidebarContext } from "../utils/sidebarContext";

function resolveDashboardCompanyId(
  user: ReturnType<typeof useCurrentUser>,
  currentUserMapping: { companyID?: number } | null,
  activeCompanyId?: number,
): number | undefined {
  if (activeCompanyId != null) return Number(activeCompanyId);

  const ctx = getSidebarContext();
  if (ctx?.companyID != null) return Number(ctx.companyID);

  const fromMapping = currentUserMapping?.companyID;
  if (fromMapping != null) return Number(fromMapping);

  if (user?.companyID != null) return Number(user.companyID);

  return undefined;
}

function resolveDashboardServiceProviderId(
  user: ReturnType<typeof useCurrentUser>,
  currentUserMapping: { serviceProviderID?: number } | null,
): number | undefined {
  const fromMapping = currentUserMapping?.serviceProviderID;
  if (fromMapping != null) return fromMapping;
  if (user?.serviceProviderID != null) return user.serviceProviderID;
  const ctx = getSidebarContext();
  if (ctx?.serviceProviderID != null) return ctx.serviceProviderID;
  return undefined;
}

function canLoadScopedDashboard(
  user: NonNullable<ReturnType<typeof useCurrentUser>>,
  currentUserMapping: { companyID?: number; serviceProviderID?: number } | null,
  isDesktopManagerEmployee: boolean,
): boolean {
  if (isDesktopManagerEmployee) return true;
  if (
    user.role === "EMPLOYEE" ||
    user.role === "BRANCH_ADMIN" ||
    user.role === "SUPERADMIN"
  ) {
    return true;
  }
  if (user.role === "COMPANY_ADMIN" || user.role === "ADMIN") {
    return resolveDashboardCompanyId(user, currentUserMapping) != null;
  }
  if (user.role === "SERVICE_PROVIDER") {
    return resolveDashboardServiceProviderId(user, currentUserMapping) != null;
  }
  return true;
}

interface Branch {
  id: number;
  companyID: number;
  branchName?: string | null;
  serviceProviderID?: number;
}

interface OverviewEmployee {
  id: number;
  employeeFirstName: string;
  employeeLastName: string;
  branchesID: number;
  departmentNameID: number | null;
  departmentName?: string | null;
  designationName?: string | null;
  inTime: string | null;
  outTime: string | null;
  statusType: string;
  statusLabel: string;
  statusDisplay: string;
  hasPunches: boolean;
  inLocation: string | null;
  outLocation: string | null;
}

interface OverviewSummary {
  total: number;
  present: number;
  absent: number;
  lateMark: number;
  halfDay: number;
  noCheckout: number;
  onLeave: number;
  weekOff: number;
  holiday: number;
  ot: number;
  regularized: number;
}

function statusBadgeClass(statusType: string): string {
  switch (statusType) {
    case "PRESENT":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
    case "LATE_MARK":
      return "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
    case "HALF_DAY":
      return "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300";
    case "ABSENT":
      return "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300";
    case "SINGLE_PUNCH":
      return "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300";
    case "OT":
      return "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300";
    case "REGULARIZATION":
      return "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300";
    case "LEAVE":
      return "bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300";
    case "WEEK_OFF":
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
    case "HOLIDAY":
      return "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

interface Employee {
  id: number;
  serviceProviderID: number;
  companyID: number;
  branchesID: number;
  employeeFirstName: string;
  employeeLastName: string;
  employeePhoto?: string;
  departmentNameID?: number | null;
}

interface AttendanceLog {
  id: number;
  employeeID: number;
  punchTimeStamp: string;
}

interface Department {
  id: number;
  serviceProviderID?: number;
  companyID: number;
  branchesID: number;
  departmentName?: string | null;
}

interface DepartmentHeadcount {
  id: number;
  departmentName: string;
  companyID: number | null;
  branchesID: number | null;
  employeeCount: number;
}

interface ActivityComment {
  id: number;
  name: string;
  headline: string;
  body: string;
  time: string;
  sortAt: number;
  avatarInitial: string;
  avatarBg: string;
}


export default function DashboardPage({ embeddedInEmpPortal = false }: { embeddedInEmpPortal?: boolean } = {}) {
  const user = useCurrentUser();

  const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const dashboardLoadGen = useRef(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [allAttendanceLogs, setAllAttendanceLogs] = useState<AttendanceLog[]>(
    []
  );
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentHeadcounts, setDepartmentHeadcounts] = useState<
    DepartmentHeadcount[]
  >([]);
  const [presentCount, setPresentCount] = useState(0);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [overviewEmployees, setOverviewEmployees] = useState<OverviewEmployee[]>([]);
  const [overviewSummary, setOverviewSummary] = useState<OverviewSummary | null>(null);
  const [overviewStatusCounts, setOverviewStatusCounts] = useState<Record<string, number>>({});
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewLoadError, setOverviewLoadError] = useState(false);
  const overviewLoadGen = useRef(0);
  const hasShownDashboardContent = useRef(false);
  const [todayDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  
  const [weekAgoDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  });

  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<number | undefined>(() => {
    const ctx = getSidebarContext();
    if (ctx?.companyID != null) return Number(ctx.companyID);

    if (typeof window !== "undefined") {
      const stored = Number(sessionStorage.getItem("activeCompanyID") || 0);
      if (stored) return stored;
    }

    return undefined;
  });
  const [desktopManager, setDesktopManager] = useState(false);
  const [probationAlerts, setProbationAlerts] = useState<
    {
      employeeId: number;
      employeeName: string;
      probationPeriod: string;
      probationEndDate: string;
      daysRemaining: number;
      isOverdue: boolean;
    }[]
  >([]);
  const [hrWidgets, setHrWidgets] = useState<{
    pendingCounts: {
      im: number;
      tasks: number;
      reimbursement: number;
      leave: number;
      salaryAdvance: number;
    };
    latestTasks: {
      id: number;
      taskCode: string;
      taskName: string;
      status: string;
      priority: string;
      dueDateTime: string | null;
      createdAt: string;
    }[];
    upcomingEvents: {
      id: string;
      kind: "birthday" | "anniversary";
      label: string;
      date: string;
      when: string;
    }[];
    newsFeed: {
      id: string;
      kind: "onboarding" | "holiday";
      title: string;
      subtitle: string;
      date: string;
    }[];
    recentActivities?: {
      id: string;
      kind: string;
      headline: string;
      body: string;
      time: string;
      href: string;
      avatarInitial: string;
    }[];
    newJoinersThisMonth?: number;
  } | null>(null);

  useEffect(() => {
    setDesktopManager(isDesktopManagerFlagSet());
  }, [user?.id]);

  const isDesktopManagerEmployee =
    desktopManager && user?.role === "EMPLOYEE";
  const isHrDesktopView =
    user?.role === "COMPANY_ADMIN" ||
    user?.role === "ADMIN" ||
    isDesktopManagerEmployee;

  useEffect(() => {
    if (!user) {
      setBootstrapReady(false);
      return;
    }

    const needsMapping =
      (user.role === "SERVICE_PROVIDER" ||
        user.role === "COMPANY_ADMIN" ||
        user.role === "ADMIN") &&
      !isDesktopManagerEmployee;

    if (!needsMapping) {
      setBootstrapReady(true);
      return;
    }

    setBootstrapReady(false);
    let cancelled = false;

    (async () => {
      try {
        const res = await fetchWithTimeout(`${BACKEND_URL}/users`, {
          headers: authHeaders(),
        });
        if (cancelled) return;
        const users = res.ok ? await res.json() : [];
        const me = Array.isArray(users)
          ? users.find((u: any) => u.username === user.username)
          : null;
        setCurrentUserMapping(me || null);
      } catch {
        if (!cancelled) setCurrentUserMapping(null);
      } finally {
        if (!cancelled) setBootstrapReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, BACKEND_URL, isDesktopManagerEmployee]);

  const resolvedCompanyId = useMemo(
    () => resolveDashboardCompanyId(user, currentUserMapping, activeCompanyId),
    [user, currentUserMapping, activeCompanyId],
  );
  const resolvedServiceProviderId = useMemo(
    () => resolveDashboardServiceProviderId(user, currentUserMapping),
    [user, currentUserMapping],
  );
  const canLoadDashboard = useMemo(
    () =>
      user != null &&
      canLoadScopedDashboard(user, currentUserMapping, isDesktopManagerEmployee),
    [user, currentUserMapping, isDesktopManagerEmployee],
  );

  useEffect(() => {
    if (!user || !canLoadDashboard) {
      setDashboardLoading(false);
      return;
    }
    loadDashboard();
  }, [user, currentUserMapping, resolvedCompanyId, resolvedServiceProviderId, canLoadDashboard, isDesktopManagerEmployee]);

  const overviewQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (user?.role === "SUPERADMIN") {
      if (resolvedCompanyId != null) {
        params.set("companyID", String(resolvedCompanyId));
      }
    } else if (user?.role === "SERVICE_PROVIDER" && resolvedServiceProviderId != null) {
      params.set("serviceProviderID", String(resolvedServiceProviderId));
      if (resolvedCompanyId != null) {
        params.set("companyID", String(resolvedCompanyId));
      }
    } else if (
      (user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN") &&
      resolvedCompanyId != null
    ) {
      params.set("companyID", String(resolvedCompanyId));
    } else if (isDesktopManagerEmployee) {
      if (resolvedCompanyId != null) params.set("companyID", String(resolvedCompanyId));
    } else if (user?.role === "EMPLOYEE" || user?.role === "BRANCH_ADMIN") {
      if (resolvedCompanyId != null) params.set("companyID", String(resolvedCompanyId));
      if (user.branchesID) params.set("branchId", String(user.branchesID));
    }
    if (selectedBranchId) params.set("branchId", selectedBranchId);
    if (selectedDepartmentId) params.set("departmentId", selectedDepartmentId);
    return params;
  }, [user, resolvedCompanyId, resolvedServiceProviderId, selectedBranchId, selectedDepartmentId, isDesktopManagerEmployee]);

  useEffect(() => {
    if (!user || !canLoadDashboard) {
      setOverviewLoading(false);
      return;
    }
    loadTodayOverview();
    loadProbationAlerts();
    if (isHrDesktopView) loadHrWidgets();
  }, [user, canLoadDashboard, overviewQueryParams.toString(), isHrDesktopView]);

   useEffect(() => {
    const onContextChange = () => {
      const ctx = getSidebarContext();
      const stored = Number(sessionStorage.getItem("activeCompanyID") || 0);
      const nextCompanyId = Number(ctx?.companyID || stored || 0);

      if (nextCompanyId) {
        setSelectedBranchId("");
        setSelectedDepartmentId("");
        setActiveCompanyId(nextCompanyId);
      }
    };

    window.addEventListener("sidebar-context-changed", onContextChange);
    window.addEventListener("app-data-refresh", onContextChange);

    return () => {
      window.removeEventListener("sidebar-context-changed", onContextChange);
      window.removeEventListener("app-data-refresh", onContextChange);
    };
  }, []);

  const fetchOverviewWithRetry = async (url: string, attempts = 3) => {
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const res = await fetchWithTimeout(
          url,
          { headers: authHeaders() },
          attempt === 0 ? 25_000 : 35_000,
        );
        if (res.ok) return res;
        lastError = new Error(`overview HTTP ${res.status}`);
      } catch (err) {
        lastError = err;
      }
      if (attempt < attempts - 1) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    throw lastError;
  };

  const loadHrWidgets = async () => {
    try {
      const qs = overviewQueryParams.toString();
      const url = `${BACKEND_URL}/dashboard-overview/hr-widgets${qs ? `?${qs}` : ""}`;
      const res = await fetchWithTimeout(url, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setHrWidgets(data);
    } catch {
      setHrWidgets(null);
    }
  };

  const loadProbationAlerts = async () => {
    try {
      const qs = overviewQueryParams.toString();
      const url = `${BACKEND_URL}/dashboard-overview/probation-alerts${qs ? `?${qs}&daysAhead=60` : "?daysAhead=60"}`;
      const res = await fetchWithTimeout(url, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setProbationAlerts(Array.isArray(data.alerts) ? data.alerts : []);
    } catch {
      setProbationAlerts([]);
    }
  };

  const loadTodayOverview = async () => {
    const gen = ++overviewLoadGen.current;
    setOverviewLoading(true);
    setOverviewLoadError(false);
    try {
      const qs = overviewQueryParams.toString();
      const url = `${BACKEND_URL}/dashboard-overview/today-overview${qs ? `?${qs}` : ""}`;
      const res = await fetchOverviewWithRetry(url);
      if (gen !== overviewLoadGen.current) return;
      const data = await res.json();
      setOverviewEmployees(Array.isArray(data.employees) ? data.employees : []);
      setOverviewSummary(data.summary || null);
      setOverviewStatusCounts(data.statusCounts || {});
      setPresentCount(data.summary?.present ?? 0);
    } catch (err) {
      if (gen !== overviewLoadGen.current) return;
      console.error("Today overview load error:", err);
      setOverviewLoadError(true);
    } finally {
      if (gen === overviewLoadGen.current) {
        setOverviewLoading(false);
      }
    }
  };

  const loadAttendanceLogsInBackground = async (
    gen: number,
    scopedEmployees: Employee[],
  ) => {
    try {
      const attLogsUrl = `${BACKEND_URL}/process-att-logs?dateFrom=${weekAgoDate}&dateTo=${todayDate}&limit=10000`;
      const processAttRes = await fetchWithTimeout(attLogsUrl, {
        headers: authHeaders(),
      });
      if (gen !== dashboardLoadGen.current) return;

      let processAttJson: { data?: unknown[] } | null = null;
      try {
        processAttJson = processAttRes.ok ? await processAttRes.json() : null;
      } catch {
        /* ignore */
      }
      const processAttData: unknown[] =
        processAttJson?.data && Array.isArray(processAttJson.data)
          ? processAttJson.data
          : [];
      const allAttendanceMerged: AttendanceLog[] = processAttData
        .filter(
          (p): p is { id?: number; manage_employee_id: number; punch_time: string } =>
            typeof p === "object" &&
            p != null &&
            (p as { manage_employee_id?: number }).manage_employee_id != null &&
            (p as { punch_time?: string }).punch_time != null,
        )
        .map((p) => {
          const formatted = formatDevicePunchForDisplay(p.punch_time);
          if (!formatted) return null;
          return {
            id: p.id || 0,
            employeeID: p.manage_employee_id,
            punchTimeStamp: formatted.punchTimeStamp,
          };
        })
        .filter((x): x is AttendanceLog => x != null);

      const todayLogs = allAttendanceMerged.filter((log) => {
        const date = log.punchTimeStamp.split(" ")[0];
        return (
          date === todayDate &&
          scopedEmployees.some((e) => e.id === log.employeeID)
        );
      });

      setAttendanceLogs(todayLogs);

      const scopedEmpIds = new Set(scopedEmployees.map((e) => e.id));
      setAllAttendanceLogs(
        allAttendanceMerged.filter((l) => scopedEmpIds.has(l.employeeID)),
      );
    } catch (err) {
      console.error("Attendance logs load error:", err);
    }
  };

  const loadDashboard = async () => {
    const gen = ++dashboardLoadGen.current;
    setDashboardLoading(true);
    try {
      const [empRes, deptRes, hcRes, branchesRes] = await Promise.allSettled([
        fetchWithTimeout(`${BACKEND_URL}/manage-emp/list`, {
          headers: authHeaders(),
        }),
        fetchWithTimeout(`${BACKEND_URL}/departments`, {
          headers: authHeaders(),
        }),
        fetchWithTimeout(`${BACKEND_URL}/departments/with-headcount`, {
          headers: authHeaders(),
        }),
        fetchWithTimeout(`${BACKEND_URL}/branches`, {
          headers: authHeaders(),
        }),
      ]);

      if (gen !== dashboardLoadGen.current) return;

      const empJson =
        empRes.status === "fulfilled" && empRes.value.ok
          ? await empRes.value.json()
          : [];
      const allEmployees: Employee[] = Array.isArray(empJson) ? empJson : [];
      const deptJson =
        deptRes.status === "fulfilled" && deptRes.value.ok
          ? await deptRes.value.json()
          : [];
      const allDepartments: Department[] = Array.isArray(deptJson) ? deptJson : [];
      const allHeadcounts: DepartmentHeadcount[] =
        hcRes.status === "fulfilled" && hcRes.value.ok
          ? await hcRes.value.json()
          : [];
      const allBranches: Branch[] =
        branchesRes.status === "fulfilled" && branchesRes.value.ok
          ? await branchesRes.value.json()
          : [];

      let scopedEmployees: Employee[] = [];
      let scopedDepartments: Department[] = [];
      let scopedBranches: Branch[] = [];

      if (user!.role === "SUPERADMIN") {
        scopedEmployees = allEmployees;
        scopedDepartments = allDepartments;
        scopedBranches = allBranches;
      } else if (user!.role === "SERVICE_PROVIDER" && resolvedServiceProviderId != null) {
        scopedEmployees = allEmployees.filter(
          (e) => e.serviceProviderID === resolvedServiceProviderId
        );
        scopedDepartments = allDepartments.filter(
          (d) => d.serviceProviderID === resolvedServiceProviderId
        );
        scopedBranches = allBranches.filter(
          (b) => b.serviceProviderID === resolvedServiceProviderId
        );
      } else if (
        (user!.role === "COMPANY_ADMIN" || user!.role === "ADMIN") &&
        resolvedCompanyId != null
      ) {
        scopedEmployees = allEmployees.filter(
          (e) => e.companyID === resolvedCompanyId
        );
        scopedDepartments = allDepartments.filter(
          (d) => d.companyID === resolvedCompanyId
        );
        scopedBranches = allBranches.filter(
          (b) => b.companyID === resolvedCompanyId
        );
      } else if (isDesktopManagerEmployee) {
        scopedEmployees = allEmployees.filter(
          (e) => e.companyID === user!.companyID,
        );
        scopedDepartments = allDepartments.filter(
          (d) => d.companyID === user!.companyID,
        );
        scopedBranches = allBranches.filter(
          (b) => b.companyID === user!.companyID,
        );
      } else if (user!.role === "EMPLOYEE") {
        scopedEmployees = allEmployees.filter(
          (e) =>
            e.companyID === user!.companyID && e.branchesID === user!.branchesID
        );
        scopedDepartments = allDepartments.filter(
          (d) =>
            d.companyID === user!.companyID && d.branchesID === user!.branchesID
        );
        scopedBranches = allBranches.filter(
          (b) =>
            b.companyID === user!.companyID && b.id === user!.branchesID
        );
      } else if (user!.role === "BRANCH_ADMIN") {
        scopedEmployees = allEmployees.filter(
          (e) =>
            e.companyID === user!.companyID && e.branchesID === user!.branchesID
        );
        scopedDepartments = allDepartments.filter(
          (d) =>
            d.companyID === user!.companyID && d.branchesID === user!.branchesID
        );
        scopedBranches = allBranches.filter(
          (b) =>
            b.companyID === user!.companyID && b.id === user!.branchesID
        );
        if (!selectedBranchId && user!.branchesID) {
          setSelectedBranchId(String(user!.branchesID));
        }
      }

      setEmployees(scopedEmployees);
      setDepartments(scopedDepartments);
      setBranches(scopedBranches);

      const scopedDeptIds = new Set(scopedDepartments.map((d) => d.id));
      const scopedHc = allHeadcounts.filter((h) => scopedDeptIds.has(h.id));
      setDepartmentHeadcounts(scopedHc);

      void loadAttendanceLogsInBackground(gen, scopedEmployees);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      if (gen === dashboardLoadGen.current) {
        setDashboardLoading(false);
      }
    }
  };

  useAppRefresh(() => {
    const ctx = getSidebarContext();
    const stored = Number(sessionStorage.getItem("activeCompanyID") || 0);
    const nextCompanyId = Number(ctx?.companyID || stored || 0);

    if (nextCompanyId) {
      setSelectedBranchId("");
      setSelectedDepartmentId("");
      setActiveCompanyId(nextCompanyId);
    }

    loadTodayOverview();
    loadProbationAlerts();
    if (isHrDesktopView) loadHrWidgets();
    loadDashboard();
  }, [user, currentUserMapping, activeCompanyId, overviewQueryParams.toString()]);

  

  const barData: SoftBarPoint[] = useMemo(() => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
    const days: SoftBarPoint[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayLabel = dayNames[d.getDay()];

      const logsForDay = allAttendanceLogs.filter(
        (l) => l.punchTimeStamp.split(" ")[0] === dateStr
      );
      const presentEmpIds = new Set(logsForDay.map((l) => l.employeeID));

      days.push({
        day: dayLabel,
        value: presentEmpIds.size,
      });
    }
    return days;
  }, [allAttendanceLogs]);

  const yesterdayPresent = useMemo(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yStr = y.toISOString().split("T")[0];
    const logs = allAttendanceLogs.filter(
      (l) => l.punchTimeStamp.split(" ")[0] === yStr
    );
    const ids = new Set(
      logs
        .filter((l) => employees.some((e) => e.id === l.employeeID))
        .map((l) => l.employeeID)
    );
    return ids.size;
  }, [allAttendanceLogs, employees]);

  const presentTrendVsYesterday = useMemo(() => {
    if (employees.length === 0) return 0;
    const delta = presentCount - yesterdayPresent;
    return Math.round((delta / employees.length) * 1000) / 10;
  }, [presentCount, yesterdayPresent, employees.length]);

 
  const filterDepartments = useMemo(() => {
    if (!selectedBranchId) return departments;
    const branchNum = Number(selectedBranchId);
    return departments.filter((d) => d.branchesID === branchNum);
  }, [departments, selectedBranchId]);

  const overviewTotal = overviewSummary?.total ?? overviewEmployees.length;
  const overviewPresent = overviewSummary?.present ?? presentCount;
  const overviewAbsent = overviewSummary?.absent ?? Math.max(0, overviewTotal - overviewPresent);
  const overviewStatsReady = overviewSummary != null;
  const formatOverviewStat = (value: number) =>
    overviewStatsReady
      ? value.toLocaleString()
      : overviewLoading
        ? "…"
        : "—";

  const statusBreakdown: StatusBreakdownItem[] = useMemo(() => {
    const labels: Record<string, { name: string; fill: string }> = {
      PRESENT: { name: "Present", fill: "#22c55e" },
      LATE_MARK: { name: "Late Mark", fill: "#f59e0b" },
      HALF_DAY: { name: "Half Day", fill: "#a855f7" },
      ABSENT: { name: "Absent", fill: "#fb7185" },
      SINGLE_PUNCH: { name: "No checkout", fill: "#6366f1" },
      OT: { name: "OT", fill: "#14b8a6" },
      REGULARIZATION: { name: "Regularized", fill: "#8b5cf6" },
      LEAVE: { name: "Leave", fill: "#ec4899" },
      WEEK_OFF: { name: "Week Off", fill: "#94a3b8" },
      HOLIDAY: { name: "Holiday", fill: "#0ea5e9" },
    };
    return Object.entries(overviewStatusCounts)
      .map(([type, value]) => {
        const meta = labels[type] || { name: type, fill: "#6b7280" };
        return { name: meta.name, value, fill: meta.fill };
      })
      .filter((x) => x.value > 0);
  }, [overviewStatusCounts]);

  const checkInAvatars = useMemo(() => {
    return overviewEmployees
      .filter((e) => e.hasPunches)
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        name: e.employeeFirstName || "?",
        initial: (e.employeeFirstName?.charAt(0) || "?").toUpperCase(),
      }));
  }, [overviewEmployees]);

  const commentFeed: ActivityComment[] = useMemo(() => {
    const avatarColors = [
      "bg-[#4f46e5]",
      "bg-[#4338ca]",
      "bg-indigo-500",
      "bg-blue-500",
      "bg-violet-500",
    ];

    const byEmployee = new Map<number, AttendanceLog[]>();
    for (const log of attendanceLogs) {
      const list = byEmployee.get(log.employeeID) ?? [];
      list.push(log);
      byEmployee.set(log.employeeID, list);
    }

    const items: ActivityComment[] = [];

    for (const [employeeID, logs] of byEmployee) {
      const sorted = [...logs].sort(
        (a, b) =>
          new Date(a.punchTimeStamp).getTime() -
          new Date(b.punchTimeStamp).getTime()
      );
      if (sorted.length === 0) continue;

      const emp = employees.find((e) => e.id === employeeID);
      const name = emp
        ? `${emp.employeeFirstName} ${emp.employeeLastName}`
        : `Employee #${employeeID}`;
      const firstName = name.split(" ")[0];

      if (sorted.length === 1) {
        const log = sorted[0];
        items.push({
          id: log.id,
          name,
          headline: `${firstName} · attendance`,
          body: "Checked in for today.",
          time: log.punchTimeStamp.split(" ")[1]?.slice(0, 5) || "—",
          sortAt: new Date(log.punchTimeStamp).getTime(),
          avatarInitial: name.charAt(0).toUpperCase(),
          avatarBg: avatarColors[items.length % avatarColors.length],
        });
        continue;
      }

      const lastLog = sorted[sorted.length - 1];
      items.push({
        id: lastLog.id,
        name,
        headline: `${firstName} · attendance`,
        body: "Checked out for today.",
        time: lastLog.punchTimeStamp.split(" ")[1]?.slice(0, 5) || "—",
        sortAt: new Date(lastLog.punchTimeStamp).getTime(),
        avatarInitial: name.charAt(0).toUpperCase(),
        avatarBg: avatarColors[items.length % avatarColors.length],
      });
    }

    return items.sort((a, b) => b.sortAt - a.sortAt).slice(0, 20);
  }, [attendanceLogs, employees]);

  const sparklineData = useMemo(() => barData.map((d) => d.value), [barData]);

  const dashboardInsights = useMemo(() => {
    const items: { label: string; value: string; tone?: "default" | "success" | "warning" | "info" }[] = [];
    if (overviewStatsReady) {
      items.push({ label: "Present today", value: String(overviewPresent), tone: "success" });
    }
    const pendingLeave = hrWidgets?.pendingCounts?.leave;
    if (typeof pendingLeave === "number" && pendingLeave > 0) {
      items.push({ label: "Pending leave", value: String(pendingLeave), tone: "warning" });
    }
    const birthdays = hrWidgets?.upcomingEvents?.filter((e) => e.kind === "birthday").length ?? 0;
    if (birthdays > 0) {
      items.push({ label: "Birthdays", value: String(birthdays), tone: "info" });
    }
    if (overviewStatsReady && overviewTotal > 0) {
      const rate = Math.round((overviewPresent / overviewTotal) * 1000) / 10;
      items.push({ label: "Attendance", value: `${rate}%`, tone: "default" });
    }
    return items;
  }, [overviewStatsReady, overviewPresent, hrWidgets, overviewTotal]);

  const activityItems: ActivityItem[] = useMemo(() => {
    const fromApi = (hrWidgets?.recentActivities ?? []).map((a) => ({
      id: a.id,
      headline: a.headline,
      body: a.body,
      time: a.time,
      avatarInitial: a.avatarInitial || "A",
      avatarBg:
        a.kind === "leave"
          ? "bg-amber-500"
          : a.kind === "attendance"
            ? "bg-emerald-500"
            : a.kind === "payroll"
              ? "bg-blue-500"
              : a.kind === "memo"
                ? "bg-violet-500"
                : a.kind === "task"
                  ? "bg-sky-500"
                  : a.kind === "employee"
                    ? "bg-indigo-500"
                    : "bg-primary",
      href: a.href,
    }));

    if (fromApi.length > 0) {
      return fromApi.slice(0, 12);
    }

    // Fallback if widgets have no recentActivities yet
    const fromComments: ActivityItem[] = commentFeed.map((c) => ({
      id: String(c.id),
      headline: c.headline,
      body: c.body,
      time: c.time,
      avatarInitial: c.avatarInitial,
      avatarBg: c.avatarBg,
      href: "/attendance-logs",
    }));
    const fromTasks = (hrWidgets?.latestTasks ?? []).slice(0, 3).map((t) => ({
      id: `task-${t.id}`,
      headline: `${t.taskCode} — ${t.taskName}`,
      body: `${t.status} · ${t.priority}`,
      time: "Task update",
      avatarInitial: "T",
      avatarBg: "bg-primary",
      href: "/task-projects",
    }));
    return [...fromTasks, ...fromComments].slice(0, 8);
  }, [commentFeed, hrWidgets]);

  const quickActions: QuickActionItem[] = useMemo(
    () => [
      { href: "/manage-employees", label: "Manage employees", description: "Create or edit staff records", icon: UserCog },
      { href: "/employee-memo", label: "Internal messaging", description: "Send memos and announcements", icon: MessageSquare },
      { href: "/termination", label: "Off boarding", description: "Process employee exits", icon: UserMinus },
      { href: "/attendance-regularisation", label: "Attendance regularization", description: "Review and approve punches", icon: CalendarCheck },
      { href: "/roster", label: "Workshift roster", description: "Plan shifts and schedules", icon: CalendarDays },
      { href: "/leave-applications", label: "Leave applications", description: "Review time-off requests", icon: CalendarX },
      { href: "/reimbursement", label: "Reimbursements", description: "Process expense claims", icon: Wallet },
      { href: "/salary-advance", label: "Salary advance", description: "Manage advance requests", icon: Banknote },
      { href: "/generate-salary", label: "Run payroll", description: "Generate monthly payroll", icon: IndianRupee },
      { href: "/attendance-reports", label: "Reports", description: "Attendance and HR analytics", icon: LineChart },
    ],
    [],
  );

  if (!dashboardLoading && !overviewLoading && bootstrapReady && user) {
    hasShownDashboardContent.current = true;
  }

  const isSuperadmin = user?.role === "SUPERADMIN";

  const showFullPageSkeleton =
    !user ||
    (!isSuperadmin &&
      (!bootstrapReady ||
        dashboardLoading ||
        (overviewLoading && !hasShownDashboardContent.current)));

  if (showFullPageSkeleton) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${cardShell} p-5 h-24`} />
          ))}
        </div>
        <div className={`${cardShell} p-6 h-48`} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className={`${cardShell} p-6 h-72`} />
            <div className={`${cardShell} p-6 h-52`} />
          </div>
          <div className={`${cardShell} p-6 h-96`} />
        </div>
      </div>
    );
  }

  if (isSuperadmin) {
    return (
      <div className="space-y-6 animate-fade-in">
        <DashboardHero firstName={user?.firstName || user?.username} isSuperadmin />
        <SuperadminPlatformDashboard />
      </div>
    );
  }

   const attRate =
    overviewTotal > 0
      ? Math.round((overviewPresent / overviewTotal) * 1000) / 10
      : 0;

  const absentCount = overviewAbsent;

  const deptBars = departmentHeadcounts
    .filter((d) => d.employeeCount > 0)
    .slice(0, 5)
    .map((d) => ({
      label: d.departmentName,
      value: d.employeeCount,
    }));

  const attendanceStatusSegments = statusBreakdown
    .slice(0, 4)
    .map((s) => ({
      label: s.name,
      value: s.value,
      color: s.fill,
    }));

  const pendingCounts = hrWidgets?.pendingCounts;

  const leavePendingSegments = pendingCounts
    ? [
        {
          label: "Leave",
          value: pendingCounts.leave ?? 0,
          color: "#2563eb",
        },
        {
          label: "Reimb.",
          value: pendingCounts.reimbursement ?? 0,
          color: "#7c3aed",
        },
        {
          label: "Advance",
          value: pendingCounts.salaryAdvance ?? 0,
          color: "#14b8a6",
        },
      ]
    : [{ label: "Pending", value: 0, color: "#f59e0b" }];

  if (user?.role === "COMPANY_ADMIN") {
    const newJoinersCount = hrWidgets?.newJoinersThisMonth ?? 0;

    return (
      <div className="animate-fade-in">
        {probationAlerts.length > 0 && (
          <div className="mb-6">
            <NoticeBanner
              variant="warning"
              title="Probation ending soon"
              description="Employees on probation whose period is ending within 60 days (based on employment status WEF and probation period)."
            >
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {probationAlerts.slice(0, 8).map((a) => (
                  <li key={a.employeeId} className="text-xs text-foreground flex flex-wrap gap-x-2 gap-y-0.5">
                    <Link href="/manage-employees" className="font-semibold text-primary hover:underline">
                      {a.employeeName}
                    </Link>
                    <span className="text-muted-foreground">· {a.probationPeriod} · ends {a.probationEndDate}</span>
                    <span className={a.isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}>
                      {a.isOverdue ? "(overdue)" : `(${a.daysRemaining} days left)`}
                    </span>
                  </li>
                ))}
              </ul>
            </NoticeBanner>
          </div>
        )}
        <CompanyAdminEnterpriseDashboard
          firstName={user?.firstName || user?.username || "Company Admin"}
          todayDate={todayDate}
          overviewTotal={overviewTotal}
          overviewPresent={overviewPresent}
          overviewAbsent={overviewAbsent}
          overviewOnLeave={overviewSummary?.onLeave ?? 0}
          overviewHalfDay={overviewSummary?.halfDay ?? 0}
          overviewStatsReady={overviewStatsReady}
          employeesCount={employees.length}
          presentTrendVsYesterday={presentTrendVsYesterday}
          newJoinersCount={newJoinersCount}
          statusBreakdown={statusBreakdown}
          attendanceTrend={barData}
          departmentHeadcounts={departmentHeadcounts.map((d) => ({
            name: d.departmentName,
            count: d.employeeCount,
          }))}
          upcomingEvents={hrWidgets?.upcomingEvents ?? []}
          newsFeed={hrWidgets?.newsFeed ?? []}
          latestTasks={hrWidgets?.latestTasks ?? []}
          activityItems={activityItems}
          pendingCounts={hrWidgets?.pendingCounts ?? null}
        />
      </div>
    );
  }

  return (
    <div className={`${sectionGap} animate-fade-in`}>
      <DashboardHero
        firstName={user?.firstName || user?.username}
        roleLabel={
          user?.role === "ADMIN"
            ? "Manager"
            : user?.role?.replace(/_/g, " ")
        }
        isSuperadmin={user?.role === "SUPERADMIN"}
        lastSyncMinutesAgo={overviewStatsReady ? 2 : null}
        insights={dashboardInsights}
      />
      {probationAlerts.length > 0 && (
        <NoticeBanner
          variant="warning"
          title="Probation ending soon"
          description="Employees on probation whose period is ending within 60 days (based on employment status WEF and probation period)."
        >
          <ul className="space-y-2 max-h-40 overflow-y-auto">
            {probationAlerts.slice(0, 8).map((a) => (
              <li key={a.employeeId} className="text-xs text-foreground flex flex-wrap gap-x-2 gap-y-0.5">
                <Link href="/manage-employees" className="font-semibold text-primary hover:underline">
                  {a.employeeName}
                </Link>
                <span className="text-muted-foreground">· {a.probationPeriod} · ends {a.probationEndDate}</span>
                <span className={a.isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}>
                  {a.isOverdue ? "(overdue)" : `(${a.daysRemaining} days left)`}
                </span>
              </li>
            ))}
          </ul>
        </NoticeBanner>
      )}
      {/* Create Company Card - SUPERADMIN only */}
      {user?.role === "SUPERADMIN" && (
        <section className={`${cardShell} p-6 sm:p-7`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Quick Actions</h2>
              <p className="text-sm text-gray-500 mt-1">Manage your organization</p>
            </div>
            <Link
              href="/company"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#4f46e5] text-white text-sm font-medium rounded-lg hover:bg-[#4338ca] transition-colors shadow-sm"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              Create Company
            </Link>
          </div>
        </section>
      )}
      <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 ${gridGap}`}>
        <StatCard
          stat={{
            label: "Employees",
            value: formatOverviewStat(overviewTotal),
            unit: "Total workforce",
            icon: Users,
            visualization: deptBars.length
              ? { type: "bars", items: deptBars }
              : { type: "sparkline", data: sparklineData, color: "#2563eb" },
            accentColor: "#2563eb",
          }}
        />
        <StatCard
          stat={{
            label: "Present today",
            value: formatOverviewStat(overviewPresent),
            icon: UserCheck,
            trend: overviewStatsReady ? presentTrendVsYesterday : undefined,
            unit: overviewStatsReady ? `${attRate}% attendance rate` : undefined,
            visualization: {
              type: "sparkline",
              data: sparklineData,
              color: "#22c55e",
            },
            iconClassName: "bg-emerald-500/10 text-emerald-600",
            accentColor: "#22c55e",
          }}
        />
        <StatCard
          stat={{
            label: "Absent today",
            value: formatOverviewStat(absentCount),
            icon: UserX,
            trend:
              overviewStatsReady && overviewTotal > 0
                ? -Math.round((absentCount / overviewTotal) * 100)
                : undefined,
            unit:
              overviewStatsReady && overviewTotal > 0
                ? `${Math.round((absentCount / overviewTotal) * 100)}% of workforce`
                : undefined,
            visualization: { type: "stacked", segments: attendanceStatusSegments },
            iconClassName: "bg-rose-500/10 text-rose-600",
            accentColor: "#f43f5e",
          }}
        />
        {isHrDesktopView && (
          <StatCard
            stat={{
              label: "Pending leave",
              value: hrWidgets?.pendingCounts?.leave ?? 0,
              unit: "Awaiting approval",
              icon: CalendarClock,
              trendDelta:
                (hrWidgets?.pendingCounts?.leave ?? 0) > 0
                  ? `▲ ${hrWidgets?.pendingCounts?.leave} open`
                  : undefined,
              visualization: { type: "progress", segments: leavePendingSegments },
              iconClassName: "bg-amber-500/10 text-amber-600",
              accentColor: "#f59e0b",
            }}
          />
        )}
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-3 ${gridGap} items-stretch`}>
        <div className="lg:col-span-2 flex flex-col gap-8 min-h-0">
          <section className={`${cardShell} p-7 sm:p-8 shrink-0`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className={panelTitle}>Overview</h2>
                <p className="text-[13px] text-muted-foreground mt-1">Workforce distribution and attendance mix</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {user.role !== "EMPLOYEE" && user.role !== "BRANCH_ADMIN" && (
                  <select
                    value={selectedBranchId}
                    onChange={(e) => {
                      setSelectedBranchId(e.target.value);
                      setSelectedDepartmentId("");
                    }}
                    className={filterSelectClass}
                    aria-label="Filter by branch"
                  >
                    <option value="">All branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.branchName || `Branch ${b.id}`}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  className={filterSelectClass}
                  aria-label="Filter by department"
                >
                  <option value="">All departments</option>
                  {filterDepartments.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.departmentName || `Department ${d.id}`}
                    </option>
                  ))}
                </select>
                {overviewLoading && (
                  <Icon icon="mdi:loading" className="w-4 h-4 animate-spin text-[#4f46e5]" />
                )}
              </div>
            </div>

            {overviewLoadError && !overviewStatsReady && (
              <NoticeBanner
                variant="warning"
                compact
                className="mb-4"
                actionLabel="Retry"
                onAction={() => loadTodayOverview()}
              >
                Overview data could not be loaded. This is usually temporary.
              </NoticeBanner>
            )}

            <div className="rounded-xl bg-muted/30 p-5 sm:p-6 mb-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Workforce distribution
              </p>
              <EmployeeStatusCharts
                total={overviewTotal}
                present={overviewPresent}
                absent={absentCount}
                statusBreakdown={statusBreakdown}
              />
            </div>

            {isHrDesktopView && (
              <div className="rounded-xl bg-muted/30 p-5 sm:p-6 mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Attendance trend · Last 7 days
                </p>
                <AttendanceTrendChart data={barData} className="h-[220px]" />
              </div>
            )}

            <p className="text-sm font-semibold text-foreground mb-4">
              {overviewPresent} checked in today
              {overviewSummary && overviewSummary.lateMark > 0
                ? ` · ${overviewSummary.lateMark} late mark`
                : ""}
              {overviewSummary && overviewSummary.halfDay > 0
                ? ` · ${overviewSummary.halfDay} half day`
                : ""}
            </p>
            <div className="flex items-center justify-between gap-4">
              <div className="flex -space-x-3">
                {checkInAvatars.length === 0 ? (
                  <span className="text-sm text-gray-400 pl-1">
                    No check-ins yet
                  </span>
                ) : (
                  checkInAvatars.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-col items-center min-w-[56px]"
                      title={a.name}
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-white text-sm font-bold flex items-center justify-center ring-[3px] ring-white shadow-sm">
                        {a.initial}
                      </div>
                      <span className="text-[10px] font-medium text-gray-500 mt-1.5 truncate max-w-[56px] text-center">
                        {a.name}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <Link
                href="/attendance-logs"
                className="shrink-0 w-11 h-11 rounded-full border border-[#e5e5e5] bg-white shadow-sm flex items-center justify-center text-gray-500 hover:bg-[#fafafa] transition-colors"
                aria-label="View all attendance"
              >
                <Icon icon="mdi:arrow-top-right" className="w-5 h-5" />
              </Link>
            </div>
          </section>

          {isHrDesktopView && (
            <section className={`${cardShell} p-6 sm:p-7 shrink-0`}>
              <h2 className={`${panelTitle} mb-4`}>Pending requests</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {[
                  { href: "/employee-memo", label: "Internal Messages (IM)", count: hrWidgets?.pendingCounts?.im },
                  { href: "/task-projects", label: "Tasks", count: hrWidgets?.pendingCounts?.tasks },
                  { href: "/reimbursement", label: "Reimbursement Applications", count: hrWidgets?.pendingCounts?.reimbursement },
                  { href: "/leave-applications", label: "Leave Applications", count: hrWidgets?.pendingCounts?.leave },
                  { href: "/salary-advance", label: "Salary Advance Applications", count: hrWidgets?.pendingCounts?.salaryAdvance },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={actionTileStackClass}
                  >
                    <span className="leading-snug">{item.label}</span>
                    {typeof item.count === "number" && item.count > 0 ? (
                      <span className="inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full bg-[#4f46e5] text-white text-[10px] font-bold px-1.5 tabular-nums">
                        {item.count > 99 ? "99+" : item.count}
                      </span>
                    ) : (
                      <span className="h-5" aria-hidden />
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {isHrDesktopView && (
            <section className={`${cardShell} p-6 sm:p-7 shrink-0`}>
              <h2 className={`${panelTitle} mb-2`}>News feed</h2>
              {hrWidgets?.newsFeed?.length ? (
                <ul className="space-y-3">
                  {hrWidgets.newsFeed.map((item) => (
                    <li key={item.id} className="flex gap-3 text-sm">
                      <div className={iconTileClass}>
                        <Icon
                          icon={item.kind === "holiday" ? "mdi:calendar-star" : "mdi:account-plus"}
                          className="w-4 h-4 text-primary"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No news updates right now</p>
              )}
            </section>
          )}

          {!isHrDesktopView && (
          <section className={`${cardShell} p-6 sm:p-7 flex flex-col flex-1 min-h-[240px]`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2 shrink-0">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                Attendance view
              </h2>
              <div className="flex items-center gap-2 rounded-full bg-[#f4f4f4] px-3 py-1.5 text-xs font-medium text-gray-600 border border-[#ebebeb]">
                <span>Last 7 days</span>
                <Icon icon="mdi:chevron-down" className="w-4 h-4" />
              </div>
            </div>
            <div className="flex-1 min-h-[200px]">
              <SoftBarChart data={barData} className="h-full min-h-[200px]" />
            </div>
          </section>
          )}
        </div>

        <div className="flex flex-col gap-5 h-full min-h-0">
          <section className={`${cardShell} p-4 sm:p-5 shrink-0`}>
            <h2 className="text-base font-semibold tracking-tight text-foreground mb-3">Quick actions</h2>
            <QuickActionGrid actions={quickActions} iconOnly />
          </section>

          <section className={`${cardShell} p-5 flex flex-col flex-1 min-h-[11rem]`}>
            <h2 className={`${panelTitle} mb-3 shrink-0`}>Recent activity</h2>
            <div className="flex-1 flex flex-col min-h-0">
              <ActivityFeed items={activityItems} fillHeight />
            </div>
          </section>

          {isHrDesktopView && (
            <section className={`${cardShell} p-5 flex flex-col flex-1 min-h-[9rem]`}>
              <h2 className={`${panelTitle} mb-3 shrink-0`}>Task list</h2>
              <div className="flex-1 flex flex-col min-h-0">
                {hrWidgets?.latestTasks?.length ? (
                  <ul className="space-y-2 flex-1 overflow-y-auto min-h-0">
                    {hrWidgets.latestTasks.map((t) => (
                      <li key={t.id}>
                        <Link href="/task-projects" className={listItemClass}>
                          <p className="text-xs font-semibold text-foreground leading-snug whitespace-normal break-words">
                            {t.taskCode} — {t.taskName}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {t.status} · {t.priority}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">No tasks to show</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {isHrDesktopView && (
            <section className={`${cardShell} p-5 flex flex-col flex-1 min-h-[9rem]`}>
              <h2 className={`${panelTitle} mb-3 shrink-0`}>
                Upcoming birthdays &amp; anniversary
              </h2>
              <div className="flex-1 flex flex-col min-h-0">
                {hrWidgets?.upcomingEvents?.length ? (
                  <ul className="space-y-2 flex-1 overflow-y-auto min-h-0">
                    {hrWidgets.upcomingEvents.map((ev) => (
                      <li
                        key={ev.id}
                        className="flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5"
                      >
                        <Icon
                          icon={ev.kind === "birthday" ? "mdi:cake-variant" : "mdi:medal"}
                          className="w-4 h-4 text-primary shrink-0 mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground leading-snug whitespace-normal break-words">
                            {ev.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground capitalize mt-0.5">{ev.kind} · {ev.when}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">No upcoming events</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {!isHrDesktopView && (
          <section className={`${cardShell} p-5 shrink-0`}>
            <h2 className="text-sm font-bold text-foreground tracking-tight mb-3">
              Today&apos;s summary
            </h2>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center">
                    <Icon icon="mdi:chart-line" className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Attendance rate</p>
                </div>
                <span className="text-sm font-bold text-foreground tabular-nums">{attRate}%</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Icon icon="mdi:account-group" className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Total headcount</p>
                </div>
                <span className="text-sm font-bold text-gray-900 tabular-nums">{overviewTotal}</span>
              </div>
              <div className="h-px bg-[#f0f0f0]" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Icon icon="mdi:office-building" className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Departments</p>
                </div>
                <span className="text-sm font-bold text-gray-900 tabular-nums">{departments.length}</span>
              </div>
              <div className="h-px bg-[#f0f0f0]" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                    <Icon icon="mdi:clock-alert-outline" className="w-4 h-4 text-rose-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Absent today</p>
                </div>
                <span className="text-sm font-bold text-rose-500 tabular-nums">{absentCount}</span>
              </div>
            </div>
          </section>
          )}
        </div>
      </div>

      <section className={`${cardShell} overflow-hidden`}>
        <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-sm font-bold text-foreground">
            Today&apos;s attendance
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {isHrDesktopView && user.role !== "BRANCH_ADMIN" && (
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setSelectedDepartmentId("");
                }}
                className={filterSelectClass}
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.branchName || `Branch ${b.id}`}
                  </option>
                ))}
              </select>
            )}
            {isHrDesktopView && (
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className={filterSelectClass}
              >
                <option value="">All departments</option>
                {filterDepartments.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.departmentName || `Department ${d.id}`}
                  </option>
                ))}
              </select>
            )}
            <span className="text-xs text-muted-foreground font-medium bg-muted border border-border px-3 py-1.5 rounded-full">
              {todayDate}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 border-0">
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-12">
                  #
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Name
                </TableHead>
                {isHrDesktopView && (
                  <>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Department
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Designation
                    </TableHead>
                  </>
                )}
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {isHrDesktopView ? "In time & Location" : "In"}
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {isHrDesktopView ? "Out time & Location" : "Out"}
                </TableHead>
                {!isHrDesktopView && (
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Location
                </TableHead>
                )}
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overviewEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isHrDesktopView ? 7 : 6} className="p-0">
                    <EmptyState
                      icon={Users}
                      title="No attendance records"
                      description={
                        overviewLoading
                          ? "Loading today's attendance data…"
                          : "Employees haven't checked in yet today."
                      }
                      actionLabel={overviewLoadError ? "Refresh" : "View employees"}
                      actionHref={overviewLoadError ? undefined : "/manage-employees"}
                      onAction={overviewLoadError ? () => loadTodayOverview() : undefined}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                overviewEmployees.map((e, i) => (
                    <TableRow
                      key={e.id}
                      className="hover:bg-muted/40 border-border"
                    >
                      <TableCell className="text-sm text-gray-500 font-medium">
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                            {e.employeeFirstName?.charAt(0)?.toUpperCase() ||
                              "?"}
                          </div>
                          <span className="text-[13px] font-semibold text-gray-800">
                            {e.employeeFirstName} {e.employeeLastName}
                          </span>
                        </div>
                      </TableCell>
                      {isHrDesktopView && (
                        <>
                          <TableCell className="text-sm text-gray-600">
                            {e.departmentName || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {e.designationName || "—"}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="text-sm text-gray-600">
                        <div className="font-mono tabular-nums">{e.inTime || "—"}</div>
                        {isHrDesktopView && e.inLocation && (
                          <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-2" title={e.inLocation}>
                            {e.inLocation}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        <div className="font-mono tabular-nums">{e.outTime || "—"}</div>
                        {isHrDesktopView && e.outLocation && (
                          <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-2" title={e.outLocation}>
                            {e.outLocation}
                          </div>
                        )}
                      </TableCell>
                      {!isHrDesktopView && (
                      <TableCell className="max-w-[260px]">
                        {e.inLocation || e.outLocation ? (
                          <div className="space-y-0.5">
                            {e.inLocation && (
                              <p className="text-[11px] text-gray-600 flex items-start gap-1" title={e.inLocation}>
                                <span className="text-emerald-500 font-bold shrink-0">IN</span>
                                <span className="line-clamp-1">{e.inLocation}</span>
                              </p>
                            )}
                            {e.outLocation && e.outLocation !== e.inLocation && (
                              <p className="text-[11px] text-gray-600 flex items-start gap-1" title={e.outLocation}>
                                <span className="text-rose-500 font-bold shrink-0">OUT</span>
                                <span className="line-clamp-1">{e.outLocation}</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </TableCell>
                      )}
                      <TableCell>
                        <StatusChip
                          statusType={e.statusType}
                          label={e.statusDisplay}
                          title={e.statusLabel}
                        />
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
