"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Users } from "lucide-react";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { reporteeDisplayName } from "@/app/utils/empManagerDisplay";
import { formatPunchTime } from "@/app/utils/empAttendanceHistory";
import { useEmpPortalDesktop } from "@/app/components/layout/EmpPortalShell";
import { EmpTeamApprovalsPanel } from "./EmpTeamApprovalsPanel";
import { EmpDesktopPage } from "./desktop/EmpDesktopPage";
import { FilterBar, FilterSelect } from "@/app/components/app/filter-bar";
import { listCardClass, listIconButtonClass } from "@/app/components/app/list-ui-styles";
import { cn } from "@/app/utils/cn";
import { fmtJoined } from "@/app/hooks/useEmpProfile";
import { authHeaders } from "@/lib/auth";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export type TeamMemberRow = {
  id: number;
  employeeID?: string;
  employeeFirstName?: string;
  employeeLastName?: string;
  employeePhotoUrl?: string | null;
  email?: string | null;
  designation?: string | null;
  joiningDate?: string | null;
  isCheckedIn?: boolean;
  isAbsentToday?: boolean;
  checkInTime?: string | null;
  statusLabel?: string;
};

type TeamScope = "reportees" | "team";
type ViewMode = "grid" | "list";

const TEAM_VIEW_MODE_KEY = "emp-team-view-mode";

function readTeamViewMode(): ViewMode {
  if (typeof window === "undefined") return "list";
  return localStorage.getItem(TEAM_VIEW_MODE_KEY) === "grid" ? "grid" : "list";
}

function statusTone(label: string) {
  if (label === "Checked in") return "text-emerald-600";
  if (label === "Checked out") return "text-blue-600";
  if (label === "Absent") return "text-rose-600";
  return "text-amber-600";
}

function memberName(m: TeamMemberRow) {
  return reporteeDisplayName(m);
}

