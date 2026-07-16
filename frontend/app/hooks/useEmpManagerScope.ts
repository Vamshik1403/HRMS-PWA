"use client";

import { useEffect, useState } from "react";
import { setDesktopManagerFlag } from "@/lib/desktopManager";
import type { EmpManagerScope } from "../utils/empManagerDisplay";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const EMPTY: EmpManagerScope = {
  employeeId: 0,
  reporteeIds: [],
  hasReportees: false,
  reportees: [],
};

let cachedScope: EmpManagerScope | null = null;

export function clearEmpManagerScopeCache() {
  cachedScope = null;
}

export function useEmpManagerScope(enabled = true) {
  const [scope, setScope] = useState<EmpManagerScope | null>(enabled ? cachedScope : null);
  const [loading, setLoading] = useState(enabled && !cachedScope);

  useEffect(() => {
    if (!enabled) {
      setScope(null);
      setLoading(false);
      return;
    }
    if (cachedScope) {
      setScope(cachedScope);
      setLoading(false);
    }
    let cancelled = false;
    if (!cachedScope) setLoading(true);
    fetch(`${BACKEND}/emp-manager-scope/reportees`, {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setDesktopManagerFlag(false);
          cachedScope = EMPTY;
          setScope(EMPTY);
          return;
        }
        const hasReportees = !!data.hasReportees;
        setDesktopManagerFlag(hasReportees);
        const nextScope: EmpManagerScope = {
          employeeId: Number(data.employeeId) || 0,
          reporteeIds: Array.isArray(data.reporteeIds) ? data.reporteeIds.map(Number) : [],
          hasReportees,
          reportees: Array.isArray(data.reportees) ? data.reportees : [],
        };
        cachedScope = nextScope;
        setScope(nextScope);
      })
      .catch(() => {
        if (!cancelled) {
          setDesktopManagerFlag(false);
          cachedScope = EMPTY;
          setScope(EMPTY);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { scope, loading, isManagerView: !!scope?.hasReportees };
}
