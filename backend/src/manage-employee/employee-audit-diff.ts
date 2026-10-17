const SECRET_FIELD = /password|token|secret|otp|hash/i;

function sameValue(previous: unknown, next: unknown): boolean {
  if (previous == null && next == null) return true;
  if (previous instanceof Date || next instanceof Date) {
    const a = previous instanceof Date ? previous.toISOString() : String(previous ?? '');
    const b = next instanceof Date ? next.toISOString() : String(next ?? '');
    return a === b;
  }
  return String(previous ?? '') === String(next ?? '');
}

/** Scalar fields that actually changed. Nested objects and secrets are left out. */
export function employeeFieldChanges(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
): Array<{ field: string; previous: unknown; next: unknown }> {
  const changes: Array<{ field: string; previous: unknown; next: unknown }> = [];
  for (const [field, next] of Object.entries(patch)) {
    if (next === undefined) continue;
    if (SECRET_FIELD.test(field)) continue;
    if (next !== null && typeof next === 'object') continue;
    const previous = before[field];
    if (sameValue(previous, next)) continue;
    changes.push({
      field,
      previous: previous ?? null,
      next: next ?? null,
    });
  }
  return changes;
}
