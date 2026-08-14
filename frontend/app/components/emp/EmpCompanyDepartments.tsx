"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LayoutGrid, List, Search } from "lucide-react";
import { useEmpPortalDesktop } from "@/app/components/layout/EmpPortalShell";
import { EmpDesktopPage } from "./desktop/EmpDesktopPage";
import { cn } from "@/app/utils/cn";
import { fmtJoined } from "@/app/hooks/useEmpProfile";
import { authHeaders } from "@/lib/auth";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { Input } from "@/app/components/ui/input";
import { reporteeDisplayName } from "@/app/utils/empManagerDisplay";
import { formatPunchTime } from "@/app/utils/empAttendanceHistory";
import type { TeamMemberRow } from "./EmpTeamViews";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type DepartmentGroup = {
  id: number;
  departmentName: string;
  employeeCount: number;
  employees: TeamMemberRow[];
};

type ViewMode = "grid" | "list";
type DeptFilter = "all" | number;

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

export function EmpCompanyDepartments() {
  const router = useRouter();
  const user = useCurrentUser();
  const isDesktop = useEmpPortalDesktop();
  const [departments, setDepartments] = useState<DepartmentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState<DeptFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const scopedRes = await fetch(`${BACKEND}/emp-manager-scope/company-departments`, {
          headers: authHeaders(),
          cache: "no-store",
        });
        const scopedData = scopedRes.ok ? await scopedRes.json() : { departments: [] };
        const scopedList: DepartmentGroup[] = Array.isArray(scopedData?.departments)
          ? scopedData.departments
          : [];

        let companyID = user?.companyID;
        if (!companyID && user?.username) {
          const credRes = await fetch(
            `${BACKEND}/manage-emp/credentials/${encodeURIComponent(user.username)}`,
            { headers: authHeaders(), cache: "no-store" },
          );
          if (credRes.ok) {
            const creds = await credRes.json();
            companyID = creds?.companyID ?? creds?.employee?.companyID ?? companyID;
          }
        }

        const byName = new Map<string, DepartmentGroup>();

        const addDept = (d: DepartmentGroup) => {
          const key = (d.departmentName || "").trim().toLowerCase() || `id-${d.id}`;
          const existing = byName.get(key);
          if (!existing) {
            const employees = [...(d.employees || [])];
            byName.set(key, {
              ...d,
              departmentName: d.departmentName || "Unnamed department",
              employees,
              employeeCount: employees.length,
            });
            return;
          }
          const seen = new Set(existing.employees.map((e) => e.id));
          for (const e of d.employees || []) {
            if (seen.has(e.id)) continue;
            existing.employees.push(e);
            seen.add(e.id);
          }
          existing.employeeCount = existing.employees.length;
          if (existing.id === 0 && d.id !== 0) existing.id = d.id;
        };

        for (const d of scopedList) addDept(d);

        if (companyID) {
          const [catalogRes, branchesRes] = await Promise.all([
            fetch(`${BACKEND}/departments`, {
              headers: authHeaders(),
              cache: "no-store",
            }),
            fetch(`${BACKEND}/branches`, {
              headers: authHeaders(),
              cache: "no-store",
            }),
          ]);

          const branchIds = new Set<number>();
          if (branchesRes.ok) {
            const branches = await branchesRes.json();
            if (Array.isArray(branches)) {
              for (const b of branches) {
                if (Number(b.companyID) === Number(companyID)) branchIds.add(b.id);
              }
            }
          }

          if (catalogRes.ok) {
            const catalog = await catalogRes.json();
            if (Array.isArray(catalog)) {
              for (const d of catalog) {
                const inCompany =
                  Number(d.companyID) === Number(companyID) ||
                  (d.branchesID != null && branchIds.has(Number(d.branchesID)));
                if (!inCompany) continue;
                addDept({
                  id: d.id,
                  departmentName: d.departmentName ?? "Unnamed department",
                  employeeCount: 0,
                  employees: [],
                });
              }
            }
          }
        }

        if (!cancelled) {
          setDepartments(
            [...byName.values()].sort((a, b) => a.departmentName.localeCompare(b.departmentName)),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.companyID, user?.username]);

  const populatedDepartments = useMemo(
    () => departments.filter((d) => d.employees.length > 0),
    [departments],
  );

  const filterDepartments = useMemo(
    () => departments.filter((d) => d.id !== 0),
    [departments],
  );

  const allEmployees = useMemo(
    () =>
      populatedDepartments.flatMap((d) =>
        d.employees.map((e) => ({ ...e, departmentName: d.departmentName })),
      ),
    [populatedDepartments],
  );

  const totalEmployees = allEmployees.length;

  const visibleEmployees = useMemo(() => {
    const base =
      deptFilter === "all"
        ? allEmployees
        : allEmployees.filter((e) => {
            const dept = departments.find((d) => d.id === deptFilter);
            return dept?.employees.some((emp) => emp.id === e.id);
          });

    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;

    return base.filter((m) => {
      const name = memberName(m).toLowerCase();
      const id = (m.employeeID || String(m.id)).toLowerCase();
      const email = (m.email || "").toLowerCase();
      const designation = (m.designation || "").toLowerCase();
      const department = (m.departmentName || "").toLowerCase();
      return (
        name.includes(q) ||
        id.includes(q) ||
        email.includes(q) ||
        designation.includes(q) ||
        department.includes(q)
      );
    });
  }, [allEmployees, departments, deptFilter, searchQuery]);

  const toggleSearch = () => {
    setSearchOpen((open) => {
      if (open) setSearchQuery("");
      return !open;
    });
  };

  const openMember = (id: number) => {
    router.push(`/empTeam/member/${id}`);
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {searchOpen ? (
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search by name, ID, dept…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
      ) : null}

      <div className="inline-flex max-w-full overflow-x-auto rounded-lg border border-border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setDeptFilter("all")}
          className={cn(
            "shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            deptFilter === "all"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          All{totalEmployees ? ` ${totalEmployees}` : ""}
        </button>
        {filterDepartments.map((dept) => (
          <button
            key={dept.id}
            type="button"
            onClick={() => setDeptFilter(dept.id)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors max-w-[10rem] truncate",
              deptFilter === dept.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            title={dept.departmentName}
          >
            {dept.departmentName}
            {deptFilter === dept.id ? ` ${dept.employeeCount}` : ""}
          </button>
        ))}
      </div>

      {!isDesktop ? (
        <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
          <button
            type="button"
            aria-label="Grid view"
            onClick={() => setViewMode("grid")}
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
            onClick={() => setViewMode("list")}
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
      ) : null}

      <button
        type="button"
        aria-label="Search employees"
        onClick={toggleSearch}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-lg border border-border bg-muted/30 transition-colors",
          searchOpen
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Search className="size-4" />
      </button>
    </div>
  );

  const tableEmployees =
    deptFilter === "all" && !searchQuery.trim()
      ? allEmployees
      : visibleEmployees;

  const content = (
    <>
      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading departments…</p>
      ) : departments.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          No departments configured for your company yet.
        </div>
      ) : isDesktop ? (
        tableEmployees.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            {searchQuery.trim()
              ? `No employees match "${searchQuery.trim()}".`
              : "No employees found in this department."}
          </div>
        ) : (
          <EmployeeList
            employees={tableEmployees}
            onOpen={openMember}
            showDepartment
          />
        )
      ) : deptFilter === "all" && !searchQuery.trim() ? (
        populatedDepartments.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            No employees assigned to departments yet.
          </div>
        ) : (
          <div className="space-y-4">
            {populatedDepartments.map((dept) => (
              <section key={dept.id} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-foreground">{dept.departmentName}</h3>
                  <span className="text-xs text-muted-foreground">
                    {dept.employeeCount} employee{dept.employeeCount === 1 ? "" : "s"}
                  </span>
                </div>
                {viewMode === "grid" ? (
                  <EmployeeGrid employees={dept.employees} onOpen={openMember} />
                ) : (
                  <EmployeeList employees={dept.employees} onOpen={openMember} showDepartment={false} />
                )}
              </section>
            ))}
          </div>
        )
      ) : visibleEmployees.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          {searchQuery.trim()
            ? `No employees match "${searchQuery.trim()}".`
            : "No employees found in this department."}
        </div>
      ) : viewMode === "grid" ? (
        <EmployeeGrid employees={visibleEmployees} onOpen={openMember} />
      ) : (
        <EmployeeList
          employees={visibleEmployees}
          onOpen={openMember}
          showDepartment={deptFilter === "all"}
        />
      )}
    </>
  );

  if (isDesktop) {
    return (
      <EmpDesktopPage
        title="Departments"
        description="Browse company departments and their employees"
        icon={Building2}
        className="space-y-3"
      >
        {toolbar}
        {content}
      </EmpDesktopPage>
    );
  }

  return (
    <div className="space-y-3">
      {toolbar}
      {content}
    </div>
  );
}

function EmployeeGrid({
  employees,
  onOpen,
}: {
  employees: (TeamMemberRow & { departmentName?: string })[];
  onOpen: (id: number) => void;
}) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {employees.map((m) => {
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
            onClick={() => onOpen(m.id)}
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
  );
}

function EmployeeList({
  employees,
  onOpen,
  showDepartment,
}: {
  employees: (TeamMemberRow & { departmentName?: string })[];
  onOpen: (id: number) => void;
  showDepartment: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground">Employee</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
              {showDepartment ? (
                <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                  Department
                </th>
              ) : null}
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
            {employees.map((m) => {
              const name = memberName(m);
              const statusLabel = m.statusLabel || "Yet to check-in";
              return (
                <tr
                  key={m.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => onOpen(m.id)}
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
                  {showDepartment ? (
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {m.departmentName || "—"}
                    </td>
                  ) : null}
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
  );
}
