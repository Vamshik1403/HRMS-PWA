"use client";

import { useEffect, useMemo, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import type { TodayStatus } from "../../../hooks/useEmpPunch";
import { useEmpPunch } from "../../../hooks/useEmpPunch";
import { Button } from "../../ui/button";
import { NoticeBanner } from "../../ui/notice-banner";
import { cn } from "@/app/utils/cn";

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 20) return "Good evening";
  return "Good night";
}

function formatTimer(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")} : ${String(m).padStart(2, "0")} : ${String(s).padStart(2, "0")}`;
}

export function EmpDesktopHomeProfileHero({
  empFullName,
  empPhoto,
  empInitials,
  designation,
  department,
  todayStatus,
  loadingStatus,
  onStatusUpdate,
}: {
  empFullName: string;
  empPhoto: string | null;
  empInitials: string;
  designation?: string | null;
  department?: string | null;
  todayStatus: TodayStatus | null;
  loadingStatus: boolean;
  onStatusUpdate: (status: TodayStatus) => void;
}) {
  const [tick, setTick] = useState(0);
  const [workAnchor, setWorkAnchor] = useState<{ baseSeconds: number; at: number } | null>(null);
  const { punch, punchLoading, punchError, punchSuccess, setPunchError } = useEmpPunch(onStatusUpdate);

  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const punchState = todayStatus?.punchState ?? (todayStatus?.isCheckedIn ? "IN" : "OUT");
  const canCheckIn = todayStatus?.canCheckIn ?? punchState === "OUT";
  const canCheckOut = todayStatus?.canCheckOut ?? punchState === "IN";
  const isCheckedIn = punchState === "IN" || punchState === "ON_BREAK";
  const isAbsent = todayStatus?.isAbsentToday;

  const roleLine = [designation, department].filter(Boolean).join(" · ") || "Employee";

  const checkInKey =
    typeof todayStatus?.checkIn === "string"
      ? todayStatus.checkIn
      : todayStatus?.checkIn?.checkinTime;

  useEffect(() => {
    if (!isCheckedIn) {
      setWorkAnchor(null);
      return;
    }
    const base = todayStatus?.workSeconds ?? 0;
    setWorkAnchor((prev) => {
      if (!prev) return { baseSeconds: base, at: Date.now() };
      const estimated = prev.baseSeconds + Math.floor((Date.now() - prev.at) / 1000);
      const drift = base - estimated;
      if (Math.abs(drift) > 15) return { baseSeconds: base, at: Date.now() };
      return prev;
    });
  }, [isCheckedIn, todayStatus?.workSeconds, checkInKey]);

  const timerSeconds = useMemo(() => {
    void tick;
    if (!isCheckedIn) return todayStatus?.workSeconds ?? 0;
    if (!workAnchor) return todayStatus?.workSeconds ?? 0;
    return workAnchor.baseSeconds + Math.floor((Date.now() - workAnchor.at) / 1000);
  }, [tick, isCheckedIn, workAnchor, todayStatus?.workSeconds]);

  const statusText = loadingStatus
    ? "Loading…"
    : isAbsent
      ? "Absent"
      : isCheckedIn
        ? "Checked-In"
        : todayStatus?.checkOut
          ? "Checked-Out"
          : "Yet to check-in";

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex items-start gap-5 sm:gap-6">
          <div className="size-24 sm:size-28 rounded-full overflow-hidden bg-primary flex items-center justify-center shrink-0 ring-4 ring-muted shadow-sm">
            {empPhoto ? (
              <img src={empPhoto} alt={empFullName} className="size-full object-cover" />
            ) : (
              <span className="text-primary-foreground font-bold text-2xl sm:text-3xl">{empInitials}</span>
            )}
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <h1 className="font-display text-[1.65rem] sm:text-[1.85rem] font-semibold tracking-tight text-foreground leading-snug">
              <span className="font-normal text-muted-foreground">{greeting()}, </span>
              <span className="text-foreground">{empFullName}</span>
            </h1>
            <p className="mt-1.5 text-sm font-medium text-muted-foreground">{roleLine}</p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p
                className={cn(
                  "text-sm font-semibold",
                  isCheckedIn ? "text-emerald-600" : isAbsent ? "text-rose-600" : "text-amber-600",
                )}
              >
                {statusText}
              </p>
              {isCheckedIn && !isAbsent ? (
                <p className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-foreground tracking-wider">
                  {formatTimer(timerSeconds)}
                </p>
              ) : null}
            </div>

            {!loadingStatus && !isAbsent ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {canCheckIn ? (
                  <Button size="default" onClick={() => punch("CHECK_IN")} disabled={punchLoading}>
                    <LogIn className="size-4" />
                    {punchLoading ? "Please wait…" : "Check-in"}
                  </Button>
                ) : null}
                {canCheckOut ? (
                  <Button size="default" variant="outline" onClick={() => punch("CHECK_OUT")} disabled={punchLoading}>
                    <LogOut className="size-4" />
                    Check-out
                  </Button>
                ) : null}
              </div>
            ) : null}

            {punchSuccess ? (
              <NoticeBanner variant="success" className="mt-4 text-left">
                {punchSuccess}
              </NoticeBanner>
            ) : null}
            {punchError ? (
              <NoticeBanner variant="error" className="mt-4 text-left">
                <div className="space-y-2">
                  <p>{punchError}</p>
                  {punchError.toLowerCase().includes("permission") || punchError.toLowerCase().includes("location") ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setPunchError(null)}>
                      Dismiss
                    </Button>
                  ) : null}
                </div>
              </NoticeBanner>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
