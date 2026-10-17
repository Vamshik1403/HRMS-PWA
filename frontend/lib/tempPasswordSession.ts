const TEMP_PASSWORD_KEY = "openhrmTempPassword";

export function rememberTemporaryLoginPassword(password: string) {
  try {
    sessionStorage.setItem(TEMP_PASSWORD_KEY, password);
  } catch {
    /* private mode */
  }
}

export function readTemporaryLoginPassword(): string {
  try {
    return sessionStorage.getItem(TEMP_PASSWORD_KEY) || "";
  } catch {
    return "";
  }
}

export function clearTemporaryLoginPassword() {
  try {
    sessionStorage.removeItem(TEMP_PASSWORD_KEY);
  } catch {
    /* private mode */
  }
}

/** First-login change applies only to employees who still have a temporary password. */
export function employeeMustChangePassword(user: {
  mustChangePassword?: boolean;
  isCompanyOwner?: boolean;
  role?: string;
  employee?: { isCompanyOwner?: boolean } | null;
  employeeCredentials?: { mustChangePassword?: boolean } | null;
} | null | undefined): boolean {
  if (!user) return false;
  const isOwner = user.isCompanyOwner === true || user.employee?.isCompanyOwner === true;
  const role = String(user.role || "").toUpperCase();
  if (isOwner || role === "COMPANY_ADMIN" || role === "ADMIN") return false;
  return user.mustChangePassword === true || user.employeeCredentials?.mustChangePassword === true;
}
