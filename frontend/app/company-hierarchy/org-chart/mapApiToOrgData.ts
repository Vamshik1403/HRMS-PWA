import { authHeaders } from "@/lib/auth";
import { MOCK_ORG_CHART } from "./mockData";
import type { Employee, OrgChartData, OrgDepartment } from "./types";

type ApiPerson = {
  id: number;
  employeeID: string | null;
  employeeFirstName: string | null;
  employeeLastName: string | null;
  employeePhotoUrl: string | null;
  businessEmail?: string | null;
  personalEmail?: string | null;
  businessPhoneNo?: string | null;
  personalPhoneNo?: string | null;
  joiningDate?: string | null;
  employmentStatus?: string | null;
  branchName: string | null;
  departmentName: string | null;
  designationName: string | null;
  managerIds: number[];
  reporteeIds: number[];
  isCompanyOwner: boolean;
  isL1: boolean;
};

type ApiDeptNode = {
  id: number;
  departmentName: string | null;
  parentDepartmentID: number | null;
  employeeCount: number;
  employees?: ApiPerson[];
  branches: { id: number; branchName: string | null }[];
  children: ApiDeptNode[];
};

type ApiHierarchy = {
  company?: { id: number; companyName: string | null; companyLogoUrl: string | null };
  l1Employees?: ApiPerson[];
  departmentTree?: ApiDeptNode[];
  employeeTree?: { employee: ApiPerson; children: unknown[] }[];
  unlinkedEmployees?: ApiPerson[];
};

function personName(p: ApiPerson) {
  const name = `${p.employeeFirstName ?? ""} ${p.employeeLastName ?? ""}`.trim();
  return name || p.employeeID || `Employee #${p.id}`;
}

function flattenPeople(payload: ApiHierarchy): ApiPerson[] {
  const map = new Map<number, ApiPerson>();
  const add = (p?: ApiPerson | null) => {
    if (p && !map.has(p.id)) map.set(p.id, p);
  };
  (payload.l1Employees ?? []).forEach(add);
  (payload.unlinkedEmployees ?? []).forEach(add);
  const walkTree = (nodes: { employee: ApiPerson; children?: { employee: ApiPerson; children?: unknown[] }[] }[]) => {
    for (const n of nodes || []) {
      add(n.employee);
      walkTree((n.children as typeof nodes) || []);
    }
  };
  walkTree((payload.employeeTree as { employee: ApiPerson; children?: { employee: ApiPerson }[] }[]) || []);
  const walkDept = (nodes: ApiDeptNode[]) => {
    for (const d of nodes || []) {
      (d.employees || []).forEach(add);
      walkDept(d.children || []);
    }
  };
  walkDept(payload.departmentTree || []);
  return [...map.values()];
}

function flattenDepartments(nodes: ApiDeptNode[], acc: OrgDepartment[] = []): OrgDepartment[] {
  for (const d of nodes || []) {
    acc.push({
      id: `dept-${d.id}`,
      name: d.departmentName || "Department",
      location: d.branches.map((b) => b.branchName).filter(Boolean).join(", "),
      employeeCount: d.employeeCount,
      parentDepartmentId: d.parentDepartmentID != null ? `dept-${d.parentDepartmentID}` : null,
    });
    flattenDepartments(d.children || [], acc);
  }
  return acc;
}

export function mapHierarchyApiToOrgData(payload: ApiHierarchy): OrgChartData {
  const people = flattenPeople(payload);
  const ids = new Set(people.map((p) => String(p.id)));

  const employees: Employee[] = people.map((p) => {
    const managerId = (p.managerIds || []).map(String).find((id) => ids.has(id) && id !== String(p.id)) ?? null;
    return {
      id: String(p.id),
      name: personName(p),
      title: p.designationName || (p.isCompanyOwner ? "Owner" : "Team member"),
      avatar: p.employeePhotoUrl || "",
      department: p.departmentName || (p.isL1 ? "Executive" : ""),
      location: p.branchName || "",
      managerId,
      email: p.businessEmail || p.personalEmail || "",
      phone: p.businessPhoneNo || p.personalPhoneNo || "",
      joinedDate: p.joiningDate || "",
      directReportCount: (p.reporteeIds || []).length,
      status: (p.employmentStatus || "ACTIVE").toLowerCase() === "inactive" ? "inactive" : "active",
      employeeCode: p.employeeID || undefined,
      isL1: Boolean(p.isL1),
      isCompanyOwner: Boolean(p.isCompanyOwner),
    };
  });

  return {
    company: {
      id: "company",
      name: payload.company?.companyName || "Company",
      logoUrl: payload.company?.companyLogoUrl || null,
    },
    employees,
    departments: flattenDepartments(payload.departmentTree || []),
  };
}

/**
 * Load org-chart data.
 *
 * Swap point for the live HRMS API:
 *   GET /backend/company-hierarchy?companyID=<id>
 * If the request fails or returns no people, mock data is used so the page still works.
 */
export async function loadOrgChartData(companyID: string | number | null): Promise<{
  data: OrgChartData;
  source: "api" | "mock";
}> {
  if (companyID == null || companyID === "") {
    return { data: MOCK_ORG_CHART, source: "mock" };
  }
  try {
    const res = await fetch(`/backend/company-hierarchy?companyID=${companyID}`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as ApiHierarchy;
    const mapped = mapHierarchyApiToOrgData(json);
    if (!mapped.employees.length) return { data: MOCK_ORG_CHART, source: "mock" };
    return { data: mapped, source: "api" };
  } catch {
    return { data: MOCK_ORG_CHART, source: "mock" };
  }
}
