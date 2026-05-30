export type DayStatusRow = { date: string; status: string };

export function parseDayStatuses(raw: unknown): DayStatusRow[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as DayStatusRow[];
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function formatDateShort(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateRange(from?: string | null, to?: string | null) {
  if (!from && !to) return "—";
  if (from && to && from === to) return formatDateShort(from);
  if (from && to) return `${formatDateShort(from)} – ${formatDateShort(to)}`;
  return formatDateShort(from || to);
}

export function getAppliedDateRange(app: {
  fromDate?: string | null;
  toDate?: string | null;
}) {
  const from = app.fromDate ? String(app.fromDate).slice(0, 10) : null;
  const to = app.toDate ? String(app.toDate).slice(0, 10) : null;
  return formatDateRange(from, to);
}

export function getApprovedDateRange(app: {
  status?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  dayStatuses?: unknown;
  appliedLeaveType?: string | null;
}) {
  const status = (app.status || "").toLowerCase();
  if (!["approved", "accepted", "revokepending", "revoked"].includes(status)) {
    return "—";
  }
  const ds = parseDayStatuses(app.dayStatuses);
  const approvedDays = ds.filter(
    (d) => d.status && !["pending", "rejected", "lop"].includes(d.status.toLowerCase()),
  );
  if (approvedDays.length > 0) {
    const dates = approvedDays.map((d) => d.date).sort();
    return formatDateRange(dates[0], dates[dates.length - 1]);
  }
  return getAppliedDateRange(app);
}

export function getDisplayLeaveStatus(status?: string | null, dayStatuses?: unknown): string {
  const s = status || "Pending";
  if (s === "Pending") return "Approval Pending";
  if (s === "Partly Approved") return "Partly Approved";
  if (s === "Rejected") return "Rejected";
  if (s === "RevokePending") return "Cancel Pending";
  if (s === "Revoked") return "Cancelled";
  if (s === "Approved" || s === "Accepted") {
    const ds = parseDayStatuses(dayStatuses);
    const types = new Set(
      ds.map((d) => d.status).filter((x) => x && !["Pending", "Rejected"].includes(x)),
    );
    if (types.size > 1) return "Partly Approved";
    return "Approved";
  }
  return s;
}

export function getDisplayLeaveType(app: {
  status?: string | null;
  appliedLeaveType?: string | null;
  dayStatuses?: unknown;
}): string {
  const status = app.status || "";
  if (!["Approved", "Accepted", "RevokePending"].includes(status)) return "—";
  const ds = parseDayStatuses(app.dayStatuses);
  const types = [...new Set(ds.map((d) => d.status).filter(Boolean))];
  if (types.length === 1) return leaveTypeLabel(types[0]);
  if (types.length > 1) return types.map(leaveTypeLabel).join(", ");
  if (app.appliedLeaveType) return leaveTypeLabel(app.appliedLeaveType);
  return "—";
}

export function leaveTypeLabel(type: string) {
  const map: Record<string, string> = {
    Sick: "Sick",
    Casual: "Casual",
    Privileged: "Privilege",
    Privilege: "Privilege",
    ShortLeave: "Short Leave",
    CompOff: "Comp Off",
    LoP: "LoP",
    MtL: "Maternity",
    PtL: "Paternity",
  };
  return map[type] || type;
}
