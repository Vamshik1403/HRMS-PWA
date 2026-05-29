const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

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

export async function fetchEmployeePaidPayslips(): Promise<EmpPayslipRow[]> {
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
      r.status === "Paid",
  );
}

export function parseMonthYearFromPeriod(period: string): { month: number; year: number; label: string } | null {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  for (let i = 0; i < months.length; i++) {
    if (period.includes(months[i])) {
      const yearMatch = period.match(/\d{4}/);
      const year = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();
      return { month: i + 1, year, label: `${months[i]} ${year}` };
    }
  }
  return null;
}

export function formatPayslipMonthYear(period: string) {
  const p = parseMonthYearFromPeriod(period);
  return p?.label ?? period;
}
