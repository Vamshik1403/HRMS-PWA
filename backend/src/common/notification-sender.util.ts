/** Human-readable label for push / in-app notification actor (admin, manager, etc.). */

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Super Admin',
  SERVICE_PROVIDER: 'Service Provider',
  COMPANY_ADMIN: 'Admin',
  ADMIN: 'Admin',
  BRANCH_ADMIN: 'Branch Admin',
  MANAGER: 'Manager',
};

export function senderLabelFromRole(role?: string | null): string {
  const key = (role || '').trim().toUpperCase();
  if (!key) return 'HR';
  if (ROLE_LABELS[key]) return ROLE_LABELS[key];
  if (key === 'EMPLOYEE') return 'Manager';
  return key
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export function memoPushTitle(isWarning: boolean, senderLabel: string): string {
  const from = senderLabel.trim() || 'HR';
  return isWarning ? `Warning from ${from}` : `Notice from ${from}`;
}

export function leavePushTitle(status: string, senderLabel?: string): string {
  const by = senderLabel?.trim();
  const suffix = by ? ` by ${by}` : '';
  switch (status) {
    case 'Rejected':
      return `Leave rejected${suffix}`;
    case 'Partially Approved':
    case 'Partly Approved':
      return `Leave partially approved${suffix}`;
    case 'Approved':
    case 'Accepted':
      return `Leave approved${suffix}`;
    default:
      return by ? `Leave update from ${by}` : 'Leave update';
  }
}

export function reimbursementPushTitle(status: string, senderLabel?: string): string {
  const by = senderLabel?.trim();
  const suffix = by ? ` by ${by}` : '';
  switch (status) {
    case 'Rejected':
      return `Reimbursement rejected${suffix}`;
    case 'Paid':
      return `Reimbursement paid${suffix}`;
    case 'Approved':
    case 'Partially Approved':
    case 'Partly Approved':
      return `Reimbursement approved${suffix}`;
    default:
      return by ? `Reimbursement update from ${by}` : 'Reimbursement update';
  }
}
