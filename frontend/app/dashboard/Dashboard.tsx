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
import EmployeeStatusCharts from "./components/EmployeeStatusCharts";

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

  useEffect(() => {
    if (user?.role !== "MANAGER" && user?.role !== "COMPANY_ADMIN") return;

    (async () => {
      const res = await fetch(`${BACKEND_URL}/users`, { cache: "no-store" });
      const users = await res.json();
      const me = users.find((u: any) => u.username === user.username);
      setCurrentUserMapping(me || null);
    })();
  }, [user, BACKEND_URL]);

  useEffect(() => {
    if (!user) return;
    if ((user.role === "MANAGER" || user.role === "COMPANY_ADMIN") && !currentUserMapping) return;

    loadDashboard();
  }, [user, currentUserMapping]);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const [empRes, deptRes, hcRes, processAttRes] = await Promise.all([
        fetch(`${BACKEND_URL}/manage-emp`, { cache: "no-store" }),
        fetch(`${BACKEND_URL}/departments`, { cache: "no-store" }),
        fetch(`${BACKEND_URL}/departments/with-headcount`, {
          cache: "no-store",
        }),
        fetch(`${BACKEND_URL}/process-att-logs?dateFrom=${weekAgoDate}&dateTo=${todayDate}&limit=10000`, { cache: "no-store" }),
      ]);

      const empJson = await empRes.json();
      const allEmployees: Employee[] = Array.isArray(empJson) ? empJson : [];
      const deptJson = await deptRes.json();
      const allDepartments: Department[] = Array.isArray(deptJson) ? deptJson : [];
      const allHeadcounts: DepartmentHeadcount[] = hcRes.ok
        ? await hcRes.json()
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
          const pt = new Date(p.punch_time);
          const y = pt.getUTCFullYear();
          const mo = String(pt.getUTCMonth() + 1).padStart(2, '0');
          const d = String(pt.getUTCDate()).padStart(2, '0');
          const h = String(pt.getUTCHours()).padStart(2, '0');
          const mi = String(pt.getUTCMinutes()).padStart(2, '0');
          const s = String(pt.getUTCSeconds()).padStart(2, '0');
          return {
            id: p.id || 0,
            employeeID: p.manage_employee_id,
            punchTimeStamp: `${y}-${mo}-${d} ${h}:${mi}:${s}`,
          };
        });

      let scopedEmployees: Employee[] = [];
      let scopedDepartments: Department[] = [];

      if (user!.role === "SUPERADMIN") {
        scopedEmployees = allEmployees;
        scopedDepartments = allDepartments;
      } else if ((user!.role === "MANAGER" || user!.role === "COMPANY_ADMIN") && currentUserMapping) {
        if (currentUserMapping.companyID && currentUserMapping.branchesID) {
          scopedEmployees = allEmployees.filter(
            (e) =>
              e.companyID === currentUserMapping.companyID &&
              e.branchesID === currentUserMapping.branchesID
          );
          scopedDepartments = allDepartments.filter(
            (d) =>
              d.companyID === currentUserMapping.companyID &&
              d.branchesID === currentUserMapping.branchesID
          );
        } else if (currentUserMapping.companyID) {
          scopedEmployees = allEmployees.filter(
            (e) => e.companyID === currentUserMapping.companyID
          );
          scopedDepartments = allDepartments.filter(
            (d) => d.companyID === currentUserMapping.companyID
          );
        } else if (currentUserMapping.serviceProviderID) {
          scopedEmployees = allEmployees.filter(
            (e) => e.serviceProviderID === currentUserMapping.serviceProviderID
          );
          scopedDepartments = allDepartments.filter(
            (d) => d.serviceProviderID === currentUserMapping.serviceProviderID
          );
        }
      } else if (user!.role === "EMPLOYEE") {
        scopedEmployees = allEmployees.filter(
          (e) =>
            e.companyID === user!.companyID && e.branchesID === user!.branchesID
        );
        scopedDepartments = allDepartments.filter(
          (d) =>
            d.companyID === user!.companyID && d.branchesID === user!.branchesID
        );
      }

      setEmployees(scopedEmployees);
      setDepartments(scopedDepartments);

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

      const presentIds = new Set(todayLogs.map((l) => l.employeeID));
      setPresentCount(presentIds.size);
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

  const checkInAvatars = useMemo(() => {
    const presentIds = new Set(attendanceLogs.map((l) => l.employeeID));
    return employees
      .filter((e) => presentIds.has(e.id))
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        name: e.employeeFirstName || "?",
        initial:
          (e.employeeFirstName?.charAt(0) || "?").toUpperCase(),
      }));
  }, [employees, attendanceLogs]);

  const commentFeed: ActivityComment[] = useMemo(() => {
    const avatarColors = [
      "bg-[#4f46e5]",
      "bg-[#4338ca]",
      "bg-indigo-500",
      "bg-blue-500",
      "bg-violet-500",
    ];
    const sorted = [...attendanceLogs].sort(
      (a, b) =>
        new Date(b.punchTimeStamp).getTime() -
        new Date(a.punchTimeStamp).getTime()
    );

    return sorted.slice(0, 4).map((log, i) => {
      const emp = employees.find((e) => e.id === log.employeeID);
      const name = emp
        ? `${emp.employeeFirstName} ${emp.employeeLastName}`
        : `Employee #${log.employeeID}`;
      const time = log.punchTimeStamp.split(" ")[1]?.slice(0, 5) || "—";

      return {
        id: log.id,
        name,
        headline: `${name.split(" ")[0]} · attendance`,
        body: "Checked in for today.",
        time,
        avatarInitial: name.charAt(0).toUpperCase(),
        avatarBg: avatarColors[i % avatarColors.length],
      };
    });
  }, [attendanceLogs, employees]);

  if (!user || loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className={`${cardShell} p-6 h-48`} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className={`lg:col-span-2 ${cardShell} p-6 h-72`} />
          <div className={`${cardShell} p-6 h-72`} />
        </div>
      </div>
    );
  }

  const attRate =
    employees.length > 0
      ? Math.round((presentCount / employees.length) * 1000) / 10
      : 0;

  const absentCount = Math.max(0, employees.length - presentCount);
  const rosterCap = Math.max(employees.length, 1);

  return (
    <div className="space-y-5">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          <section className={`${cardShell} p-6 sm:p-7`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                Overview
              </h2>
              <div className="flex items-center gap-2 rounded-full bg-[#eef2ff] px-3 py-1.5 text-xs font-medium text-[#4338ca] border border-[#e5e7eb]">
                <span>Last month</span>
                <Icon icon="mdi:chevron-down" className="w-4 h-4" />
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
                    {employees.length.toLocaleString()}
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
                    {presentCount.toLocaleString()}
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
                    <span className="text-[11px] font-medium text-[#4338ca] bg-[#eef2ff] px-2.5 py-1 rounded-full">{employees.length > 0 ? Math.round((absentCount / employees.length) * 100) : 0}%</span>
                  </div>
                  <p className="text-3xl font-bold tracking-tight tabular-nums text-[#111827]">
                    {absentCount.toLocaleString()}
                  </p>
                  <p className="text-[13px] font-medium text-gray-500 mt-1">
                    Absent today
                  </p>
                  <div className="mt-3 h-1 w-full rounded-full bg-[#eef2ff] overflow-hidden">
                    <div className="h-full rounded-full bg-[#4f46e5] transition-[width] duration-500" style={{ width: `${employees.length > 0 ? Math.round((absentCount / employees.length) * 100) : 0}%`, minWidth: absentCount > 0 ? "4px" : undefined }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#e5e7eb] bg-[#fafafa]/60 p-4 sm:p-5 mb-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                Workforce mix
              </p>
              <EmployeeStatusCharts
                total={employees.length}
                present={presentCount}
                absent={absentCount}
              />
            </div>

            <p className="text-sm font-semibold text-gray-800 mb-4">
              {presentCount} new check-ins today!
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
        </div>

        <div className="space-y-5">
          <section className={`${cardShell} p-6`}>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight mb-5">
              Popular departments
            </h2>
            <ul className="space-y-4">
              {deptSpotlight.length === 0 ? (
                <li className="text-sm text-gray-400 py-6 text-center">
                  No department data yet
                </li>
              ) : (
                deptSpotlight.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 pb-4 border-b border-[#f0f0f0] last:border-0 last:pb-0"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#f0f0f0] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {d.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {d.count} employee{d.count !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="shrink-0 inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1">
                      Active
                    </span>
                  </li>
                ))
              )}
            </ul>
            <Link
              href="/departments"
              className="mt-6 w-full inline-flex items-center justify-center rounded-full border border-[#e5e7eb] py-3 text-sm font-semibold text-gray-800 hover:bg-[#fafafa] transition-colors"
            >
              All departments
            </Link>
          </section>

          <section className={`${cardShell} p-6`}>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight mb-5">
              Comments
            </h2>
            {commentFeed.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No comments yet
              </p>
            ) : (
              <ul className="space-y-5">
                {commentFeed.map((c) => (
                  <li key={c.id} className="flex gap-3">
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
            )}
          </section>

          <section className={`${cardShell} p-5`}>
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
                <span className="text-sm font-bold text-gray-900 tabular-nums">{employees.length}</span>
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
        </div>
      </div>

      <section className={`${cardShell} p-6 sm:p-7`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">
            Attendance view
          </h2>
          <div className="flex items-center gap-2 rounded-full bg-[#f4f4f4] px-3 py-1.5 text-xs font-medium text-gray-600 border border-[#ebebeb]">
            <span>Last 7 days</span>
            <Icon icon="mdi:chevron-down" className="w-4 h-4" />
          </div>
        </div>
        <SoftBarChart data={barData} />
      </section>

      <section className={`${cardShell} overflow-hidden`}>
        <div className="px-6 py-4 border-b border-[#f0f0f0] flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">
            Today&apos;s attendance
          </h2>
          <span className="text-xs text-gray-500 font-medium bg-[#f6f6f6] border border-[#ebebeb] px-3 py-1.5 rounded-full">
            {todayDate}
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#fafafa]/80 hover:bg-[#fafafa]/80 border-0">
                <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-12">
                  #
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Employee
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  In
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Out
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-10 text-sm text-gray-400"
                  >
                    No employees found
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((e, i) => {
                  const a = getAttendance(e.id);
                  return (
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
                      <TableCell className="text-sm text-gray-600 font-mono tabular-nums">
                        {a.inTime}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 font-mono tabular-nums">
                        {a.outTime}
                      </TableCell>
                      <TableCell>
                        {a.isPresent ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                            Present
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-50 text-orange-600">
                            Absent
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
