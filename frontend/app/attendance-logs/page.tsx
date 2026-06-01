"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { PageLayout } from "../components/layout/PageLayout";
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

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface OverviewEmployee {
  id: number;
  employeeFirstName: string;
  employeeLastName: string;
  inTime: string | null;
  outTime: string | null;
  statusType: string;
  statusLabel: string;
  statusDisplay: string;
  hasPunches: boolean;
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
  const [rows, setRows] = useState<OverviewEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayDate, setTodayDate] = useState("");
  const [currentUserMapping, setCurrentUserMapping] = useState<{
    serviceProviderID?: number;
    companyID?: number;
    branchesID?: number;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.role === "BRANCH_ADMIN") {
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
  }, [user]);

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
    } else if (user.role === "BRANCH_ADMIN") {
      if (user.companyID) params.set("companyID", String(user.companyID));
      if (user.branchesID) params.set("branchId", String(user.branchesID));
    }

    const qs = params.toString();
    setLoading(true);
    fetch(`${BACKEND}/dashboard-overview/today-overview${qs ? `?${qs}` : ""}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const employees: OverviewEmployee[] = Array.isArray(data?.employees)
          ? data.employees
          : [];
        setRows(employees.filter(isPresentToday));
        setTodayDate(data?.date || new Date().toISOString().slice(0, 10));
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [user, currentUserMapping]);

  const countLabel = useMemo(() => `${rows.length} present today`, [rows.length]);

  return (
    <PageLayout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/dashboard"
            className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
            aria-label="Back to dashboard"
          >
            <Icon icon="mdi:arrow-left" className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Present today</h1>
            <p className="text-sm text-gray-500">
              Employees checked in today
              {todayDate ? ` · ${todayDate}` : ""}
            </p>
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
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-sm text-gray-400">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-sm text-gray-400">
                      No present employees today
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
                      <TableCell className="text-sm text-gray-600 font-mono tabular-nums">
                        {e.inTime || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 font-mono tabular-nums">
                        {e.outTime || "—"}
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
    </PageLayout>
  );
}
