"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserCheck, UserX, Clock } from "lucide-react";
import { cardShell } from "@/app/dashboard/components/dashboard-ui";
import { reporteeDisplayName } from "@/app/utils/empManagerDisplay";
import { authHeaders } from "@/lib/auth";
import { cn } from "@/app/utils/cn";
import type { TeamMemberRow } from "../EmpTeamViews";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

function statusDot(label: string) {
  if (label === "Checked in") return "bg-emerald-500";
  if (label === "Checked out") return "bg-blue-500";
  if (label === "Absent") return "bg-rose-500";
  return "bg-amber-400";
}

export function EmpTeamPulsePanel() {
  const router = useRouter();
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/emp-manager-scope/team-today-status?scope=team`, {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((data) => {
        if (!cancelled) setMembers(Array.isArray(data.members) ? data.members : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const present = members.filter((m) => m.statusLabel === "Checked in").length;
    const checkedOut = members.filter((m) => m.statusLabel === "Checked out").length;
    const absent = members.filter((m) => m.statusLabel === "Absent").length;
    const pending = members.length - present - checkedOut - absent;
    return { present, checkedOut, absent, pending, total: members.length };
  }, [members]);

  const spotlight = members.slice(0, 8);

  return (
    <section className={cn(cardShell, "p-6 flex flex-col gap-6")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-foreground">Today&apos;s team pulse</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live attendance snapshot for your department
          </p>
        </div>
        <Link href="/empTeam/my-team" className="text-xs font-medium text-primary hover:underline shrink-0">
          View all
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading team pulse…</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No team members in your department yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-emerald-500/5 p-4 text-center">
              <UserCheck className="size-5 text-emerald-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{stats.present}</p>
              <p className="text-xs text-muted-foreground">Present</p>
            </div>
            <div className="rounded-xl border border-border bg-amber-500/5 p-4 text-center">
              <Clock className="size-5 text-amber-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Yet to check-in</p>
            </div>
            <div className="rounded-xl border border-border bg-rose-500/5 p-4 text-center">
              <UserX className="size-5 text-rose-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{stats.absent + stats.checkedOut}</p>
              <p className="text-xs text-muted-foreground">Away / Out</p>
            </div>
          </div>

          {stats.total > 0 ? (
            <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
              <div
                className="bg-emerald-500 transition-all"
                style={{ width: `${(stats.present / stats.total) * 100}%` }}
              />
              <div
                className="bg-amber-400 transition-all"
                style={{ width: `${(stats.pending / stats.total) * 100}%` }}
              />
              <div
                className="bg-rose-400 transition-all"
                style={{ width: `${((stats.absent + stats.checkedOut) / stats.total) * 100}%` }}
              />
            </div>
          ) : null}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Team spotlight
            </p>
            <div className="flex flex-wrap gap-3">
              {spotlight.map((m) => {
                const name = reporteeDisplayName(m);
                const initials =
                  name
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0].toUpperCase())
                    .join("") || "?";
                const status = m.statusLabel || "Yet to check-in";
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => router.push(`/empTeam/member/${m.id}`)}
                    className="flex flex-col items-center gap-1.5 w-[72px] group"
                  >
                    <div className="relative">
                      {m.employeePhotoUrl ? (
                        <img
                          src={m.employeePhotoUrl}
                          alt={name}
                          className="size-12 rounded-full object-cover ring-2 ring-border group-hover:ring-primary/40"
                        />
                      ) : (
                        <div className="size-12 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm ring-2 ring-border group-hover:ring-primary/40">
                          {initials}
                        </div>
                      )}
                      <span
                        className={cn(
                          "absolute bottom-0 right-0 size-3 rounded-full border-2 border-card",
                          statusDot(status),
                        )}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-foreground truncate w-full text-center">
                      {name.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
