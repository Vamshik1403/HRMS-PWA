/** Modules and devices excluded from Super Admin audit trail (PWA / push noise). */
export const EXCLUDED_AUDIT_MODULES = [
  'PUSH_NOTIFICATIONS',
  'EMP_NOTIFICATIONS',
  'EMP_LOCATION_ATTENDANCE',
] as const;

export const PWA_DEVICE_TYPES = ['mobile', 'tablet'] as const;

export const PWA_API_PATH_PREFIXES = [
  '/push-notifications',
  '/emp-notifications',
  '/emp-location-attendance',
] as const;

/** Prisma where fragment: desktop/laptop admin audit only. */
export function desktopAuditWhere(
  filters: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    AND: [
      filters,
      { module: { notIn: [...EXCLUDED_AUDIT_MODULES] } },
      { NOT: { deviceType: { in: [...PWA_DEVICE_TYPES] } } },
    ],
  };
}

export function isPwaApiPath(path: string): boolean {
  const p = path.toLowerCase();
  return PWA_API_PATH_PREFIXES.some((prefix) => p.includes(prefix));
}

export function isPwaDevice(deviceType: string | null | undefined): boolean {
  if (!deviceType) return false;
  return (PWA_DEVICE_TYPES as readonly string[]).includes(deviceType);
}

export function isEmployeeJwtUser(user?: Record<string, unknown> | null): boolean {
  if (!user) return false;
  return user.type === 'employee' || user.role === 'EMPLOYEE';
}
