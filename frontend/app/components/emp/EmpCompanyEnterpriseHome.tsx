"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { CompanyAdminEnterpriseDashboard } from "@/app/dashboard/components/CompanyAdminEnterpriseDashboard";
import { EmpDesktopPage } from "@/app/components/emp/desktop/EmpDesktopPage";
import { authHeaders } from "@/lib/auth";
import { hasCompanyAccessFlag, readCompanyAccess } from "@/lib/companyAccess";
import { useOptionalEmpPortalPageContext } from "@/app/components/layout/emp-portal-page-context";

const BACKEND = "/backend";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Company admin enterprise dashboard embedded in the employee portal for owners/grantees. */
export function EmpCompanyEnterpriseHome({ firstName }: { firstName?: string }) {
  const access = readCompanyAccess();
  const inPortal = Boolean(useOptionalEmpPortalPageContext());
  const [ready, setReady] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [widgets, setWidgets] = useState<any>(null);
  const [deptRows, setDeptRows] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    if (!hasCompanyAccessFlag()) return;
    let cancelled = false;
    const headers = authHeaders();
    let companyID = 0;
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      companyID = Number(user.companyID || user.activeCompanyID || 0);
    } catch {
      companyID = 0;
    }
    const q = companyID ? `?companyID=${companyID}` : "";
    const load = async () => {
      try {
        const [ovRes, wRes, dRes] = await Promise.all([
          fetch(`${BACKEND}/dashboard-overview/today-overview${q}`, { headers, cache: "no-store" }),
          fetch(`${BACKEND}/dashboard-overview/hr-widgets${q}`, { headers, cache: "no-store" }),
          fetch(`${BACKEND}/departments/with-headcount${q}`, { headers, cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (ovRes.ok) setOverview(await ovRes.json());
        if (wRes.ok) setWidgets(await wRes.json());
        if (dRes.ok) {
          const rows = await dRes.json();
          setDeptRows(
            (Array.isArray(rows) ? rows : []).map((r: any) => ({
              name: r.departmentName || r.name || "Department",
              count: Number(r.employeeCount ?? r.count ?? 0),
            })),
          );
        }
      } catch {
        /* keep empty dashboard shell */
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const activityItems = useMemo(() => {
    const fromApi = (widgets?.recentActivities ?? []).map((a: any) => {
      const headline =
        a.headline || a.title || a.message || "Activity";
      return {
        id: String(a.id ?? headline),
        headline,
        body: a.body || a.detail || a.description || "",
        time: a.time || "",
        avatarInitial:
          a.avatarInitial ||
          String(headline).trim().charAt(0).toUpperCase() ||
          "A",
        href: a.href,
        kind: a.kind || "system",
      };
    });
    return fromApi.slice(0, 12);
  }, [widgets]);

  const titleName =
    firstName ||
    access?.ownerTitle ||
    "Owner";

  if (!hasCompanyAccessFlag()) return null;

  const dashboard = (
    <CompanyAdminEnterpriseDashboard
      firstName={titleName}
      todayDate={todayIso()}
      overviewTotal={Number(overview?.total ?? 0)}
      overviewPresent={Number(overview?.present ?? 0)}
      overviewAbsent={Number(overview?.absent ?? 0)}
      overviewOnLeave={Number(overview?.onLeave ?? 0)}
      overviewHalfDay={Number(overview?.halfDay ?? 0)}
      overviewStatsReady={ready}
      employeesCount={Number(overview?.total ?? 0)}
      presentTrendVsYesterday={Number(overview?.presentTrendVsYesterday ?? 0)}
      newJoinersCount={Number(widgets?.newJoinersThisMonth ?? 0)}
      statusBreakdown={Array.isArray(overview?.statusBreakdown) ? overview.statusBreakdown : []}
      attendanceTrend={Array.isArray(overview?.attendanceTrend) ? overview.attendanceTrend : []}
      departmentHeadcounts={deptRows}
      upcomingEvents={widgets?.upcomingEvents ?? []}
      newsFeed={widgets?.newsFeed ?? []}
      latestTasks={widgets?.latestTasks ?? []}
      activityItems={activityItems}
      pendingCounts={widgets?.pendingCounts ?? null}
      suppressPageTitle={inPortal}
    />
  );

  if (!inPortal) return dashboard;

  return (
    <EmpDesktopPage
      title="Dashboard"
      description={`Welcome back, ${titleName}`}
      icon={LayoutDashboard}
    >
      {dashboard}
    </EmpDesktopPage>
  );
}
