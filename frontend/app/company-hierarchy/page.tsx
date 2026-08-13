"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Network } from "lucide-react";
import { EmpDesktopPage } from "@/app/components/emp/desktop/EmpDesktopPage";
import { cn } from "@/app/utils/cn";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { authHeaders } from "@/lib/auth";
import { resolveScopedCompanyId } from "@/app/utils/scopeContext";
import { getSidebarContext } from "@/app/utils/sidebarContext";
import {
  CompanyHierarchyTree,
  type HierarchyPayload,
} from "./CompanyHierarchyTree";

type HierarchyResponse = HierarchyPayload & {
  totals: {
    employees: number;
    l1?: number;
    roots?: number;
    departments: number;
    designations: number;
  };
};

export default function CompanyHierarchyPage() {
  const user = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HierarchyResponse | null>(null);
  const [view, setView] = useState<"departments" | "employees">("departments");

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
    <EmpDesktopPage
      title="Company Hierarchy"
      description="Organisation tree of owners, departments, and reporting lines."
      icon={Network}
      actions={
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setView("departments")}
            className={cn(
              "rounded-full px-3 py-1.5",
              view === "departments" ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-50",
            )}
          >
            Department tree
          </button>
          <button
            type="button"
            onClick={() => setView("employees")}
            className={cn(
              "rounded-full px-3 py-1.5",
              view === "employees" ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-50",
            )}
          >
            Employee tree
          </button>
        </div>
      }
    >
      {loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading hierarchy…</p>
      ) : error ? (
        <p className="py-16 text-center text-sm text-destructive">{error}</p>
      ) : data ? (
        <CompanyHierarchyTree data={data} view={view} />
      ) : null}
    </EmpDesktopPage>
  );
}
