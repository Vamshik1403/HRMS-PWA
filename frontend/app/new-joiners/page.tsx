"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { getActiveCompanyId, getSidebarContext } from "../utils/sidebarContext";
import { resolveScopedCompanyId } from "../utils/scopeContext";
import { hasCompanyAccessFlag, isCompanyOwnerFlag } from "@/lib/companyAccess";
import { isDesktopManagerFlagSet } from "@/lib/desktopManager";
import { TableBodySkeleton } from "@/app/components/ui/TableBodySkeleton";
import { authHeaders } from "@/lib/auth";
import { EmpDesktopPage } from "../components/emp/desktop/EmpDesktopPage";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface NewJoinerRow {
  id: number;
  employeeCode: string | null;
  name: string;
  employeeFirstName: string;
  employeeLastName: string;
  joiningDate: string | null;
  createdAt: string;
  username: string | null;
  email: string | null;
  branchName: string | null;
  departmentName: string | null;
  designationName: string | null;
}

function formatCreatedAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value || "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function NewJoinersPage() {
  const user = useCurrentUser();
  const [rows, setRows] = useState<NewJoinerRow[]>([]);
  const [monthLabel, setMonthLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUserMapping, setCurrentUserMapping] = useState<{
    serviceProviderID?: number;
    companyID?: number;
    branchesID?: number;
  } | null>(null);

  const desktopManager =
    typeof window !== "undefined" &&
    isDesktopManagerFlagSet() &&
    user?.role === "EMPLOYEE";
  const [companyScopeTick, setCompanyScopeTick] = useState(0);

  useEffect(() => {
    const bump = () => setCompanyScopeTick((n) => n + 1);
    window.addEventListener("sidebar-context-changed", bump);
    window.addEventListener("app-data-refresh", bump);
    return () => {
      window.removeEventListener("sidebar-context-changed", bump);
      window.removeEventListener("app-data-refresh", bump);
    };
  }, []);

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
      fetch(`${BACKEND}/users`, { headers: authHeaders(), cache: "no-store" })
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
    const switchedCompanyId =
      resolveScopedCompanyId(user) ?? getActiveCompanyId() ?? undefined;
    const scopedCompanyId =
      switchedCompanyId ?? currentUserMapping?.companyID ?? user.companyID;
    const isEmployeeOperator =
      user.role === "EMPLOYEE" &&
      (isCompanyOwnerFlag() || hasCompanyAccessFlag() || desktopManager);

    if (isEmployeeOperator && !scopedCompanyId) {
      setRows([]);
      setMonthLabel("");
      setLoading(false);
      return;
    }

    if (user.role === "SUPERADMIN") {
      if (switchedCompanyId || ctx?.companyID) {
        params.set("companyID", String(switchedCompanyId ?? ctx?.companyID));
      }
    } else if (user.role === "SERVICE_PROVIDER") {
      const companyId = switchedCompanyId ?? currentUserMapping?.companyID;
      if (companyId) params.set("companyID", String(companyId));
    } else if (scopedCompanyId) {
      params.set("companyID", String(scopedCompanyId));
    }
    if (user.role === "BRANCH_ADMIN" && user.branchesID) {
      params.set("branchId", String(user.branchesID));
    }

    setLoading(true);
    fetch(`${BACKEND}/dashboard-overview/new-joiners${params.toString() ? `?${params}` : ""}`, {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        setMonthLabel(data?.month || "");
        setRows(Array.isArray(data?.employees) ? data.employees : []);
      })
      .catch(() => {
        setRows([]);
        setMonthLabel("");
      })
      .finally(() => setLoading(false));
  }, [user, currentUserMapping, desktopManager, companyScopeTick]);

  const countLabel = useMemo(() => {
    const n = rows.length;
    return `${n} new joiner${n === 1 ? "" : "s"}${monthLabel ? ` · ${monthLabel}` : ""}`;
  }, [rows.length, monthLabel]);

  return (
    <EmpDesktopPage
      title="New joiners"
      description={`Employees created this month${monthLabel ? ` · ${monthLabel}` : ""}`}
      icon={UserPlus}
      actions={
        <Link
          href="/manage-employees"
          className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Manage employees
        </Link>
      }
    >
      <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="text-sm font-semibold text-gray-800">{countLabel}</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-0 bg-[#fafafa]/80 hover:bg-[#fafafa]/80">
                <TableHead className="w-12 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  #
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Employee ID
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Department
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Designation
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Branch
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Created on
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableBodySkeleton cols={7} />
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-gray-400">
                    No new joiners this month
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((e, i) => (
                  <TableRow key={e.id} className="border-[#f5f5f5] hover:bg-[#fafafa]/80">
                    <TableCell className="text-sm font-medium text-gray-500">{i + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[10px] font-bold text-white">
                          {e.employeeFirstName?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-gray-800">{e.name}</p>
                          {e.email ? (
                            <p className="truncate text-[11px] text-gray-500">{e.email}</p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{e.employeeCode || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600">{e.departmentName || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600">{e.designationName || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600">{e.branchName || "—"}</TableCell>
                    <TableCell className="text-sm tabular-nums text-gray-600">
                      {formatCreatedAt(e.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </EmpDesktopPage>
  );
}
