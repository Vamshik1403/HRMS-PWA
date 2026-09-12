export type AssignmentRequestKind = 'working' | 'pending' | 'waiting';

export type AssignmentIdentityRow = {
  manageEmployeeID?: number | null;
  hrmsEmployeeId?: number | string | null;
  engineerEmail?: string | null;
  email?: string | null;
  status?: string | null;
  assignmentStatus?: string | null;
  requiresAccept?: boolean | null;
  showInRequests?: boolean | null;
  assignedDate?: Date | string | null;
  stale?: boolean | null;
  staleAssignment?: boolean | null;
};

export function normalizeAssignmentStatus(raw?: string | null): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  const key = value.replace(/[\s_-]+/g, '').toLowerCase();
  if (key === 'pending' || key === 'reschedulerejected') return 'Pending';
  if (key === 'assigned') return 'Assigned';
  if (key === 'accepted') return 'Accepted';
  if (key === 'reschedulerequested' || key === 'reschedulerequest') return 'RescheduleRequested';
  return value;
}

export function assignmentRequestKind(raw?: string | null): AssignmentRequestKind {
  const status = normalizeAssignmentStatus(raw);
  if (status === 'Pending') return 'pending';
  if (status === 'RescheduleRequested') return 'waiting';
  return 'working';
}

export function assignmentRequestKindFromRow(
  row?: AssignmentIdentityRow | null,
): AssignmentRequestKind {
  if (!row) return 'working';
  const status = normalizeAssignmentStatus(row.assignmentStatus || row.status);
  if (status === 'RescheduleRequested') return 'waiting';
  if (status === 'Pending') return 'pending';
  if (row.requiresAccept === true || row.showInRequests === true) return 'pending';
  return 'working';
}

export function isWorkingAssignmentStatus(raw?: string | null): boolean {
  return assignmentRequestKind(raw) === 'working';
}

export function assignmentRowMatchesEmployee(
  row: AssignmentIdentityRow | null | undefined,
  employeeId?: number | null,
  email?: string | null,
): boolean {
  if (!row) return false;
  const me = Number(employeeId);
  if (Number.isFinite(me) && me > 0) {
    if (Number(row.manageEmployeeID) === me || Number(row.hrmsEmployeeId) === me) return true;
  }
  const want = String(email || '').trim().toLowerCase();
  if (!want) return false;
  const have = String(row.engineerEmail || row.email || '').trim().toLowerCase();
  return !!have && have === want;
}

function pendingIdList(raw: unknown): string[] {
  if (raw == null) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  return values.map((v) => String(v).trim()).filter(Boolean);
}

function employeeInPendingList(employeeId: number | null | undefined, raw: unknown): boolean {
  if (employeeId == null) return false;
  const me = String(employeeId);
  return pendingIdList(raw).includes(me);
}

/** Persist ENPL's assignment machine. Job status alone must not decide Requests vs Open. */
export function inboundEngineerAssignmentStatus(
  raw?: string | null,
  _taskStatus?: string | null,
  opts?: {
    requiresAccept?: boolean | null;
    showInRequests?: boolean | null;
    hasPendingAssignment?: boolean | null;
    pendingAssignmentHrmsEmployeeIds?: unknown;
    hrmsEmployeeId?: number | null;
  },
): string {
  const status = normalizeAssignmentStatus(raw);
  if (status === 'Accepted' || status === 'RescheduleRequested') {
    return status;
  }
  if (status === 'Pending') return 'Pending';
  const inPendingList = employeeInPendingList(opts?.hrmsEmployeeId, opts?.pendingAssignmentHrmsEmployeeIds);
  const flagged =
    opts?.requiresAccept === true ||
    opts?.showInRequests === true ||
    inPendingList ||
    (opts?.hasPendingAssignment === true && pendingIdList(opts?.pendingAssignmentHrmsEmployeeIds).length === 0);
  if (flagged) return 'Pending';
  return status || 'Assigned';
}

export function canRecordSiteVisitForAssignment(row?: AssignmentIdentityRow | null): boolean {
  if (!row) return false;
  return assignmentRequestKindFromRow(row) === 'working';
}

export function asEngineerAssignmentRows(body: any): any[] | null {
  const raw = body?.engineerAssignments ?? body?.engineers ?? body?.assignedEngineers;
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') return [raw];
  return null;
}

function istCalendarDayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isStalePendingAssignment(opts: {
  status?: string | null;
  assignedDate?: Date | string | null;
  stale?: boolean | null;
  staleAssignment?: boolean | null;
  requiresAccept?: boolean | null;
  showInRequests?: boolean | null;
}): boolean {
  if (assignmentRequestKindFromRow(opts) !== 'pending') return false;
  if (opts.stale === true || opts.staleAssignment === true) return true;
  if (!opts.assignedDate) return false;
  const assigned = opts.assignedDate instanceof Date ? opts.assignedDate : new Date(opts.assignedDate);
  if (Number.isNaN(assigned.getTime())) return false;
  return istCalendarDayKey(assigned) < istCalendarDayKey(new Date());
}

export function decorateEngineerAssignment<T extends AssignmentIdentityRow>(
  row: T,
  inbound?: { stale?: boolean | null; staleAssignment?: boolean | null },
) {
  const kind = assignmentRequestKindFromRow(row);
  const status =
    kind === 'pending'
      ? 'Pending'
      : kind === 'waiting'
        ? 'RescheduleRequested'
        : normalizeAssignmentStatus(row.status) || row.status || null;
  const hrmsEmployeeId =
    row.manageEmployeeID != null
      ? row.manageEmployeeID
      : row.hrmsEmployeeId != null && Number.isFinite(Number(row.hrmsEmployeeId))
        ? Number(row.hrmsEmployeeId)
        : null;
  return {
    ...row,
    status,
    hrmsEmployeeId,
    requiresAccept: kind === 'pending',
    showInRequests: kind !== 'working',
    stale: isStalePendingAssignment({
      ...row,
      status,
      stale: inbound?.stale ?? row.stale,
      staleAssignment: inbound?.staleAssignment ?? row.staleAssignment,
    }),
  };
}

export function decorateTaskAssignmentHelpers<T extends { engineerAssignments?: AssignmentIdentityRow[] }>(
  task: T,
) {
  const rows = (task.engineerAssignments || []).map((row) => decorateEngineerAssignment(row));
  const pendingIds = rows
    .filter((row) => assignmentRequestKindFromRow(row) === 'pending' && row.hrmsEmployeeId != null)
    .map((row) => String(row.hrmsEmployeeId));
  return {
    ...task,
    engineerAssignments: rows,
    hasPendingAssignment: pendingIds.length > 0,
    pendingAssignmentHrmsEmployeeIds: pendingIds,
  };
}
