"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { getDisplayLeaveStatus } from "@/app/utils/leaveDisplay";
import { formatDateShort } from "@/app/utils/leaveDisplay";
import { totalAmount, type ReimbursementRow } from "./EmpReimbursementMobile";
import type { LeaveAppRow } from "./EmpLeaveMobile";
import { cardShell } from "@/app/dashboard/components/dashboard-ui";
import { authHeaders } from "@/lib/auth";
import { fmtJoined } from "@/app/hooks/useEmpProfile";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

function Empty({ message }: { message: string }) {
  return (
    <div className={`${cardShell} p-8 text-center text-sm text-muted-foreground`}>{message}</div>
  );
}

export function EmpTeamMemberApprovals({ employeeId }: { employeeId: number }) {
  const [leaveApps, setLeaveApps] = useState<LeaveAppRow[]>([]);
  const [reimbRows, setReimbRows] = useState<ReimbursementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leaveRes, reimbRes] = await Promise.all([
        fetch(`${BACKEND}/leave-application/employee/${employeeId}`, {
          headers: authHeaders(),
          cache: "no-store",
        }),
        fetch(`${BACKEND}/reimbursement/employee/${employeeId}`, {
          headers: authHeaders(),
          cache: "no-store",
        }),
      ]);
      const leaves = leaveRes.ok ? await leaveRes.json() : [];
      const reimb = reimbRes.ok ? await reimbRes.json() : [];
      setLeaveApps(Array.isArray(leaves) ? leaves : []);
      setReimbRows(Array.isArray(reimb) ? reimb : []);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Empty message="Loading approval requests…" />;

  const pendingLeave = leaveApps.filter((l) => getDisplayLeaveStatus(l.status) === "Pending");
  const pendingReimb = reimbRows.filter((r) => r.status === "Pending");

  if (pendingLeave.length === 0 && pendingReimb.length === 0) {
    return <Empty message="No pending approval requests for this employee." />;
  }

  return (
    <div className="space-y-3">
      {pendingLeave.map((l) => (
        <div key={`leave-${l.id}`} className={`${cardShell} p-4 flex items-start gap-3`}>
          <span className="size-9 rounded-md bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
            <Icon icon="solar:calendar-bold-duotone" className="size-5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Leave</p>
            <p className="text-sm font-medium text-foreground">
              {formatDateShort(l.fromDate)} – {formatDateShort(l.toDate)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{l.purpose || "—"}</p>
          </div>
        </div>
      ))}
      {pendingReimb.map((r) => (
        <div key={`reimb-${r.id}`} className={`${cardShell} p-4 flex items-start gap-3`}>
          <span className="size-9 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <Icon icon="solar:wallet-bold-duotone" className="size-5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Reimbursement</p>
            <p className="text-sm font-medium text-foreground">₹{totalAmount(r).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{r.status}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmpTeamMemberLeave({ employeeId }: { employeeId: number }) {
  const [leaveApps, setLeaveApps] = useState<LeaveAppRow[]>([]);
  const [reimbRows, setReimbRows] = useState<ReimbursementRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`${BACKEND}/leave-application/employee/${employeeId}`, { headers: authHeaders() }),
      fetch(`${BACKEND}/reimbursement/employee/${employeeId}`, { headers: authHeaders() }),
    ])
      .then(async ([leaveRes, reimbRes]) => {
        if (cancelled) return;
        const leaves = leaveRes.ok ? await leaveRes.json() : [];
        const reimb = reimbRes.ok ? await reimbRes.json() : [];
        setLeaveApps(Array.isArray(leaves) ? leaves : []);
        setReimbRows(Array.isArray(reimb) ? reimb : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  if (loading) return <Empty message="Loading leave & reimbursement…" />;

  return (
    <div className="space-y-6">
      <section className={cardShell}>
        <div className="border-b border-border px-6 py-4">
          <h3 className="font-display text-base font-semibold">Leave history</h3>
        </div>
        {leaveApps.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No leave applications.</p>
        ) : (
          <ul className="divide-y divide-border">
            {leaveApps.slice(0, 20).map((l) => (
              <li key={l.id} className="px-6 py-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {formatDateShort(l.fromDate)} – {formatDateShort(l.toDate)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{l.purpose || "—"}</p>
                </div>
                <span className="text-xs font-semibold text-primary">{getDisplayLeaveStatus(l.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardShell}>
        <div className="border-b border-border px-6 py-4">
          <h3 className="font-display text-base font-semibold">Reimbursement history</h3>
        </div>
        {reimbRows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No reimbursement claims.</p>
        ) : (
          <ul className="divide-y divide-border">
            {reimbRows.slice(0, 20).map((r) => (
              <li key={r.id} className="px-6 py-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">₹{totalAmount(r).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.date || "—"}</p>
                </div>
                <span className="text-xs font-semibold text-primary">{r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function EmpTeamMemberAttendance({ employeeId }: { employeeId: number }) {
  const [days, setDays] = useState<{ date: string; status: string; inTime?: string; outTime?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`${BACKEND}/emp-manager-scope/member/${employeeId}/attendance-history`, {
      headers: authHeaders(),
    })
      .then((r) => (r.ok ? r.json() : { days: [] }))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.days) ? data.days : Array.isArray(data) ? data : [];
        setDays(
          list.slice(0, 30).map((d: { date?: string; status?: string; inTime?: string; outTime?: string }) => ({
            date: d.date || "",
            status: d.status || "—",
            inTime: d.inTime,
            outTime: d.outTime,
          })),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  if (loading) return <Empty message="Loading attendance…" />;

  if (days.length === 0) {
    return <Empty message="No attendance records for the last 30 days." />;
  }

  return (
    <section className={cardShell}>
      <div className="border-b border-border px-6 py-4">
        <h3 className="font-display text-base font-semibold">Attendance (last 30 days)</h3>
      </div>
      <ul className="divide-y divide-border">
        {days.map((d) => (
          <li key={d.date} className="px-6 py-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{d.date ? fmtJoined(d.date) : "—"}</span>
            <span className="text-xs text-muted-foreground">
              {d.status}
              {d.inTime ? ` · In ${d.inTime}` : ""}
              {d.outTime ? ` · Out ${d.outTime}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EmpTeamMemberPromotions({ employeeId }: { employeeId: number }) {
  const [rows, setRows] = useState<
    { id: number; description?: string; promotionDate?: string; status?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/emp-promotion?manageEmployeeID=${employeeId}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (cancelled) return;
        setRows(Array.isArray(data) ? data : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  if (loading) return <Empty message="Loading promotions & transfers…" />;

  if (rows.length === 0) {
    return <Empty message="No promotion or transfer records for this employee." />;
  }

  return (
    <section className={cardShell}>
      <div className="border-b border-border px-6 py-4">
        <h3 className="font-display text-base font-semibold">Promotions &amp; transfers</h3>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="px-6 py-4">
            <p className="text-sm font-medium text-foreground">{r.description || "Record"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {r.promotionDate ? fmtJoined(r.promotionDate) : "—"} · {r.status || "—"}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
