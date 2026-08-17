"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Clock, RotateCcw } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { cn } from "@/app/utils/cn";
import { EmpTeamStyleDataSection, useTeamListControls } from "./EmpTeamStyleDataSection";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type RegularisationRow = {
  id: number | string;
  attendanceDate?: string;
  day?: string | null;
  actualStatus?: string | null;
  requestedStatus?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  reason?: string | null;
  status?: string | null;
  manageEmployeeID?: number | null;
};

function authHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusBadgeClass(status?: string | null): string {
  const s = String(status || "").toLowerCase();
  if (s === "approved" || s === "regularized") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (s === "rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function displayStatus(status?: string | null): string {
  const s = String(status || "Pending").trim();
  if (!s) return "Pending";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function RegularisationCard({ row }: { row: RegularisationRow }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600">
          <RotateCcw className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{formatDate(row.attendanceDate)}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[
              row.day,
              row.actualStatus && `Was: ${row.actualStatus}`,
              row.requestedStatus && `Requested: ${row.requestedStatus}`,
            ]
              .filter(Boolean)
              .join(" · ") || "Attendance regularisation"}
          </p>
          {(row.checkInTime || row.checkOutTime) && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              {[row.checkInTime, row.checkOutTime].filter(Boolean).join(" → ")}
            </p>
          )}
          {row.reason ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.reason}</p>
          ) : null}
        </div>
      </div>
      <Badge variant="outline" className={cn("w-fit shrink-0", statusBadgeClass(row.status))}>
        <CalendarCheck2 className="mr-1 size-3.5" />
        {displayStatus(row.status)}
      </Badge>
    </div>
  );
}

/** Employee / team-member profile tab: list regularisation days for one employee. */
export function EmpProfileRegularisationView({
  employeeId: viewEmployeeId,
}: { employeeId?: number } = {}) {
  const [rows, setRows] = useState<RegularisationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState<number | null>(viewEmployeeId ?? null);
  const { viewMode, selectViewMode, searchQuery, setSearchQuery } =
    useTeamListControls(
      viewEmployeeId
        ? `emp-team-regularisation-view-${viewEmployeeId}`
        : "emp-profile-regularisation-view",
    );
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let empId: number | null = viewEmployeeId ?? null;
      if (!empId) {
        const userRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
        if (userRaw) {
          const user = JSON.parse(userRaw);
          empId = Number(user?.employee?.id ?? user?.employeeId ?? 0) || null;
        }
      }
      setEmployeeId(empId);

      const res = await fetch(`${BACKEND}/emp-attendance-regularise`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const data = res.ok ? await res.json() : [];
      const all = Array.isArray(data) ? (data as RegularisationRow[]) : [];
      const mine = empId
        ? all.filter((r) => Number(r.manageEmployeeID) === Number(empId))
        : [];
      setRows(mine);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [viewEmployeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((r) => {
      const status = String(r.status || "Pending").toLowerCase();
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        r.attendanceDate,
        r.day,
        r.actualStatus,
        r.requestedStatus,
        r.reason,
        r.status,
        r.checkInTime,
        r.checkOutTime,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, searchQuery, statusFilter]);

  const listContent = (
    <div className="space-y-2">
      {filtered.map((row) => (
        <RegularisationCard key={String(row.id)} row={row} />
      ))}
    </div>
  );

  const gridContent = (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((row) => (
        <RegularisationCard key={String(row.id)} row={row} />
      ))}
    </div>
  );

  return (
    <EmpTeamStyleDataSection
      title="Regularisation requests"
      subtitle={
        viewEmployeeId
          ? "Attendance regularisation days for this team member"
          : "Your attendance regularisation days and request status"
      }
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search regularisations…"
      filterContent={
        <>
          {[
            { id: "all", label: "All" },
            { id: "pending", label: "Pending" },
            { id: "approved", label: "Approved" },
            { id: "rejected", label: "Rejected" },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                statusFilter === opt.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </>
      }
      viewMode={viewMode}
      onViewModeChange={selectViewMode}
      loading={loading}
      empty={!loading && (!employeeId || filtered.length === 0)}
      emptyMessage={
        !employeeId
          ? "Unable to resolve employee profile."
          : "No regularisation requests."
      }
      listContent={listContent}
      gridContent={gridContent}
    />
  );
}