function MemberAvatar({ member, className }: { member: TeamMemberRow; className?: string }) {
  const name = memberName(member);
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?";

  if (member.employeePhotoUrl) {
    return (
      <img
        src={member.employeePhotoUrl}
        alt={name}
        className={cn("rounded-full object-cover bg-muted", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0",
        className,
      )}
    >
      {initials}
    </div>
  );
}

export function EmpTeamMyTeam() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktop = useEmpPortalDesktop();
  const { loading, isManagerView } = useEmpManagerScope();
  const initialScope: TeamScope =
    searchParams.get("scope") === "team" ? "team" : "reportees";
  const [scope, setScope] = useState<TeamScope>(initialScope);
  const [viewMode, setViewMode] = useState<ViewMode>(() => readTeamViewMode());
  const [searchQuery, setSearchQuery] = useState("");
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    const nextScope: TeamScope = searchParams.get("scope") === "team" ? "team" : "reportees";
    setScope(nextScope);
  }, [searchParams]);

  const selectViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem(TEAM_VIEW_MODE_KEY, mode);
    }
  };

  useEffect(() => {
    if (!isManagerView) return;
    setStatusLoading(true);
    const url =
      scope === "reportees"
        ? `${BACKEND}/emp-manager-scope/reportees-today-status`
        : `${BACKEND}/emp-manager-scope/team-today-status?scope=team`;

    fetch(url, { headers: authHeaders(), cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list =
          scope === "reportees"
            ? Array.isArray(data?.reportees)
              ? data.reportees
              : []
            : Array.isArray(data?.members)
              ? data.members
              : [];
        setMembers(list);
      })
      .finally(() => setStatusLoading(false));
  }, [isManagerView, scope]);

  const directCount = useMemo(
    () => (scope === "reportees" ? members.length : null),
    [scope, members.length],
  );

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const name = memberName(m).toLowerCase();
      const id = (m.employeeID || String(m.id)).toLowerCase();
      const email = (m.email || "").toLowerCase();
      const designation = (m.designation || "").toLowerCase();
      return (
        name.includes(q) || id.includes(q) || email.includes(q) || designation.includes(q)
      );
    });
  }, [members, searchQuery]);

  const openMember = (id: number) => {
    router.push(`/empTeam/member/${id}`);
  };

  const setScopeAndUrl = (next: TeamScope) => {
    setScope(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "team") params.set("scope", "team");
    else params.delete("scope");
    const qs = params.toString();
    router.replace(qs ? `/empTeam/my-team?${qs}` : "/empTeam/my-team");
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading team…</p>;
  }

  if (!isManagerView) {
    return (
      <div className="rounded-xl border border-[#e5eeff] bg-white p-8 text-center">
        <p className="text-muted-foreground">You do not have any direct reportees.</p>
      </div>
    );
  }

  const body = (
    <div className="space-y-4 page-content-enter">
      <FilterBar
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: "Search by name, ID, email…",
        }}
        filters={
          <FilterSelect
            id="team-scope"
            ariaLabel="Team scope"
            value={scope}
            onChange={(v) => setScopeAndUrl(v as TeamScope)}
            options={[
              {
                value: "reportees",
                label:
                  directCount != null
                    ? `My Reportees (${directCount})`
                    : "My Reportees",
              },
              {
                value: "team",
                label: `My Team (${members.length})`,
              },
            ]}
            width="w-52"
          />
        }
        filtersPlacement="popover"
        trailing={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              aria-label="Grid view"
              title="Grid view"
              onClick={() => selectViewMode("grid")}
              className={cn(listIconButtonClass, viewMode === "grid" && "bg-muted text-foreground")}
            >
              <LayoutGrid className="size-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label="List view"
              title="List view"
              onClick={() => selectViewMode("list")}
              className={cn(listIconButtonClass, viewMode === "list" && "bg-muted text-foreground")}
            >
              <List className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        }
      />

      {statusLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading team members…</p>
      ) : members.length === 0 ? (
        <div className={cn(listCardClass, "p-8 text-center text-muted-foreground")}>
          {scope === "reportees"
            ? "No reportees linked yet. Assign team members from the employee form in admin."
            : "No other employees found in your department."}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className={cn(listCardClass, "p-8 text-center text-muted-foreground")}>
          No employees match &ldquo;{searchQuery.trim()}&rdquo;.
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredMembers.map((m) => {
            const name = memberName(m);
            const statusLabel = m.statusLabel || "Yet to check-in";
            const checkInLabel =
              m.checkInTime && (m.isCheckedIn || m.statusLabel === "Checked out")
                ? formatPunchTime(m.checkInTime)
                : null;

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => openMember(m.id)}
                className={cn(
                  listCardClass,
                  "p-4 text-left transition-all hover:border-primary/30 hover:shadow-md",
                )}
              >
                <div className="flex items-start gap-3">
                  <MemberAvatar member={m} className="size-12 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {m.employeeID || `ID ${m.id}`}
                    </p>
                    <p className="truncate font-semibold text-foreground">{name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {m.designation || "—"}
                    </p>
                  </div>
                </div>
                <p className={cn("mt-3 text-xs font-semibold", statusTone(statusLabel))}>
                  {statusLabel}
                  {checkInLabel ? ` · ${checkInLabel}` : ""}
                </p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className={listCardClass}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left" data-hrms-table-header>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Status
                  </th>
                  <th className="hidden px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">
                    Designation
                  </th>
                  <th className="hidden px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">
                    Email
                  </th>
                  <th className="hidden px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => {
                  const name = memberName(m);
                  const statusLabel = m.statusLabel || "Yet to check-in";
                  return (
                    <tr
                      key={m.id}
                      className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                      onClick={() => openMember(m.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-[200px] items-center gap-3">
                          <MemberAvatar member={m} className="size-10 text-xs" />
                          <div className="min-w-0">
                            <p className="font-mono text-xs text-muted-foreground">
                              {m.employeeID || m.id}
                            </p>
                            <p className="truncate font-medium text-foreground">{name}</p>
                          </div>
                        </div>
                      </td>
                      <td className={cn("whitespace-nowrap px-4 py-3 font-semibold", statusTone(statusLabel))}>
                        {statusLabel}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {m.designation || "—"}
                      </td>
                      <td className="hidden max-w-[200px] truncate px-4 py-3 text-muted-foreground lg:table-cell">
                        {m.email || "—"}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground sm:table-cell">
                        {m.joiningDate ? fmtJoined(m.joiningDate) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-6 py-3 text-[13px] text-muted-foreground">
            Showing {filteredMembers.length} of {members.length}{" "}
            {members.length === 1 ? "record" : "records"}
          </div>
        </div>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <EmpDesktopPage title="My Team" description="View and manage your team members" icon={Users}>
        {body}
      </EmpDesktopPage>
    );
  }

  return body;
}

export function EmpTeamApprovalsHub() {
  return <EmpTeamApprovalsPanel />;
}
