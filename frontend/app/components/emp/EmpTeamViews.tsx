"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Search, Users } from "lucide-react";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { reporteeDisplayName } from "@/app/utils/empManagerDisplay";
import { formatPunchTime } from "@/app/utils/empAttendanceHistory";
import { useEmpPortalDesktop } from "@/app/components/layout/EmpPortalShell";
import { EmpTeamApprovalsPanel } from "./EmpTeamApprovalsPanel";
import { EmpDesktopPage } from "./desktop/EmpDesktopPage";
import { cn } from "@/app/utils/cn";
import { fmtJoined } from "@/app/hooks/useEmpProfile";
import { authHeaders } from "@/lib/auth";
import { Input } from "@/app/components/ui/input";

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
  if (typeof window === "undefined") return "grid";
  return localStorage.getItem(TEAM_VIEW_MODE_KEY) === "list" ? "list" : "grid";
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
  const [searchOpen, setSearchOpen] = useState(false);
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

  const toggleSearch = () => {
    setSearchOpen((open) => {
      if (open) setSearchQuery("");
      return !open;
    });
  };

  const openMember = (id: number) => {
    router.push(`/empTeam/member/${id}`);
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading team…</p>;
  }

  if (!isManagerView) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">You do not have any direct reportees.</p>
      </div>
    );
  }

  const body = (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className={cn("font-bold text-foreground", isDesktop ? "text-xl" : "text-lg")}>My Team</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {searchQuery.trim()
              ? `${filteredMembers.length} of ${members.length} employee${members.length === 1 ? "" : "s"}`
              : `${members.length} employee${members.length === 1 ? "" : "s"}`}{" "}
            in {scope === "reportees" ? "your direct reports" : "your department"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {searchOpen ? (
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search by name or ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8"
              />
            </div>
          ) : null}

          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setScope("reportees")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                scope === "reportees"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Direct {scope === "reportees" && directCount != null ? directCount : ""}
            </button>
            <button
              type="button"
              onClick={() => setScope("team")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                scope === "team"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              All {scope === "team" ? members.length : ""}
            </button>
          </div>

          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
            <button
              type="button"
              aria-label="Grid view"
              onClick={() => selectViewMode("grid")}
              className={cn(
                "rounded-md p-2 transition-colors",
                viewMode === "grid"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              aria-label="List view"
              onClick={() => selectViewMode("list")}
              className={cn(
                "rounded-md p-2 transition-colors",
                viewMode === "list"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="size-4" />
            </button>
          </div>

          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
            <button
              type="button"
              aria-label="Search employees"
              onClick={toggleSearch}
              className={cn(
                "rounded-md p-2 transition-colors",
                searchOpen
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Search className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {statusLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading team members…</p>
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          {scope === "reportees"
            ? "No reportees linked yet. Assign team members from the employee form in admin."
            : "No other employees found in your department."}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          No employees match &ldquo;{searchQuery.trim()}&rdquo;.
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
                className="rounded-xl border border-border bg-card shadow-sm p-4 text-left hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <MemberAvatar member={m} className="size-12 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {m.employeeID || `ID ${m.id}`}
                    </p>
                    <p className="font-semibold text-foreground truncate">{name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {m.designation || "—"}
                    </p>
                  </div>
                </div>
                <p className={cn("text-xs font-semibold mt-3", statusTone(statusLabel))}>
                  {statusLabel}
                  {checkInLabel ? ` · ${checkInLabel}` : ""}
                </p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Employee</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                    Designation
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                    Email
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">
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
                      className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => openMember(m.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <MemberAvatar member={m} className="size-10 text-xs" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground font-mono">
                              {m.employeeID || m.id}
                            </p>
                            <p className="font-medium text-foreground truncate">{name}</p>
                          </div>
                        </div>
                      </td>
                      <td className={cn("px-4 py-3 font-semibold whitespace-nowrap", statusTone(statusLabel))}>
                        {statusLabel}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {m.designation || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell truncate max-w-[200px]">
                        {m.email || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                        {m.joiningDate ? fmtJoined(m.joiningDate) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
