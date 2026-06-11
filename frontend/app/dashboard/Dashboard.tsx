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
import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import SoftBarChart from "./components/SoftBarChart";
import type { SoftBarPoint } from "./components/SoftBarChart";
import EmployeeStatusCharts, {
  type StatusBreakdownItem,
} from "./components/EmployeeStatusCharts";
import { formatDevicePunchForDisplay } from "../utils/devicePunchTime";
import { useAppRefresh } from "../hooks/useAppRefresh";
import { isDesktopManagerFlagSet } from "@/lib/desktopManager";

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
      return "bg-emerald-50 text-emerald-700";
    case "LATE_MARK":
      return "bg-amber-50 text-amber-700";
    case "HALF_DAY":
      return "bg-violet-50 text-violet-700";
    case "ABSENT":
      return "bg-orange-50 text-orange-600";
    case "SINGLE_PUNCH":
      return "bg-indigo-50 text-indigo-700";
    case "OT":
      return "bg-teal-50 text-teal-700";
    case "REGULARIZATION":
      return "bg-purple-50 text-purple-700";
    case "LEAVE":
      return "bg-pink-50 text-pink-700";
    case "WEEK_OFF":
      return "bg-slate-100 text-slate-600";
    case "HOLIDAY":
      return "bg-sky-50 text-sky-700";
    default:
      return "bg-gray-100 text-gray-700";
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

const cardShell =
  "bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] border border-[#e5e7eb]";

