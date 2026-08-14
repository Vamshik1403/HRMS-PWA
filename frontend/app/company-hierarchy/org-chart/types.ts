export type EmployeeStatus = "active" | "inactive";

export interface Employee {
  id: string;
  name: string;
  title: string;
  avatar: string;
  department: string;
  location: string;
  managerId: string | null;
  email: string;
  phone: string;
  joinedDate: string;
  directReportCount: number;
  status: EmployeeStatus;
  employeeCode?: string;
  isL1?: boolean;
  isCompanyOwner?: boolean;
}

export interface OrgDepartment {
  id: string;
  name: string;
  location: string;
  employeeCount: number;
  parentDepartmentId: string | null;
}

export interface OrgCompany {
  id: string;
  name: string;
  logoUrl: string | null;
}

export interface OrgChartData {
  company: OrgCompany;
  employees: Employee[];
  departments: OrgDepartment[];
}

export type OrgNodeKind = "company" | "employee" | "department";

export type CompanyNodeData = {
  kind: "company";
  company: OrgCompany;
  selected: boolean;
  highlighted: boolean;
  hasChildren: boolean;
  expanded: boolean;
  onToggle: (id: string) => void;
};

export type EmployeeNodeData = {
  kind: "employee";
  employee: Employee;
  selected: boolean;
  highlighted: boolean;
  hasChildren: boolean;
  expanded: boolean;
  reports: Employee[];
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
};

export type DepartmentNodeData = {
  kind: "department";
  department: OrgDepartment;
  colorIndex: number;
  selected: boolean;
  highlighted: boolean;
  hasChildren: boolean;
  expanded: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
};

export type OrgNodeData = CompanyNodeData | EmployeeNodeData | DepartmentNodeData;
