"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Network } from "lucide-react";
import { EmpDesktopPage } from "@/app/components/emp/desktop/EmpDesktopPage";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { resolveScopedCompanyId } from "@/app/utils/scopeContext";
import { getSidebarContext } from "@/app/utils/sidebarContext";
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

export default function CompanyHierarchyPage() {
  const user = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OrgChartData | null>(null);
  const [source, setSource] = useState<"api" | "mock">("mock");

  const companyID = useMemo(() => {
    const ctx = getSidebarContext();
    return resolveScopedCompanyId(user) ?? user?.companyID ?? ctx?.companyID ?? null;
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadOrgChartData(companyID);
      setData(result.data);
      setSource(result.source);
    } catch (e: any) {
      setError(e?.message || "Failed to load organization hierarchy");
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
          {source === "mock" ? (
            <p className="mb-2 shrink-0 text-xs text-slate-400">
              Showing sample org data. Live employees load from{" "}
              <code className="rounded bg-slate-100 px-1">GET /backend/company-hierarchy</code>.
            </p>
          ) : null}
          <OrgChart data={data} />
        </div>
      ) : null}
    </EmpDesktopPage>
  );
}
