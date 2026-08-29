"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Network } from "lucide-react";
import { EmpDesktopPage } from "@/app/components/emp/desktop/EmpDesktopPage";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { resolveScopedCompanyId } from "@/app/utils/scopeContext";
import { getActiveCompanyId, getSidebarContext } from "@/app/utils/sidebarContext";
import { loadOrgChartData } from "./org-chart/mapApiToOrgData";
import type { OrgChartData } from "./org-chart/types";

const OrgChart = dynamic(
  () => import("./org-chart/OrgChart").then((m) => m.OrgChart),
  {
    ssr: false,
    loading: () => (
      <p className="py-16 text-center text-sm text-slate-400">Loading organization chart…</p>
    ),
  },
);

function readHierarchyCompanyId(user: ReturnType<typeof useCurrentUser>): number | null {
  const resolved = resolveScopedCompanyId(user);
  const active = getActiveCompanyId();
  const ctx = getSidebarContext();
  const id = resolved ?? active ?? user?.companyID ?? ctx?.companyID ?? null;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function CompanyHierarchyPage() {
  const user = useCurrentUser();
  const [companyID, setCompanyID] = useState<number | null>(null);
  const [scopeReady, setScopeReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OrgChartData | null>(null);

  useEffect(() => {
    const refreshCompany = () => {
      setCompanyID(readHierarchyCompanyId(user));
      setScopeReady(true);
    };
    refreshCompany();
    window.addEventListener("sidebar-context-changed", refreshCompany);
    window.addEventListener("app-data-refresh", refreshCompany);
    return () => {
      window.removeEventListener("sidebar-context-changed", refreshCompany);
      window.removeEventListener("app-data-refresh", refreshCompany);
    };
  }, [user]);

  useEffect(() => {
    if (!scopeReady) return;
    let cancelled = false;
    const run = async () => {
      if (companyID == null) {
        setLoading(false);
        setError("Select a company to load its organization hierarchy.");
        setData(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await loadOrgChartData(companyID);
        if (cancelled) return;
        setData(result.data);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to load organization hierarchy");
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [companyID, scopeReady]);

  return (
    <EmpDesktopPage
      title="Organization Hierarchy"
      description="Interactive reporting tree of owners, departments, and teams."
      icon={Network}
      className="flex min-h-0 flex-1 flex-col space-y-0"
    >
      {loading ? (
        <p className="py-16 text-center text-sm text-slate-400">Loading hierarchy…</p>
      ) : error ? (
        <p className="py-16 text-center text-sm text-destructive">{error}</p>
      ) : data ? (
        <div className="flex min-h-[520px] flex-1 flex-col">
          {!data.employees.length ? (
            <p className="mb-2 shrink-0 text-xs text-muted-foreground">
              No employees found for {data.company.name}. Add employees in Employee Management to
              populate this chart.
            </p>
          ) : null}
          <OrgChart key={String(companyID)} data={data} />
        </div>
      ) : null}
    </EmpDesktopPage>
  );
}
