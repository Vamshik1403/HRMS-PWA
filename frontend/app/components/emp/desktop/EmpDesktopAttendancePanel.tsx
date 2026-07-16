"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import {
  Clock,
  Coffee,
  LogIn,
  LogOut,
  MapPin,
  UserX,
} from "lucide-react";
import type { TodayStatus } from "../../../hooks/useEmpPunch";
import { useEmpPunch } from "../../../hooks/useEmpPunch";
import { extractDayPunchTimes, formatLocationLines } from "../../../utils/empAttendanceHistory";
import { formatWorkHoursDecimal } from "../../../utils/attendanceDuration";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { NoticeBanner } from "../../ui/notice-banner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { DashboardSection } from "../../../dashboard/components/dashboard-ui";
import { cn } from "@/app/utils/cn";

function fmt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

function statusBadge(
  loading: boolean,
  isAbsent?: boolean,
  isOnBreak?: boolean,
  punchState?: string,
) {
  if (loading) return <Badge variant="muted">Loading…</Badge>;
  if (isAbsent) return <Badge variant="destructive">Absent</Badge>;
  if (isOnBreak) return <Badge className="bg-amber-500/10 text-amber-700 border-amber-200">On break</Badge>;
  if (punchState === "IN") return <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200">Checked in</Badge>;
  return <Badge variant="secondary">Not in</Badge>;
}

function MetricTile({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums text-foreground", className)}>{value}</p>
    </div>
  );
}

