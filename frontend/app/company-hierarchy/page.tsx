"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Network, Users, Building2, ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader } from "@/app/components/app/page-header";
import { listCardClass } from "@/app/components/app/list-ui-styles";
import { cn } from "@/app/utils/cn";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { authHeaders } from "@/lib/auth";
import { resolveScopedCompanyId } from "@/app/utils/scopeContext";
import { getSidebarContext } from "@/app/utils/sidebarContext";

type HierarchyEmployee = {
  id: number;
  employeeID: string | null;
  employeeFirstName: string | null;
  employeeLastName: string | null;
  employeePhotoUrl: string | null;
  branchName: string | null;
  departmentName: string | null;
  designationName: string | null;
  isTopLevel: boolean;
};

type HierarchyNode = {
  employee: HierarchyEmployee;
  children: HierarchyNode[];
};

type HierarchyResponse = {
  companyID: number;
  roots: HierarchyNode[];
  totals: {
    employees: number;
    roots: number;
    departments: number;
    designations: number;
  };
};

function displayName(e: HierarchyEmployee) {
  const name = `${e.employeeFirstName ?? ""} ${e.employeeLastName ?? ""}`.trim();
  return name || e.employeeID || `Employee #${e.id}`;
}

function NodeCard({
  node,
  depth = 0,
}: {
  node: HierarchyNode;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const e = node.employee;

  return (
    <div className={cn(depth > 0 && "ml-4 border-l border-border pl-4")}>
      <div className="mb-2 flex items-start gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
        {hasChildren ? (
          <button
            type="button"
            aria-label={open ? "Collapse" : "Expand"}
            onClick={() => setOpen((v) => !v)}
            className="mt-0.5 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <span className="mt-0.5 inline-flex size-7 items-center justify-center text-muted-foreground/40">
            •
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{displayName(e)}</p>
            {e.employeeID ? (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {e.employeeID}
              </span>
            ) : null}
            {e.isTopLevel ? (
              <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-800">
                Top level
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {[e.designationName, e.departmentName, e.branchName].filter(Boolean).join(" · ") ||
              "No designation / department / branch assigned"}
          </p>
        </div>
      </div>

      {open && hasChildren ? (
        <div className="space-y-2 pb-2">
          {node.children.map((child) => (
            <NodeCard key={child.employee.id} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function CompanyHierarchyPage() {
  const user = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HierarchyResponse | null>(null);

  const companyID = useMemo(() => {
    const ctx = getSidebarContext();
    return (
      resolveScopedCompanyId(user) ??
      user?.companyID ??
      ctx?.companyID ??
      null
    );
  }, [user]);

  const load = useCallback(async () => {
    if (!companyID) {
      setError("Company is not selected");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/backend/company-hierarchy?companyID=${companyID}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as HierarchyResponse;
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Failed to load company hierarchy");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyID]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={Network}
        title="Company Hierarchy"
        description="Visual reporting structure based on employees, departments, designations, and managers."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={cn(listCardClass, "flex items-center gap-3 p-4")}>
          <Users className="size-5 text-primary" />
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Employees</p>
            <p className="text-lg font-semibold">{data?.totals.employees ?? "—"}</p>
          </div>
        </div>
        <div className={cn(listCardClass, "flex items-center gap-3 p-4")}>
          <Network className="size-5 text-primary" />
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Top-level nodes</p>
            <p className="text-lg font-semibold">{data?.totals.roots ?? "—"}</p>
          </div>
        </div>
        <div className={cn(listCardClass, "flex items-center gap-3 p-4")}>
          <Building2 className="size-5 text-primary" />
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Departments</p>
            <p className="text-lg font-semibold">{data?.totals.departments ?? "—"}</p>
          </div>
        </div>
      </div>

      <div className={cn(listCardClass, "p-5")}>
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading hierarchy…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-destructive">{error}</p>
        ) : !data?.roots?.length ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No active employees found for this company.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="mb-4 text-[13px] text-muted-foreground">
              Built from reporting managers (Employee links). Employees without a branch and/or
              department are shown at the top level. Expand nodes to view reportees.
            </p>
            {data.roots.map((root) => (
              <NodeCard key={root.employee.id} node={root} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
