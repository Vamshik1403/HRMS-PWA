export const COMPANY_BROADCAST_PREFIX = 'IM_COMPANY::';

export function isCompanyBroadcastSubject(subject?: string | null): boolean {
  const s = subject?.trim() ?? '';
  return (
    s.startsWith(COMPANY_BROADCAST_PREFIX) ||
    s.startsWith(`Re: ${COMPANY_BROADCAST_PREFIX}`)
  );
}

/** Leave, payroll, reimbursement, and named task assignment — not for the whole company. */
export function isPersonalHrBroadcastDescription(description?: string | null): boolean {
  const d = (description || '').trim();
  return /^(Leave |Payroll generated:|Salary paid:|Reimbursement |Task assigned:)/i.test(d);
}

export function personalHrDescriptionNamesViewer(
  description: string | null | undefined,
  viewer: {
    employeeFirstName?: string | null;
    employeeLastName?: string | null;
    employeeID?: string | null;
  },
): boolean {
  const d = (description || '').toLowerCase();
  if (!d) return false;
  const full = `${viewer.employeeFirstName || ''} ${viewer.employeeLastName || ''}`
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (full.length >= 3 && d.includes(full)) return true;
  const code = String(viewer.employeeID || '')
    .trim()
    .toLowerCase();
  if (code.length >= 3 && d.includes(code)) return true;
  return false;
}
