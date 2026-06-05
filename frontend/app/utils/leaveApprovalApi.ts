import type { LeaveBalance } from "./leaveApprovalLogic";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export async function fetchEmployeeLeaveBalance(employeeId: number): Promise<{
  balance: LeaveBalance;
  gender: string | null;
}> {
  const [empRes, plDataRaw, balanceRecordRaw, leaveRes] = await Promise.all([
    fetch(`${BACKEND}/manage-emp/${employeeId}`, { cache: "no-store" }).then((r) =>
      r.ok ? r.json() : null,
    ),
    fetch(`${BACKEND}/privileged-leave/employee/${employeeId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    fetch(`${BACKEND}/emp-leave-balance/employee/${employeeId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})),
    fetch(`${BACKEND}/leave-application`, { cache: "no-store" }).then((r) =>
      r.ok ? r.json() : [],
    ),
  ]);

  const employee = empRes ?? {};
  const policy =
    employee.leavePolicy ||
    ([...(employee.empLeavePolicy ?? [])].sort(
      (a: { effectFrom?: string }, b: { effectFrom?: string }) =>
        new Date(b.effectFrom || 0).getTime() - new Date(a.effectFrom || 0).getTime(),
    )[0]?.leavePolicy as Record<string, unknown>) ||
    {};

  const totalSick = Number(policy.sickLeaveCount) || 0;
  const totalCasual = Number(policy.casualLeaveCount) || 0;
  const totalPrivileged = Array.isArray(plDataRaw)
    ? plDataRaw.reduce((s: number, e: { balanceLeaves?: number }) => s + (Number(e.balanceLeaves) || 0), 0)
    : 0;
  const totalMaternity = Number(policy.maternityLeaveCount) || 182;
  const totalPaternity = Number(policy.paternityLeaveCount) || 15;

  const approved = (Array.isArray(leaveRes) ? leaveRes : []).filter(
    (l: { manageEmployeeID?: number; status?: string }) =>
      l.manageEmployeeID === employeeId &&
      ["Approved", "Accepted", "Partially Approved", "Partly Approved"].includes(l.status || ""),
  );

  let usedSick = 0;
  let usedCasual = 0;
  let usedPrivileged = 0;
  let usedCompOff = 0;
  let usedMaternity = 0;
  let usedPaternity = 0;

  approved.forEach((leave: { dayStatuses?: { status?: string }[]; fromDate?: string; toDate?: string; appliedLeaveType?: string }) => {
    if (Array.isArray(leave.dayStatuses)) {
      leave.dayStatuses.forEach((day) => {
        switch (day.status) {
          case "Sick": usedSick += 1; break;
          case "Casual": usedCasual += 1; break;
          case "Privileged": usedPrivileged += 1; break;
          case "CompOff": usedCompOff += 1; break;
          case "MtL": usedMaternity += 1; break;
          case "PtL": usedPaternity += 1; break;
        }
      });
    }
  });

  const br = balanceRecordRaw as Record<string, number>;
  usedSick = Math.max(usedSick, Number(br.sickUsed) || 0);
  usedCasual = Math.max(usedCasual, Number(br.casualUsed) || 0);
  usedPrivileged = Math.max(usedPrivileged, Number(br.privilegedUsed) || 0);

  const mk = (used: number, total: number) => ({
    used: Math.min(used, total),
    total,
    remaining: Math.max(total - used, 0),
  });

  return {
    balance: {
      sick: mk(usedSick, totalSick),
      casual: mk(usedCasual, totalCasual),
      privileged: mk(usedPrivileged, totalPrivileged),
      compOff: mk(usedCompOff, 0),
      maternity: mk(usedMaternity, totalMaternity),
      paternity: mk(usedPaternity, totalPaternity),
    },
    gender: (employee.gender as string) ?? null,
  };
}
