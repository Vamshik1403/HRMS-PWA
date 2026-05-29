"use client";

import { useCallback, useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export type LeaveBalanceCard = {
  key: "sick" | "casual" | "privileged";
  label: string;
  remaining: number;
  total: number;
};

async function robustGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export function useEmpLeaveBalance() {
  const [cards, setCards] = useState<LeaveBalanceCard[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (employeeId: number) => {
    setLoading(true);
    try {
      const [empRes, plDataRaw, balanceRecordRaw] = await Promise.all([
        robustGet<any>(`${BACKEND}/manage-emp/${employeeId}`),
        robustGet<any[]>(`${BACKEND}/privileged-leave/employee/${employeeId}`).catch(() => []),
        robustGet<any>(`${BACKEND}/emp-leave-balance/employee/${employeeId}`).catch(() => ({})),
      ]);

      const policy =
        empRes.leavePolicy ||
        ([...(empRes.empLeavePolicy ?? [])].sort(
          (a: any, b: any) =>
            new Date(b.effectFrom || 0).getTime() - new Date(a.effectFrom || 0).getTime(),
        )[0]?.leavePolicy) ||
        {};

      const totalSick = Number(policy.sickLeaveCount) || 0;
      const totalCasual = Number(policy.casualLeaveCount) || 0;
      const totalPrivileged = Array.isArray(plDataRaw)
        ? plDataRaw.reduce((s: number, e: any) => s + (Number(e.balanceLeaves) || 0), 0)
        : 0;

      const balanceRecord: any = balanceRecordRaw ?? {};
      const usedSick = Number(balanceRecord.sickUsed) || 0;
      const usedCasual = Number(balanceRecord.casualUsed) || 0;
      const usedPrivileged = Number(balanceRecord.privilegedUsed) || 0;

      const mk = (used: number, total: number) => ({
        remaining: Math.max(total - used, 0),
        total,
      });

      setCards([
        { key: "sick", label: "Sick", ...mk(usedSick, totalSick) },
        { key: "casual", label: "Casual", ...mk(usedCasual, totalCasual) },
        { key: "privileged", label: "Privilege", ...mk(usedPrivileged, totalPrivileged) },
      ]);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { cards, loading, load };
}
