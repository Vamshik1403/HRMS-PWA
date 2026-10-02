export type EnplSiteVisit = {
  kind?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  at?: string | null;
  createdAt?: string | null;
  addressText?: string | null;
  locationLabel?: string | null;
  address?: string | null;
  accuracyMeters?: number | string | null;
  hrmsEmployeeId?: number | string | null;
};

export type EnplSiteVisitSummary = {
  firstCheckIn?: string | null;
  lastCheckOut?: string | null;
  actualMinutes?: number | string | null;
};

export type TaskWithSiteVisits = {
  erpTaskId?: number | null;
  expectedDurationMinutes?: number | null;
  dueAt?: string | Date | null;
  dueDateTime?: string | Date | null;
  siteAddress?: string | null;
  siteCity?: string | null;
  site?: { branchName?: string | null; city?: string | null; address?: string | null } | null;
  siteVisits?: EnplSiteVisit[] | null;
  siteVisitSummary?: EnplSiteVisitSummary | null;
  daySignOutSelfieRequired?: boolean | null;
  engineerAssignments?: import("./taskAssignmentRequest").EngineerAssignmentRow[] | null;
};

export function formatExpectedDurationMinutes(minutes?: number | null): string {
  if (minutes == null || !Number.isFinite(Number(minutes)) || Number(minutes) < 0) return "";
  const total = Math.round(Number(minutes));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (mins || !parts.length) parts.push(`${mins} min`);
  return parts.join(" ");
}

export function visitComplianceCopy(status?: string | null): { label: string; note: string | null } | null {
  const raw = String(status || "").trim();
  if (!raw) return null;
  const key = raw.replace(/[\s_-]+/g, "").toLowerCase();
  if (key === "missed" || key === "delayed") return { label: raw, note: "Reschedule Required" };
  if (key === "overdue") return { label: raw, note: "Check-in Overdue" };
  return { label: raw, note: null };
}

export function googleMapsLink(lat?: number | null, lng?: number | null): string | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function asCoord(value?: number | string | null): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function visitKind(raw?: string | null): "checkin" | "checkout" | null {
  const key = String(raw || "").replace(/[\s_-]+/g, "").toLowerCase();
  if (key === "checkin" || key === "in" || key === "sitemarkin") return "checkin";
  if (key === "checkout" || key === "out" || key === "sitemarkout") return "checkout";
  return null;
}

function visitAt(row: EnplSiteVisit): string | null {
  return row.at || row.createdAt || null;
}

export function listEnplSiteVisits(task: TaskWithSiteVisits): EnplSiteVisit[] {
  const raw = task.siteVisits;
  if (!Array.isArray(raw)) return [];
  return [...raw].sort((a, b) => new Date(visitAt(a) || 0).getTime() - new Date(visitAt(b) || 0).getTime());
}

export function firstCheckInVisit(task: TaskWithSiteVisits): EnplSiteVisit | null {
  const summaryAt = task.siteVisitSummary?.firstCheckIn;
  const visits = listEnplSiteVisits(task).filter((row) => visitKind(row.kind) === "checkin");
  if (summaryAt) {
    const matched = visits.find((row) => visitAt(row) === summaryAt);
    if (matched) return matched;
  }
  return visits[0] || (summaryAt ? { kind: "checkin", at: summaryAt } : null);
}

export function lastCheckOutVisit(task: TaskWithSiteVisits): EnplSiteVisit | null {
  const summaryAt = task.siteVisitSummary?.lastCheckOut;
  const visits = listEnplSiteVisits(task).filter((row) => visitKind(row.kind) === "checkout");
  if (summaryAt) {
    const matched = [...visits].reverse().find((row) => visitAt(row) === summaryAt);
    if (matched) return matched;
  }
  return visits[visits.length - 1] || (summaryAt ? { kind: "checkout", at: summaryAt } : null);
}

export function actualVisitMinutes(task: TaskWithSiteVisits): number | null {
  const raw = task.siteVisitSummary?.actualMinutes;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function visitPlaceName(row?: EnplSiteVisit | null): string {
  return String(row?.addressText || row?.locationLabel || row?.address || "").trim();
}

export function dueVsActualLabel(task: TaskWithSiteVisits): string {
  const actual = actualVisitMinutes(task);
  const dueRaw = task.dueAt || task.dueDateTime;
  const lastOut = lastCheckOutVisit(task);
  const lastAt = lastOut?.at || lastOut?.createdAt;
  const parts: string[] = [];
  if (actual != null) parts.push(`${formatExpectedDurationMinutes(actual)} actual`);
  if (dueRaw) {
    const due = new Date(dueRaw);
    if (!Number.isNaN(due.getTime())) {
      if (lastAt) {
        const out = new Date(lastAt);
        if (!Number.isNaN(out.getTime())) {
          parts.push(out.getTime() <= due.getTime() ? "checked out before due" : "checked out after due");
        }
      }
    }
  }
  return parts.join(" · ");
}

export function visitCoords(row?: EnplSiteVisit | null): { lat: number; lng: number } | null {
  if (!row) return null;
  const lat = asCoord(row.latitude);
  const lng = asCoord(row.longitude);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

export function taskSiteAddress(task: TaskWithSiteVisits): string {
  return (
    [task.siteAddress || task.site?.address, task.siteCity || task.site?.city || task.site?.branchName]
      .filter(Boolean)
      .join(", ") || ""
  );
}

export function isEnplLinkedTask(task: { erpTaskId?: number | null }): boolean {
  return task.erpTaskId != null && Number(task.erpTaskId) > 0;
}
