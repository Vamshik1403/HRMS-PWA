"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchEmpSidebarBadgeCounts,
  type EmpSidebarBadgeCounts,
} from "@/lib/empNotificationBadge";
import { getEmployeeIdFromStorage } from "@/lib/pushSubscribe";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";

const EMPTY: EmpSidebarBadgeCounts = {
  home: 0,
  im: 0,
  approvals: 0,
  company: 0,
  more: 0,
  leave: 0,
  reimbursement: 0,
  tasks: 0,
  notices: 0,
};

export function useEmpSidebarBadges() {
  const { isManagerView, scope } = useEmpManagerScope();
  const [badges, setBadges] = useState<EmpSidebarBadgeCounts>(EMPTY);

  const refresh = useCallback(async () => {
    const employeeId = getEmployeeIdFromStorage();
    const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
    if (!employeeId || !token) {
      setBadges(EMPTY);
      return;
    }
    try {
      const next = await fetchEmpSidebarBadgeCounts(employeeId, token, {
        isManager: isManagerView,
        reporteeIds: scope?.reporteeIds,
      });
      setBadges(next);
    } catch {
      setBadges(EMPTY);
    }
  }, [isManagerView, scope?.reporteeIds]);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("emp-sidebar-badges-changed", onChange);
    window.addEventListener("emp-notifications-changed", onChange);
    window.addEventListener("emp-home-badges-changed", onChange);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(onChange, 60_000);
    return () => {
      window.removeEventListener("emp-sidebar-badges-changed", onChange);
      window.removeEventListener("emp-notifications-changed", onChange);
      window.removeEventListener("emp-home-badges-changed", onChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [refresh]);

  return badges;
}

export function sidebarBadgeForHref(href: string, badges: EmpSidebarBadgeCounts): number {
  if (href.startsWith("/empdashboard") && !href.includes("tab=calendar")) return badges.home;
  if (href.includes("tab=messaging")) return badges.im;
  if (href.includes("/empTeam/approvals")) return badges.approvals;
  if (href.startsWith("/empCompany") || href.startsWith("/empNoticeboard") || href.startsWith("/empHolidays")) {
    return badges.company;
  }
  if (href.startsWith("/empMore")) return badges.more;
  return 0;
}

/** Per-module badge for More grid tiles (0 when none). */
export function moreSectionBadgeCount(
  sectionId: string,
  badges: EmpSidebarBadgeCounts,
): number {
  switch (sectionId) {
    case "leave":
      return badges.leave;
    case "reimbursement":
      return badges.reimbursement;
    case "tasks":
      return badges.tasks;
    case "team-approvals":
      return badges.approvals;
    case "noticeboard":
      return badges.notices;
    case "company-overview":
      return badges.company;
    default:
      return 0;
  }
}
