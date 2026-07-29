"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { getSidebarContext } from "../utils/sidebarContext";
import { isDesktopManagerFlagSet } from "@/lib/desktopManager";
import { TableBodySkeleton } from "@/app/components/ui/TableBodySkeleton";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

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

interface Branch {
  id: number;
  branchName?: string | null;
  companyID?: number;
}

interface Department {
  id: number;
  departmentName?: string | null;
  branchesID?: number;
  companyID?: number;
}

function isPresentToday(e: OverviewEmployee): boolean {
  switch (e.statusType) {
    case "PRESENT":
    case "OT":
    case "LATE_MARK":
    case "SINGLE_PUNCH":
      return true;
    case "REGULARIZATION":
    case "HALF_DAY":
    case "HOLIDAY":
      return e.hasPunches;
    default:
      return false;
  }
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
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function AttendanceLogsPage() {
  const user = useCurrentUser();
  const searchParams = useSearchParams();
  const [allRows, setAllRows] = useState<OverviewEmployee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayDate, setTodayDate] = useState("");
  const initialPresence = (() => {
    const p = searchParams.get("presence");
    if (p === "absent" || p === "present" || p === "all") return p;
    return "present";
  })();
  const [presenceFilter, setPresenceFilter] = useState<"present" | "absent" | "all">(initialPresence);

  useEffect(() => {
    const p = searchParams.get("presence");
    if (p === "absent" || p === "present" || p === "all") {
      setPresenceFilter(p);
    }
  }, [searchParams]);

  const [branchFilter, setBranchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [currentUserMapping, setCurrentUserMapping] = useState<{
    serviceProviderID?: number;
    companyID?: number;
    branchesID?: number;
  } | null>(null);

  const desktopManager =
    typeof window !== "undefined" &&
    isDesktopManagerFlagSet() &&
    user?.role === "EMPLOYEE";

  useEffect(() => {
    if (!user) return;
    if (user.role === "BRANCH_ADMIN" || desktopManager) {
      setCurrentUserMapping({
        companyID: user.companyID,
        branchesID: user.branchesID,
        serviceProviderID: user.serviceProviderID,
      });
      return;
    }
    if (
      user.role === "SERVICE_PROVIDER" ||
      user.role === "COMPANY_ADMIN" ||
      user.role === "ADMIN"
    ) {
      fetch(`${BACKEND}/users`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : []))
        .then((users) => {
          const me = users.find((u: { username?: string }) => u.username === user.username);
          setCurrentUserMapping(me || null);
        })
        .catch(() => setCurrentUserMapping(null));
    }
  }, [user, desktopManager]);

  useEffect(() => {
    if (!user) return;
    if (
      (user.role === "SERVICE_PROVIDER" ||
        user.role === "COMPANY_ADMIN" ||
        user.role === "ADMIN") &&
      !currentUserMapping
    ) {
      return;
    }

    const params = new URLSearchParams();
    const ctx = getSidebarContext();
    if (user.role === "SUPERADMIN" && ctx?.companyID) {
      params.set("companyID", String(ctx.companyID));
    } else if (user.role === "SERVICE_PROVIDER" && currentUserMapping?.companyID) {
      params.set("companyID", String(currentUserMapping.companyID));
    } else if (
      (user.role === "COMPANY_ADMIN" || user.role === "ADMIN") &&
      currentUserMapping?.companyID
    ) {
      params.set("companyID", String(currentUserMapping.companyID));
    } else if (user.role === "BRANCH_ADMIN" || desktopManager) {
      if (user.companyID) params.set("companyID", String(user.companyID));
      if (user.role === "BRANCH_ADMIN" && user.branchesID) {
        params.set("branchId", String(user.branchesID));
      }
    }

    setLoading(true);
    Promise.all([
      fetch(`${BACKEND}/dashboard-overview/today-overview${params.toString() ? `?${params}` : ""}`, {
        cache: "no-store",
      }),
      fetch(`${BACKEND}/branches`, { cache: "no-store" }),
      fetch(`${BACKEND}/departments`, { cache: "no-store" }),
    ])
      .then(async ([overviewRes, branchRes, deptRes]) => {
        const data = overviewRes.ok ? await overviewRes.json() : null;
        const branchJson = branchRes.ok ? await branchRes.json() : [];
        const deptJson = deptRes.ok ? await deptRes.json() : [];
        setAllRows(Array.isArray(data?.employees) ? data.employees : []);
        setTodayDate(data?.date || new Date().toISOString().slice(0, 10));

        const companyId =
          user.role === "BRANCH_ADMIN" || desktopManager
            ? user.companyID
            : currentUserMapping?.companyID ?? ctx?.companyID;

        const scopedBranches = (Array.isArray(branchJson) ? branchJson : []).filter(
          (b: Branch) => !companyId || b.companyID === companyId,
        );
        const scopedDepts = (Array.isArray(deptJson) ? deptJson : []).filter(
          (d: Department) => !companyId || d.companyID === companyId,
        );
        setBranches(scopedBranches);
        setDepartments(scopedDepts);
      })
      .catch(() => {
        setAllRows([]);
        setBranches([]);
        setDepartments([]);
      })
      .finally(() => setLoading(false));
  }, [user, currentUserMapping, desktopManager]);

  const filterDepartments = useMemo(() => {
    if (!branchFilter) return departments;
    return departments.filter((d) => String(d.branchesID) === branchFilter);
  }, [departments, branchFilter]);

  const rows = useMemo(() => {
    return allRows.filter((e) => {
      if (presenceFilter === "present" && !isPresentToday(e)) return false;
      if (presenceFilter === "absent" && isPresentToday(e)) return false;
      if (branchFilter && String(e.branchesID) !== branchFilter) return false;
      if (departmentFilter && String(e.departmentNameID) !== departmentFilter) return false;
      return true;
    });
  }, [allRows, presenceFilter, branchFilter, departmentFilter]);

  const countLabel = useMemo(() => {
    if (presenceFilter === "absent") return `${rows.length} absent today`;
    if (presenceFilter === "all") return `${rows.length} employees today`;
    return `${rows.length} present today`;
  }, [rows.length, presenceFilter]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
              aria-label="Back to dashboard"
            >
              <Icon icon="mdi:arrow-left" className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Today&apos;s attendance</h1>
              <p className="text-sm text-gray-500">
                Employee punch logs
                {todayDate ? ` · ${todayDate}` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={presenceFilter}
              onChange={(e) =>
                setPresenceFilter(e.target.value as "present" | "absent" | "all")
              }
              className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-gray-700 min-w-[120px]"
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="all">All</option>
            </select>
            {user?.role !== "BRANCH_ADMIN" && (
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setDepartmentFilter("");
                }}
                className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-gray-700 min-w-[140px]"
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
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-gray-700 min-w-[140px]"
            >
              <option value="">All departments</option>
              {filterDepartments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.departmentName || `Department ${d.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-[#e5e7eb] bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">{countLabel}</span>
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
                  <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Department
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Designation
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    In time &amp; Location
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Out time &amp; Location
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableBodySkeleton cols={7} />
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-sm text-gray-400">
                      No employees match the selected filters
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((e, i) => (
                    <TableRow key={e.id} className="hover:bg-[#fafafa]/80 border-[#f5f5f5]">
                      <TableCell className="text-sm text-gray-500 font-medium">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                            {e.employeeFirstName?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <span className="text-[13px] font-semibold text-gray-800">
                            {e.employeeFirstName} {e.employeeLastName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {e.departmentName || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {e.designationName || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        <div className="font-mono tabular-nums">{e.inTime || "—"}</div>
                        {e.inLocation && (
                          <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-2" title={e.inLocation}>
                            {e.inLocation}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        <div className="font-mono tabular-nums">{e.outTime || "—"}</div>
                        {e.outLocation && (
                          <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-2" title={e.outLocation}>
                            {e.outLocation}
                          </div>
                        )}
                      </TableCell>
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
        </div>
      </div>
  );
}