export function EmpDesktopAttendancePanel({
  todayStatus,
  loading,
  onStatusUpdate,
  showActions = true,
  compact = false,
}: {
  todayStatus: TodayStatus | null;
  loading: boolean;
  onStatusUpdate: (status: TodayStatus) => void;
  showActions?: boolean;
  compact?: boolean;
}) {
  const [time, setTime] = useState(() => new Date());
  const [absentOpen, setAbsentOpen] = useState(false);
  const [absentReason, setAbsentReason] = useState("");

  const {
    punch,
    markAbsent,
    requestLocationAccess,
    punchLoading,
    locationLoading,
    punchError,
    punchSuccess,
    setPunchError,
    setPunchSuccess,
  } = useEmpPunch(onStatusUpdate);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const punchState = todayStatus?.punchState ?? (todayStatus?.isCheckedIn ? "IN" : "OUT");
  const canCheckIn = todayStatus?.canCheckIn ?? punchState === "OUT";
  const canCheckOut = todayStatus?.canCheckOut ?? punchState === "IN";
  const breakEnabled = todayStatus?.mobileBreakEnabled !== false;
  const canBreakIn = breakEnabled && (todayStatus?.canBreakIn ?? punchState === "IN");
  const canBreakOut = breakEnabled && (todayStatus?.canBreakOut ?? punchState === "ON_BREAK");
  const isOnBreak = punchState === "ON_BREAK";
  const isAbsent = todayStatus?.isAbsentToday;
  const canMarkAbsent = todayStatus?.canMarkAbsent ?? false;

  const dayPunches = useMemo(
    () => extractDayPunchTimes((todayStatus?.allToday as Parameters<typeof extractDayPunchTimes>[0]) || []),
    [todayStatus?.allToday],
  );
  const checkIn = todayStatus?.checkIn ?? dayPunches.checkIn;
  const checkOut = todayStatus?.checkOut ?? dayPunches.checkOut;

  const dateLabel = time.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const clock = time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const submitAbsent = async () => {
    if (absentReason.trim().length < 3) return;
    await markAbsent(absentReason.trim());
    setAbsentOpen(false);
    setAbsentReason("");
  };

  const workHours = formatWorkHoursDecimal(todayStatus?.workSeconds ?? 0);
  const breakLabel =
    todayStatus?.breakMinutes != null ? `${todayStatus.breakMinutes}m` : "0m";

  const content = (
  <>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4" />
          <span>{dateLabel}</span>
        </div>
        <p className="mt-2 font-display text-3xl font-bold tabular-nums tracking-tight">{clock}</p>
      </div>
      {statusBadge(loading, isAbsent, isOnBreak, punchState)}
    </div>

    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricTile label="Mark in" value={checkIn ? fmt(checkIn.checkinTime) : "—"} />
      <MetricTile label="Mark out" value={checkOut ? fmt(checkOut.checkinTime) : "—"} />
      <MetricTile label="Working hours" value={workHours} className="text-emerald-600" />
      <MetricTile label="Break" value={breakLabel} className="text-amber-600" />
    </div>

    {(checkIn || checkOut) && (
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {checkIn ? <LocationCard label="Mark in location" punch={checkIn} /> : null}
        {checkOut ? <LocationCard label="Mark out location" punch={checkOut} /> : null}
      </div>
    )}

    {(punchError || punchSuccess) && (
      <div className="mt-4 space-y-2">
        {punchSuccess ? <NoticeBanner variant="success">{punchSuccess}</NoticeBanner> : null}
        {punchError ? (
          <NoticeBanner variant="error">
            <div className="space-y-2">
              <p>{punchError}</p>
              {punchError.toLowerCase().includes("permission") ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setPunchError(null); requestLocationAccess(); }}
                  disabled={locationLoading}
                >
                  {locationLoading ? "Checking…" : "Enable location"}
                </Button>
              ) : null}
            </div>
          </NoticeBanner>
        ) : null}
      </div>
    )}

    {showActions && !loading && !isAbsent ? (
      <div className="mt-6 flex flex-wrap gap-2">
        {canCheckIn ? (
          <>
            <Button onClick={() => punch("CHECK_IN")} disabled={punchLoading}>
              <LogIn className="size-4" />
              {punchLoading ? "Please wait…" : "Mark in"}
            </Button>
            {canMarkAbsent ? (
              <Button variant="outline" onClick={() => setAbsentOpen(true)} disabled={punchLoading}>
                <UserX className="size-4" />
                Mark absent
              </Button>
            ) : null}
          </>
        ) : null}
        {canCheckOut ? (
          <Button onClick={() => punch("CHECK_OUT")} disabled={punchLoading}>
            <LogOut className="size-4" />
            Mark out
          </Button>
        ) : null}
        {canBreakIn ? (
          <Button variant="secondary" onClick={() => punch("BREAK_IN")} disabled={punchLoading}>
            <Coffee className="size-4" />
            Break in
          </Button>
        ) : null}
        {canBreakOut ? (
          <Button variant="secondary" onClick={() => punch("BREAK_OUT")} disabled={punchLoading}>
            <Coffee className="size-4" />
            Break out
          </Button>
        ) : null}
      </div>
    ) : null}

    {isAbsent ? (
      <p className="mt-4 text-sm text-muted-foreground">You are marked absent for today.</p>
    ) : null}

    <Dialog open={absentOpen} onOpenChange={setAbsentOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark absent</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Emergency absence without prior notice. A leave request will be sent to your manager.
        </p>
        <div className="space-y-2">
          <Label htmlFor="absent-reason">Reason</Label>
          <Textarea
            id="absent-reason"
            value={absentReason}
            onChange={(e) => setAbsentReason(e.target.value)}
            rows={3}
            placeholder="Describe the reason…"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbsentOpen(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={submitAbsent}
            disabled={punchLoading || absentReason.trim().length < 3}
          >
            {punchLoading ? "Submitting…" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );

  if (compact) {
    return (
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Today&apos;s attendance</CardTitle>
          <CardDescription>Live status and punch actions</CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    );
  }

  return (
    <DashboardSection>
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Today&apos;s attendance</h2>
        <p className="text-sm text-muted-foreground mt-1">Check in, take breaks, and mark out for the day</p>
      </div>
      {content}
    </DashboardSection>
  );
}

function LocationCard({
  label,
  punch,
}: {
  label: string;
  punch: { latitude?: number | null; longitude?: number | null; address?: string | null };
}) {
  const { address, coordinates } = formatLocationLines(punch);
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MapPin className="size-4 text-muted-foreground" />
        {label}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{address || "—"}</p>
      {coordinates ? <p className="mt-1 text-xs font-mono text-muted-foreground">{coordinates}</p> : null}
    </div>
  );
}
