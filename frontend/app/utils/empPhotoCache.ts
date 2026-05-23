const LEGACY_KEY = "_emp_photo";

function photoKey(empId: string): string {
  return `_emp_photo_${empId}`;
}

export function getEmpPhoto(empId: string | null | undefined): string | null {
  if (!empId || typeof window === "undefined") return null;
  try {
    return localStorage.getItem(photoKey(empId));
  } catch {
    return null;
  }
}

export function setEmpPhoto(empId: string | null | undefined, url: string | null | undefined): void {
  if (!empId || typeof window === "undefined") return;
  try {
    const key = photoKey(empId);
    if (url) localStorage.setItem(key, url);
    else localStorage.removeItem(key);
  } catch {}
}

/** Remove the old global photo key that leaked across employee accounts. */
export function clearLegacyEmpPhoto(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
}

export function resolveEmpPhoto(
  empId: string | null | undefined,
  apiPhoto?: string | null,
): string | null {
  if (apiPhoto) return apiPhoto;
  return getEmpPhoto(empId);
}
