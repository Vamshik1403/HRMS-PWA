import { canonicalTaskStatus } from "../components/task/task-types";
import { isActiveTaskStatus } from "./taskStatusFlow";

export type AssignmentRequestKind = "working" | "pending" | "waiting";

export type EngineerAssignmentRow = {
  manageEmployeeID?: number | null;
  hrmsEmployeeId?: number | string | null;
  engineerEmail?: string | null;
  email?: string | null;
  status?: string | null;
  assignmentStatus?: string | null;
  requiresAccept?: boolean | null;
  showInRequests?: boolean | null;
  assignedDate?: string | Date | null;
  rescheduleReason?: string | null;
  managerReason?: string | null;
  stale?: boolean | null;
  staleAssignment?: boolean | null;
};

export type AssignmentTask = {
  status: string;
  engineerAssignments?: EngineerAssignmentRow[];
  hasPendingAssignment?: boolean | null;
  pendingAssignmentHrmsEmployeeIds?: Array<string | number> | null;
};

export function normalizeAssignmentStatus(raw?: string | null): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  const key = value.replace(/[\s_-]+/g, "").toLowerCase();
  if (key === "pending" || key === "reschedulerejected") return "Pending";
  if (key === "assigned") return "Assigned";
  if (key === "accepted") return "Accepted";
  if (key === "reschedulerequested" || key === "reschedulerequest") return "RescheduleRequested";
  return value;
}

export function assignmentRequestKind(raw?: string | null): AssignmentRequestKind {
  const status = normalizeAssignmentStatus(raw);
  if (status === "Pending") return "pending";
  if (status === "RescheduleRequested") return "waiting";
  return "working";
}

export function assignmentRequestKindFromRow(
  row?: EngineerAssignmentRow | null,
): AssignmentRequestKind {
  if (!row) return "working";
  const status = normalizeAssignmentStatus(row.assignmentStatus || row.status);
  if (status === "RescheduleRequested") return "waiting";
  if (status === "Pending") return "pending";
  if (row.requiresAccept === true || row.showInRequests === true) return "pending";
  return "working";
}

export function isWorkingAssignmentStatus(raw?: string | null): boolean {
  return assignmentRequestKind(raw) === "working";
}

export function assignmentRowMatchesEmployee(
  row: EngineerAssignmentRow | null | undefined,
  employeeId?: number | null,
  email?: string | null,
): boolean {
  if (!row) return false;
  const me = Number(employeeId);
  if (Number.isFinite(me) && me > 0) {
    if (Number(row.manageEmployeeID) === me || Number(row.hrmsEmployeeId) === me) return true;
  }
  const want = String(email || "").trim().toLowerCase();
  if (!want) return false;
  const have = String(row.engineerEmail || row.email || "").trim().toLowerCase();
  return !!have && have === want;
}

export function myEngineerAssignment<T extends { engineerAssignments?: EngineerAssignmentRow[] }>(
  task: T,
  employeeId?: number | null,
  email?: string | null,
): EngineerAssignmentRow | null {
  if (!task.engineerAssignments?.length) return null;
  return (
    task.engineerAssignments.find((row) => assignmentRowMatchesEmployee(row, employeeId, email)) ||
    null
  );
}

function employeeInPendingList(
  employeeId?: number | null,
  ids?: Array<string | number> | null,
): boolean {
  if (employeeId == null || !ids?.length) return false;
  const me = String(employeeId);
  return ids.some((id) => String(id).trim() === me);
}

export function myAssignmentRequestKind<T extends AssignmentTask>(
  task: T,
  employeeId?: number | null,
  email?: string | null,
): AssignmentRequestKind {
  const mine = myEngineerAssignment(task, employeeId, email);
  const fromRow = assignmentRequestKindFromRow(mine);
  if (fromRow !== "working") return fromRow;
  if (employeeInPendingList(employeeId, task.pendingAssignmentHrmsEmployeeIds)) return "pending";
  return "working";
}

export function isAssignmentRequestTask<T extends AssignmentTask>(
  task: T,
  employeeId?: number | null,
  email?: string | null,
): boolean {
  return myAssignmentRequestKind(task, employeeId, email) !== "working";
}

function istCalendarDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isStalePendingAssignment(row?: EngineerAssignmentRow | null): boolean {
  if (!row || assignmentRequestKindFromRow(row) !== "pending") return false;
  if (row.stale === true || row.staleAssignment === true) return true;
  if (!row.assignedDate) return false;
  const assigned = row.assignedDate instanceof Date ? row.assignedDate : new Date(row.assignedDate);
  if (Number.isNaN(assigned.getTime())) return false;
  return istCalendarDayKey(assigned) < istCalendarDayKey(new Date());
}

export type EmpTaskStatusTab = "Requests" | "Open" | "WIP" | "Closed" | "Reopen";

export function matchesEmpTaskTab<T extends AssignmentTask>(
  task: T,
  tab: EmpTaskStatusTab,
  employeeId?: number | null,
  email?: string | null,
): boolean {
  const request = isAssignmentRequestTask(task, employeeId, email);
  if (tab === "Requests") return request;
  if (request) return false;
  const mine = myEngineerAssignment(task, employeeId, email);
  const hasEngineerRows =
    (task.engineerAssignments?.length || 0) > 0 ||
    (task.pendingAssignmentHrmsEmployeeIds?.length || 0) > 0;
  if (!mine && hasEngineerRows) return false;
  if (mine && assignmentRequestKindFromRow(mine) !== "working") return false;
  const canonical = canonicalTaskStatus(task.status);
  if (tab === "Open") return canonical === "Open" || canonical === "Scheduled" || canonical === "Rescheduled";
  if (tab === "WIP") return canonical === "Work in Progress" || canonical === "On-Hold";
  if (tab === "Closed") return canonical === "Completed";
  return canonical === "Reopen";
}

export function isWorkingActiveAssignedTask<T extends AssignmentTask>(
  task: T,
  employeeId?: number | null,
  email?: string | null,
): boolean {
  if (isAssignmentRequestTask(task, employeeId, email)) return false;
  const mine = myEngineerAssignment(task, employeeId, email);
  const hasEngineerRows =
    (task.engineerAssignments?.length || 0) > 0 ||
    (task.pendingAssignmentHrmsEmployeeIds?.length || 0) > 0;
  if (!mine && hasEngineerRows) return false;
  if (mine && assignmentRequestKindFromRow(mine) !== "working") return false;
  return isActiveTaskStatus(task.status);
}
