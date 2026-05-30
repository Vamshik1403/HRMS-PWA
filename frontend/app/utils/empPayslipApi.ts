const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

/** Payslips employees may view (generated or paid — not hidden while pending). */
export const EMP_PAYSLIP_VISIBLE_STATUSES = ["Pending", "Paid"] as const;

export interface EmpPayslipRow {
  id: number;
  monthPeriod: string;
  companyID?: number;
  branchesID?: number;
  employeeID?: number;
  manageEmployeeID?: number;
  status?: string;
  paymentMode?: string | null;
  paymentType?: string | null;
  paymentDate?: string | null;
  paymentRemark?: string | null;
  company?: { companyName?: string };
  branches?: { branchName?: string };
  manageEmployee?: {
    id?: number;
    employeeID?: string;
    employeeFirstName?: string;
    employeeLastName?: string;
  };
}

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function isPayslipVisibleToEmployee(status?: string | null): boolean {
  if (!status || status.trim() === "") return true;
  return (EMP_PAYSLIP_VISIBLE_STATUSES as readonly string[]).includes(status);
}

export async function fetchEmployeePayslips(): Promise<EmpPayslipRow[]> {
  const [salaryRes, credsRes, userRaw] = await Promise.all([
    fetch(`${BACKEND}/generate-salary`, { headers: authHeaders(), cache: "no-store" }),
    fetch(`${BACKEND}/manage-emp/credentials/all`, { headers: authHeaders(), cache: "no-store" }),
    Promise.resolve(typeof window !== "undefined" ? localStorage.getItem("user") : null),
  ]);

  if (!salaryRes.ok) return [];
  const allItems: EmpPayslipRow[] = await salaryRes.json();
  if (!Array.isArray(allItems)) return [];

  let username = "";
  try {
    if (userRaw) username = JSON.parse(userRaw).username || "";
  } catch {
    /* ignore */
  }

  let emp: { companyID?: number; branchesID?: number; employeeID?: number } | null = null;
  if (credsRes.ok) {
    const creds = await credsRes.json();
    if (Array.isArray(creds) && username) {
      emp = creds.find((c: { username?: string }) => c.username === username) ?? null;
    }
  }

  if (!emp?.employeeID) return [];

  return allItems.filter(
    (r) =>
      r.companyID === emp!.companyID &&
      r.branchesID === emp!.branchesID &&
      (r.manageEmployeeID === emp!.employeeID ||
        r.manageEmployee?.id === emp!.employeeID ||
        r.employeeID === emp!.employeeID) &&
      isPayslipVisibleToEmployee(r.status),
  );
}

/** @deprecated Use fetchEmployeePayslips */
export const fetchEmployeePaidPayslips = fetchEmployeePayslips;

export async function fetchEmployeePayslipById(id: number): Promise<EmpPayslipRow | null> {
  const res = await fetch(`${BACKEND}/generate-salary/${id}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

function parseMonthYearFromSegment(segment: string): { month: number; year: number; label: string } | null {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  for (let i = 0; i < months.length; i++) {
    if (segment.includes(months[i])) {
      const yearMatch = segment.match(/\d{4}/);
      const year = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();
      return { month: i + 1, year, label: `${months[i]} ${year}` };
    }
  }
  return null;
}

/** Month/year for Payout filter — uses cycle end date when period is a range (e.g. "1 Apr … to 20 May 2026" → May 2026). */
export function parseMonthYearFromPeriod(period: string): { month: number; year: number; label: string } | null {
  if (!period?.trim()) return null;
  if (period.includes(" to ")) {
    const endPart = period.split(" to ").pop()?.trim() ?? period;
    const fromEnd = parseMonthYearFromSegment(endPart);
    if (fromEnd) return fromEnd;
  }
  return parseMonthYearFromSegment(period);
}

export function empPayoutHrefForPeriod(monthPeriod: string): string {
  const parsed = parseMonthYearFromPeriod(monthPeriod);
  if (!parsed) return "/empPayout";
  return `/empPayout?month=${parsed.month}&year=${parsed.year}`;
}

export function formatPayslipMonthYear(period: string) {
  const p = parseMonthYearFromPeriod(period);
  return p?.label ?? period;
}
