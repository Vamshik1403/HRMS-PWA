"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import {
  Clock,
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
import { EmpPhotoPunchCapture, type EmpPhotoPunchCaptureHandle } from "../EmpPhotoPunchCapture";

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

function MetricTile({
  label,
  value,
  className,
  dense,
}: {
  label: string;
  value: string;
  className?: string;
  dense?: boolean;
}) {
  return (
      <div
        className={cn(
          "rounded-lg border border-border bg-muted/30",
          dense ? "px-3.5 py-2.5" : "px-4 py-3",
        )}
      >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-semibold tabular-nums text-foreground",
          dense ? "mt-1 text-lg" : "mt-1 text-lg",
          className,
        )}
      >
        {value}
      </p>
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
  const photoCaptureRef = useRef<EmpPhotoPunchCaptureHandle>(null);

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
  const mobileEnabled = todayStatus?.mobileAttendanceEnabled === true;
  const photoPunchEnabled = todayStatus?.photoPunchEnabled === true;
  const canCheckIn = mobileEnabled && (todayStatus?.canCheckIn ?? punchState === "OUT");
  const canCheckOut = mobileEnabled && (todayStatus?.canCheckOut ?? (punchState === "IN" || punchState === "ON_BREAK"));
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

  const startMark = (checkType: "CHECK_IN" | "CHECK_OUT") => {
    if (photoPunchEnabled) {
      photoCaptureRef.current?.startFromGesture(checkType);
      return;
    }
    void punch(checkType);
  };

  const workHours = formatWorkHoursDecimal(todayStatus?.workSeconds ?? 0);

  const actionButtons =
    showActions && !loading && !isAbsent ? (
      <>
        {!mobileEnabled ? (
          <p className="text-sm text-muted-foreground">
            Mark IN/OUT is available on your attendance device.
          </p>
        ) : null}
        {canCheckIn ? (
          <>
            <Button
              size={compact ? "sm" : "default"}
              onClick={() => startMark("CHECK_IN")}
              disabled={punchLoading}
            >
              <LogIn className="size-4" />
              {punchLoading ? "Please wait…" : "Check-in"}
            </Button>
            {canMarkAbsent ? (
              <Button
                size={compact ? "sm" : "default"}
                variant="outline"
                onClick={() => setAbsentOpen(true)}
                disabled={punchLoading}
              >
                <UserX className="size-4" />
                Mark absent
              </Button>
            ) : null}
          </>
        ) : null}
        {canCheckOut ? (
          <Button
            size={compact ? "sm" : "default"}
            variant="outline"
            onClick={() => startMark("CHECK_OUT")}
            disabled={punchLoading}
          >
            <LogOut className="size-4" />
            Check-out
          </Button>
        ) : null}
      </>
    ) : null;

  const content = (
  <>
    {compact ? (
      <div className="shrink-0 space-y-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4 shrink-0" />
            <span>{dateLabel}</span>
          </div>
          <p className="mt-1.5 font-display text-3xl font-bold tabular-nums tracking-tight">
            {clock}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">{actionButtons}</div>
          {statusBadge(loading, isAbsent, isOnBreak, punchState)}
        </div>
      </div>
    ) : (
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4 shrink-0" />
            <span>{dateLabel}</span>
          </div>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums tracking-tight">
            {clock}
          </p>
        </div>
        {statusBadge(loading, isAbsent, isOnBreak, punchState)}
      </div>
    )}

    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
        compact
          ? checkIn || checkOut
            ? "mt-3 pt-3"
            : "mt-auto pt-4"
          : "mt-6",
      )}
    >
      <MetricTile dense={compact} label="Mark in" value={checkIn ? fmt(checkIn.checkinTime) : "—"} />
      <MetricTile dense={compact} label="Mark out" value={checkOut ? fmt(checkOut.checkinTime) : "—"} />
      <MetricTile dense={compact} label="Working hours" value={workHours} className="text-emerald-600" />
    </div>

    {(checkIn || checkOut) && (
      <div className={cn("grid gap-3 lg:grid-cols-2", compact ? "mt-3" : "mt-6")}>
        {checkIn ? <LocationCard label="Mark in location" punch={checkIn} /> : null}
        {checkOut ? <LocationCard label="Mark out location" punch={checkOut} /> : null}
      </div>
    )}

    {(punchError || punchSuccess) && (
      <div className={cn("space-y-2", compact ? "mt-3" : "mt-4")}>
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

    {!compact && actionButtons ? (
      <div className="mt-6 flex flex-wrap gap-2">{actionButtons}</div>
    ) : null}

    {isAbsent ? (
      <p className={cn("text-sm text-muted-foreground", compact ? "mt-3" : "mt-4")}>
        You are marked absent for today.
      </p>
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
    <EmpPhotoPunchCapture
      ref={photoCaptureRef}
      submitting={punchLoading}
      onError={(message) => setPunchError(message)}
      onSubmit={(checkType, photoFile, location) => punch(checkType, { photoFile, location })}
    />
  </>
  );

  if (compact) {
    return (
      <Card className="flex h-full min-h-0 flex-col overflow-hidden border border-border shadow-sm">
        <CardHeader className="shrink-0 space-y-0.5 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">Today&apos;s attendance</CardTitle>
          </div>
          <CardDescription>Live status and punch actions</CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-1">
          <div className="flex min-h-full flex-col">{content}</div>
        </CardContent>
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
