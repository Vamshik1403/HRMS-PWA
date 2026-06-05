export type EmpManagerReportee = {
  id: number;
  employeeID?: string;
  employeeFirstName?: string;
  employeeLastName?: string;
};

export type EmpManagerScope = {
  employeeId: number;
  reporteeIds: number[];
  hasReportees: boolean;
  reportees: EmpManagerReportee[];
};

export function reporteeDisplayName(r: EmpManagerReportee): string {
  const name = [r.employeeFirstName, r.employeeLastName].filter(Boolean).join(" ").trim();
  return name || r.employeeID || `Employee #${r.id}`;
}

export function nameForEmployeeId(scope: EmpManagerScope | null, id?: number | null): string | null {
  if (!id || !scope) return null;
  const r = scope.reportees.find((x) => x.id === id);
  return r ? reporteeDisplayName(r) : null;
}

/** Reportees only (excludes the logged-in manager). */
export function teamReportees(scope: EmpManagerScope | null): EmpManagerReportee[] {
  if (!scope?.hasReportees) return [];
  return scope.reportees.filter((r) => r.id !== scope.employeeId);
}

export function isTeamMemberId(scope: EmpManagerScope | null, id?: number | null): boolean {
  if (!scope?.hasReportees || !id) return false;
  return id !== scope.employeeId && scope.reporteeIds.includes(id);
}

function rewriteFirstPerson(body: string, name: string): string {
  return body
    .replace(/^Your /i, `${name}'s `)
    .replace(/^You have been /i, `${name} has been `)
    .replace(/^You have /i, `${name} has `)
    .replace(/^You were /i, `${name} was `);
}

/** Re-label employee-centric push/feed copy for a manager viewing team activity. */
export function formatManagerNotificationCopy(
  item: {
    title: string;
    body: string;
    subjectEmployeeId?: number;
    subjectEmployeeName?: string;
    isTeamItem?: boolean;
  },
  scope: EmpManagerScope | null,
): { title: string; body: string } {
  if (!scope?.hasReportees) return { title: item.title, body: item.body };

  let name =
    item.subjectEmployeeName ||
    nameForEmployeeId(scope, item.subjectEmployeeId) ||
    null;

  if (!name && item.isTeamItem && teamReportees(scope).length === 1) {
    name = reporteeDisplayName(teamReportees(scope)[0]);
  }

  if (!name) {
    const looksEmployeeCentric =
      /^your /i.test(item.body) ||
      /^you have /i.test(item.body) ||
      /^you were /i.test(item.body) ||
      /you have been assigned/i.test(item.body);
    if (looksEmployeeCentric && teamReportees(scope).length === 1) {
      name = reporteeDisplayName(teamReportees(scope)[0]);
    }
  }

  if (!name) return { title: item.title, body: item.body };

  const title =
    item.title.includes(name) || item.title.startsWith(`${name}:`)
      ? item.title
      : `${name}: ${item.title}`;

  return {
    title,
    body: rewriteFirstPerson(item.body, name),
  };
}

export function taskAssigneeTeamLabel(
  scope: EmpManagerScope | null,
  assignments?: { manageEmployeeID?: number; manageEmployee?: { employeeFirstName?: string; employeeLastName?: string; employeeID?: string } }[],
): string | null {
  if (!scope?.hasReportees || !assignments?.length) return null;
  const teamIds = assignments
    .map((a) => a.manageEmployeeID)
    .filter((id): id is number => !!id && isTeamMemberId(scope, id));
  if (!teamIds.length) return null;
  const names = teamIds.map((id) => {
    const fromAssign = assignments.find((a) => a.manageEmployeeID === id)?.manageEmployee;
    if (fromAssign) {
      const n = [fromAssign.employeeFirstName, fromAssign.employeeLastName].filter(Boolean).join(" ").trim();
      if (n) return n;
    }
    return nameForEmployeeId(scope, id) || `Employee #${id}`;
  });
  return [...new Set(names)].join(", ");
}