export default function DashboardPage() {
  const user = useCurrentUser();

  const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

  const [loading, setLoading] = useState(true);
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
  const [overviewLoading, setOverviewLoading] = useState(false);
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
  } | null>(null);

  useEffect(() => {
    setDesktopManager(isDesktopManagerFlagSet());
  }, [user?.id]);

  const isDesktopManagerEmployee =
    desktopManager && user?.role === "EMPLOYEE";
  const isHrDesktopView =
    user?.role === "COMPANY_ADMIN" || isDesktopManagerEmployee;

  useEffect(() => {
    if (user?.role !== "SERVICE_PROVIDER" && user?.role !== "COMPANY_ADMIN" && user?.role !== "ADMIN") return;

    (async () => {
      const res = await fetch(`${BACKEND_URL}/users`, { cache: "no-store" });
      const users = await res.json();
      const me = users.find((u: any) => u.username === user.username);
      setCurrentUserMapping(me || null);
    })();
  }, [user, BACKEND_URL]);

  useEffect(() => {
    if (!user) return;
    if (
      (user.role === "SERVICE_PROVIDER" ||
        user.role === "COMPANY_ADMIN" ||
        user.role === "ADMIN") &&
      !currentUserMapping &&
      !isDesktopManagerEmployee
    ) {
      return;
    }

    loadDashboard();
  }, [user, currentUserMapping, isDesktopManagerEmployee]);

  const overviewQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (user?.role === "SUPERADMIN") {
      // no company filter
    } else if (user?.role === "SERVICE_PROVIDER" && currentUserMapping?.serviceProviderID) {
      params.set("serviceProviderID", String(currentUserMapping.serviceProviderID));
      if (currentUserMapping.companyID) {
        params.set("companyID", String(currentUserMapping.companyID));
      }
    } else if (
      (user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN") &&
      currentUserMapping?.companyID
    ) {
      params.set("companyID", String(currentUserMapping.companyID));
    } else if (isDesktopManagerEmployee) {
      if (user?.companyID) params.set("companyID", String(user.companyID));
    } else if (user?.role === "EMPLOYEE" || user?.role === "BRANCH_ADMIN") {
      if (user.companyID) params.set("companyID", String(user.companyID));
      if (user.branchesID) params.set("branchId", String(user.branchesID));
    }
    if (selectedBranchId) params.set("branchId", selectedBranchId);
    if (selectedDepartmentId) params.set("departmentId", selectedDepartmentId);
    return params;
  }, [user, currentUserMapping, selectedBranchId, selectedDepartmentId]);

  useEffect(() => {
    if (!user) return;
    if (
      (user.role === "SERVICE_PROVIDER" ||
        user.role === "COMPANY_ADMIN" ||
        user.role === "ADMIN") &&
      !currentUserMapping &&
      !isDesktopManagerEmployee
    ) {
      return;
    }
    loadTodayOverview();
    loadProbationAlerts();
    if (isHrDesktopView) loadHrWidgets();
  }, [user, currentUserMapping, overviewQueryParams.toString(), isHrDesktopView]);

  const loadHrWidgets = async () => {
    try {
      const qs = overviewQueryParams.toString();
      const url = `${BACKEND_URL}/dashboard-overview/hr-widgets${qs ? `?${qs}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
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
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setProbationAlerts(Array.isArray(data.alerts) ? data.alerts : []);
    } catch {
      setProbationAlerts([]);
    }
  };

  const loadTodayOverview = async () => {
    try {
      setOverviewLoading(true);
      const qs = overviewQueryParams.toString();
      const url = `${BACKEND_URL}/dashboard-overview/today-overview${qs ? `?${qs}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("overview failed");
      const data = await res.json();
      setOverviewEmployees(Array.isArray(data.employees) ? data.employees : []);
      setOverviewSummary(data.summary || null);
      setOverviewStatusCounts(data.statusCounts || {});
      setPresentCount(data.summary?.present ?? 0);
    } catch (err) {
      console.error("Today overview load error:", err);
      setOverviewEmployees([]);
      setOverviewSummary(null);
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const [empRes, deptRes, hcRes, processAttRes, branchesRes] = await Promise.all([
        fetch(`${BACKEND_URL}/manage-emp`, { cache: "no-store" }),
        fetch(`${BACKEND_URL}/departments`, { cache: "no-store" }),
        fetch(`${BACKEND_URL}/departments/with-headcount`, {
          cache: "no-store",
        }),
        fetch(`${BACKEND_URL}/process-att-logs?dateFrom=${weekAgoDate}&dateTo=${todayDate}&limit=10000`, { cache: "no-store" }),
        fetch(`${BACKEND_URL}/branches`, { cache: "no-store" }),
      ]);

      const empJson = await empRes.json();
      const allEmployees: Employee[] = Array.isArray(empJson) ? empJson : [];
      const deptJson = await deptRes.json();
      const allDepartments: Department[] = Array.isArray(deptJson) ? deptJson : [];
      const allHeadcounts: DepartmentHeadcount[] = hcRes.ok
        ? await hcRes.json()
        : [];
      const allBranches: Branch[] = branchesRes.ok
        ? await branchesRes.json()
        : [];

      // Parse process_att_logs and convert to AttendanceLog format
      let processAttJson: any = null;
      try {
        processAttJson = processAttRes.ok ? await processAttRes.json() : null;
      } catch { /* ignore */ }
      const processAttData: any[] = processAttJson?.data && Array.isArray(processAttJson.data)
        ? processAttJson.data
        : [];
      const allAttendanceMerged: AttendanceLog[] = processAttData
        .filter((p: any) => p.manage_employee_id != null && p.punch_time != null)
        .map((p: any) => {
          const formatted = formatDevicePunchForDisplay(p.punch_time);
          if (!formatted) return null;
          return {
            id: p.id || 0,
            employeeID: p.manage_employee_id,
            punchTimeStamp: formatted.punchTimeStamp,
          };
        })
        .filter((x): x is AttendanceLog => x != null);

      let scopedEmployees: Employee[] = [];
      let scopedDepartments: Department[] = [];
      let scopedBranches: Branch[] = [];

      if (user!.role === "SUPERADMIN") {
        scopedEmployees = allEmployees;
        scopedDepartments = allDepartments;
        scopedBranches = allBranches;
      } else if (user!.role === "SERVICE_PROVIDER" && currentUserMapping) {
        if (currentUserMapping.serviceProviderID) {
          scopedEmployees = allEmployees.filter(
            (e) => e.serviceProviderID === currentUserMapping.serviceProviderID
          );
          scopedDepartments = allDepartments.filter(
            (d) => d.serviceProviderID === currentUserMapping.serviceProviderID
          );
          scopedBranches = allBranches.filter(
            (b) => b.serviceProviderID === currentUserMapping.serviceProviderID
          );
        }
      } else if ((user!.role === "COMPANY_ADMIN" || user!.role === "ADMIN") && currentUserMapping) {
        scopedEmployees = allEmployees.filter(
          (e) => e.companyID === currentUserMapping.companyID
        );
        scopedDepartments = allDepartments.filter(
          (d) => d.companyID === currentUserMapping.companyID
        );
        scopedBranches = allBranches.filter(
          (b) => b.companyID === currentUserMapping.companyID
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
        allAttendanceMerged.filter((l) => scopedEmpIds.has(l.employeeID))
      );
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useAppRefresh(() => {
    loadTodayOverview();
    loadProbationAlerts();
    if (isHrDesktopView) loadHrWidgets();
    loadDashboard();
  }, [user, currentUserMapping, overviewQueryParams.toString()]);

  const getAttendance = (empId: number) => {
    const logs = attendanceLogs
      .filter((l) => l.employeeID === empId)
      .sort(
        (a, b) =>
          new Date(a.punchTimeStamp).getTime() -
          new Date(b.punchTimeStamp).getTime()
      );

    if (logs.length === 0)
      return { inTime: "N/A", outTime: "N/A", isPresent: false };

    return {
      inTime: logs[0].punchTimeStamp.split(" ")[1]?.slice(0, 5) || "N/A",
      outTime:
        logs.length > 1
          ? logs[logs.length - 1].punchTimeStamp.split(" ")[1]?.slice(0, 5)
          : "N/A",
      isPresent: true,
    };
  };

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

  const deptSpotlight = useMemo(() => {
    if (departmentHeadcounts.length > 0) {
      return [...departmentHeadcounts]
        .filter((d) => d.employeeCount > 0)
        .sort((a, b) => b.employeeCount - a.employeeCount)
        .slice(0, 5)
        .map((d) => ({
          id: d.id,
          title: d.departmentName?.trim() || `Department ${d.id}`,
          count: d.employeeCount,
        }));
    }
    const counts = new Map<number, number>();
    for (const e of employees) {
      if (e.departmentNameID != null) {
        counts.set(
          e.departmentNameID,
          (counts.get(e.departmentNameID) || 0) + 1
        );
      }
    }
    return departments
      .map((d) => ({
        id: d.id,
        title: d.departmentName?.trim() || `Department ${d.id}`,
        count: counts.get(d.id) ?? 0,
      }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [departmentHeadcounts, departments, employees]);

  const filterDepartments = useMemo(() => {
    if (!selectedBranchId) return departments;
    const branchNum = Number(selectedBranchId);
    return departments.filter((d) => d.branchesID === branchNum);
  }, [departments, selectedBranchId]);

  const overviewTotal = overviewSummary?.total ?? overviewEmployees.length;
  const overviewPresent = overviewSummary?.present ?? presentCount;
  const overviewAbsent = overviewSummary?.absent ?? Math.max(0, overviewTotal - overviewPresent);

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

  if (!user || loading) {
    return (
      <div className="space-y-5 animate-pulse">
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

  const attRate =
    overviewTotal > 0
      ? Math.round((overviewPresent / overviewTotal) * 1000) / 10
      : 0;

  const absentCount = overviewAbsent;

  return (
    <div className="space-y-5">
      {probationAlerts.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Icon icon="mdi:alert-circle-outline" className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-amber-900">Probation ending soon</h2>
              <p className="text-xs text-amber-800 mt-1">
                Employees on probation whose period is ending within 60 days (based on employment status WEF and probation period).
              </p>
              <ul className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                {probationAlerts.slice(0, 8).map((a) => (
                  <li key={a.employeeId} className="text-xs text-amber-900 flex flex-wrap gap-x-2 gap-y-0.5">
                    <Link href="/manage-employees" className="font-semibold underline">
                      {a.employeeName}
                    </Link>
                    <span>· {a.probationPeriod} · ends {a.probationEndDate}</span>
                    <span className={a.isOverdue ? "text-red-700 font-semibold" : ""}>
                      {a.isOverdue ? "(overdue)" : `(${a.daysRemaining} days left)`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        <div className="lg:col-span-2 flex flex-col gap-5 min-h-0">
          <section className={`${cardShell} p-6 sm:p-7 shrink-0`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                Overview
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {user.role !== "EMPLOYEE" && user.role !== "BRANCH_ADMIN" && (
                  <select
                    value={selectedBranchId}
                    onChange={(e) => {
                      setSelectedBranchId(e.target.value);
                      setSelectedDepartmentId("");
                    }}
                    className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-gray-700 min-w-[140px]"
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
                  className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-gray-700 min-w-[140px]"
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* All Employees */}
              <div className="rounded-xl border border-[#e5e7eb] bg-white p-5">
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-[#eef2ff] flex items-center justify-center">
                      <Icon icon="mdi:account-group" className="w-5 h-5 text-[#4f46e5]" />
                    </div>
                    <span className="text-[11px] font-medium text-[#4338ca] bg-[#eef2ff] px-2.5 py-1 rounded-full">Total</span>
                  </div>
                  <p className="text-3xl font-bold tracking-tight tabular-nums text-[#111827]">
                    {overviewTotal.toLocaleString()}
                  </p>
                  <p className="text-[13px] font-medium text-gray-500 mt-1">
                    All employees
                  </p>
                  <div className="mt-3 h-1 w-full rounded-full bg-[#eef2ff] overflow-hidden">
                    <div className="h-full rounded-full bg-[#4f46e5] transition-[width] duration-500" style={{ width: "100%" }} />
                  </div>
                </div>
              </div>

              {/* Present Employees */}
              <div className="rounded-xl border border-[#e5e7eb] bg-white p-5">
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-[#eef2ff] flex items-center justify-center">
                      <Icon icon="mdi:account-check" className="w-5 h-5 text-[#4f46e5]" />
                    </div>
                    <span className="text-[11px] font-medium text-[#4338ca] bg-[#eef2ff] px-2.5 py-1 rounded-full">{attRate}%</span>
                  </div>
                  <p className="text-3xl font-bold tracking-tight tabular-nums text-[#111827]">
                    {overviewPresent.toLocaleString()}
                  </p>
                  <p className="text-[13px] font-medium text-gray-500 mt-1">
                    Present today
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-[#eef2ff] overflow-hidden">
                      <div className="h-full rounded-full bg-[#4f46e5] transition-[width] duration-500" style={{ width: `${attRate}%` }} />
                    </div>
                    <span className={`text-[11px] font-bold ${presentTrendVsYesterday >= 0 ? "text-[#4f46e5]" : "text-rose-500"}`}>
                      {presentTrendVsYesterday >= 0 ? "+" : ""}{presentTrendVsYesterday}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Absent Employees */}
              <div className="rounded-xl border border-[#e5e7eb] bg-white p-5">
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-[#eef2ff] flex items-center justify-center">
                      <Icon icon="mdi:account-remove" className="w-5 h-5 text-[#4f46e5]" />
                    </div>
                    <span className="text-[11px] font-medium text-[#4338ca] bg-[#eef2ff] px-2.5 py-1 rounded-full">{overviewTotal > 0 ? Math.round((absentCount / overviewTotal) * 100) : 0}%</span>
                  </div>
                  <p className="text-3xl font-bold tracking-tight tabular-nums text-[#111827]">
                    {absentCount.toLocaleString()}
                  </p>
                  <p className="text-[13px] font-medium text-gray-500 mt-1">
                    Absent today
                  </p>
                  <div className="mt-3 h-1 w-full rounded-full bg-[#eef2ff] overflow-hidden">
                    <div className="h-full rounded-full bg-[#4f46e5] transition-[width] duration-500" style={{ width: `${overviewTotal > 0 ? Math.round((absentCount / overviewTotal) * 100) : 0}%`, minWidth: absentCount > 0 ? "4px" : undefined }} />
                  </div>
                </div>
              </div>
            </div>

            {!isHrDesktopView && (
              <div className="rounded-xl border border-[#e5e7eb] bg-[#fafafa]/60 p-4 sm:p-5 mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  Workforce mix
                </p>
                <EmployeeStatusCharts
                  total={overviewTotal}
                  present={overviewPresent}
                  absent={absentCount}
                  statusBreakdown={statusBreakdown}
                />
              </div>
            )}

            <p className="text-sm font-semibold text-gray-800 mb-4">
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
              <h2 className="text-lg font-bold text-gray-900 tracking-tight mb-4">
                Pending requests
              </h2>
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
                    className="rounded-lg border border-[#ebebeb] px-3 py-2.5 text-xs font-semibold text-gray-800 hover:bg-[#fafafa] text-center relative"
                  >
                    <span>{item.label}</span>
                    {typeof item.count === "number" && item.count > 0 && (
                      <span className="ml-1.5 inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full bg-[#4f46e5] text-white text-[10px] font-bold px-1.5 tabular-nums">
                        {item.count > 99 ? "99+" : item.count}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {isHrDesktopView && (
            <section className={`${cardShell} p-6 sm:p-7 shrink-0`}>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight mb-2">
                News feed
              </h2>
              {hrWidgets?.newsFeed?.length ? (
                <ul className="space-y-3">
                  {hrWidgets.newsFeed.map((item) => (
                    <li key={item.id} className="flex gap-3 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-[#eef2ff] flex items-center justify-center shrink-0">
                        <Icon
                          icon={item.kind === "holiday" ? "mdi:calendar-star" : "mdi:account-plus"}
                          className="w-4 h-4 text-[#4f46e5]"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{item.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.subtitle}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No news updates right now</p>
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

        <div className="flex flex-col gap-5 min-h-0 h-full lg:min-h-full">
          <section className={`${cardShell} p-6 shrink-0`}>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight mb-4">
              Quick actions
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/manage-employees", label: "Manage employee", icon: "mdi:account-group" },
                { href: "/employee-memo", label: "Internal Messaging (IM)", icon: "mdi:message-text" },
                { href: "/termination", label: "Off boarding", icon: "mdi:account-off" },
                { href: "/attendance-regularisation", label: "Attendance regularization", icon: "mdi:calendar-check" },
                { href: "/roster", label: "Workshift roster", icon: "mdi:calendar-sync" },
                { href: "/leave-applications", label: "Leave application", icon: "mdi:calendar-remove" },
                { href: "/reimbursement", label: "Reimbursement", icon: "mdi:cash-refund" },
                { href: "/salary-advance", label: "Salary advance", icon: "mdi:cash-fast" },
                { href: "/generate-salary", label: "Run payroll", icon: "mdi:currency-inr" },
                { href: "/attendance-reports", label: "Reports", icon: "mdi:chart-line" },
              ].map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex items-center gap-2 rounded-lg border border-[#ebebeb] px-3 py-2.5 text-xs font-semibold text-gray-800 hover:bg-[#fafafa] transition-colors"
                >
                  <Icon icon={a.icon} className="w-4 h-4 text-[#4f46e5] shrink-0" />
                  <span className="leading-tight">{a.label}</span>
                </Link>
              ))}
            </div>
          </section>

          {!isHrDesktopView && (
          <section className={`${cardShell} p-6 flex flex-col min-h-0 flex-1 overflow-hidden`}>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight mb-3 shrink-0">
              Comments
            </h2>
            {commentFeed.length === 0 ? (
              <div className="flex flex-1 min-h-0 basis-0 items-center justify-center">
                <p className="text-sm text-gray-400 text-center">No comments yet</p>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 min-h-0 basis-0 pr-1 -mr-1">
                <ul className="space-y-5">
                  {commentFeed.map((c) => (
                    <li key={`${c.id}-${c.sortAt}`} className="flex gap-3">
                      <div
                        className={`w-10 h-10 rounded-full ${c.avatarBg} flex items-center justify-center text-white text-sm font-bold shrink-0`}
                      >
                        {c.avatarInitial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900">
                          {c.headline}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {c.time}
                        </p>
                        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                          {c.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
          )}

          {isHrDesktopView && (
            <section className={`${cardShell} p-6 shrink-0`}>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight mb-3">
                Task list
              </h2>
              {hrWidgets?.latestTasks?.length ? (
                <ul className="space-y-2">
                  {hrWidgets.latestTasks.map((t) => (
                    <li key={t.id}>
                      <Link
                        href="/task-projects"
                        className="block rounded-lg border border-[#ebebeb] px-3 py-2 hover:bg-[#fafafa]"
                      >
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {t.taskCode} — {t.taskName}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {t.status} · {t.priority}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No tasks to show</p>
              )}
            </section>
          )}

          {isHrDesktopView && (
            <section className={`${cardShell} p-6 shrink-0`}>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight mb-3">
                Upcoming birthdays &amp; anniversary
              </h2>
              {hrWidgets?.upcomingEvents?.length ? (
                <ul className="space-y-2">
                  {hrWidgets.upcomingEvents.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[#ebebeb] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{ev.label}</p>
                        <p className="text-[11px] text-gray-500 capitalize">{ev.kind} · {ev.when}</p>
                      </div>
                      <Icon
                        icon={ev.kind === "birthday" ? "mdi:cake-variant" : "mdi:medal"}
                        className="w-4 h-4 text-[#4f46e5] shrink-0"
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No upcoming events</p>
              )}
            </section>
          )}

          {!isHrDesktopView && (
          <section className={`${cardShell} p-5 shrink-0`}>
            <h2 className="text-sm font-bold text-gray-900 tracking-tight mb-3">
              Today&apos;s summary
            </h2>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Icon icon="mdi:chart-line" className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Attendance rate</p>
                </div>
                <span className="text-sm font-bold text-gray-900 tabular-nums">{attRate}%</span>
              </div>
              <div className="h-px bg-[#f0f0f0]" />
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
        <div className="px-6 py-4 border-b border-[#f0f0f0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900">
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
                className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-gray-700"
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
                className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-gray-700"
              >
                <option value="">All departments</option>
                {filterDepartments.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.departmentName || `Department ${d.id}`}
                  </option>
                ))}
              </select>
            )}
            <span className="text-xs text-gray-500 font-medium bg-[#f6f6f6] border border-[#ebebeb] px-3 py-1.5 rounded-full">
              {todayDate}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#fafafa]/80 hover:bg-[#fafafa]/80 border-0">
                <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-12">
                  #
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Name
                </TableHead>
                {isHrDesktopView && (
                  <>
                    <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      Department
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      Designation
                    </TableHead>
                  </>
                )}
                <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  {isHrDesktopView ? "In time & Location" : "In"}
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  {isHrDesktopView ? "Out time & Location" : "Out"}
                </TableHead>
                {!isHrDesktopView && (
                <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Location
                </TableHead>
                )}
                <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overviewEmployees.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isHrDesktopView ? 7 : 6}
                    className="text-center py-10 text-sm text-gray-400"
                  >
                    {overviewLoading ? "Loading attendance…" : "No employees found"}
                  </TableCell>
                </TableRow>
              ) : (
                overviewEmployees.map((e, i) => (
                    <TableRow
                      key={e.id}
                      className="hover:bg-[#fafafa]/80 border-[#f5f5f5]"
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
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${statusBadgeClass(e.statusType)}`}
                          title={e.statusLabel}
                        >
                          {e.statusDisplay}
                        </span>
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
