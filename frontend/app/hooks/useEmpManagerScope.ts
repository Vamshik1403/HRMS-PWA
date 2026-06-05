"use client";

import { useEffect, useState } from "react";
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

export function useEmpManagerScope(enabled = true) {
  const [scope, setScope] = useState<EmpManagerScope | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setScope(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`${BACKEND}/emp-manager-scope/reportees`, {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) {
          if (!cancelled) setScope(EMPTY);
          return;
        }
        setScope({
          employeeId: Number(data.employeeId) || 0,
          reporteeIds: Array.isArray(data.reporteeIds) ? data.reporteeIds.map(Number) : [],
          hasReportees: !!data.hasReportees,
          reportees: Array.isArray(data.reportees) ? data.reportees : [],
        });
      })
      .catch(() => {
        if (!cancelled) setScope(EMPTY);
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
