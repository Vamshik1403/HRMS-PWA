"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  GitBranch,
  Plus,
  Save,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";

import { FormDrawer } from "../components/ui/form-drawer";
import { NoticeBanner } from "../components/ui/notice-banner";

import { PageHeader } from "../components/app/page-header";
import {
  FilterBar,
  FilterSelect,
} from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import { EntityRowActions } from "../components/app/entity-row-actions";
import { DetailCard } from "../components/app/detail-card";
import {
  EntityDetailHero,
  EntityDetailLayout,
} from "../components/app/entity-detail-layout";

import type { DataTableColumn } from "../components/app/data-table";
import {
  sortRows,
  useClientTable,
} from "../hooks/use-client-table";

import { useCurrentUser } from "../hooks/useCurrentUser";
import { getSidebarContext } from "../utils/sidebarContext";
import { resolveScopeUserMapping } from "../utils/scopeContext";
import { isCompanyAdminLikeRole } from "@/lib/companyAccess";

type ID = number;

interface CompanyRead {
  id: ID;
  companyName: string;
  serviceProviderID?: ID | null;
}

interface BranchRead {
  id: ID;
  branchName: string;
  companyID?: ID | null;
  serviceProviderID?: ID | null;
}

interface DepartmentRead {
  id: ID;
  departmentName?: string | null;
  companyID?: ID | null;
  branchesID?: ID | null;
}

interface EmployeeRead {
  id: ID;
  serviceProviderID?: ID | null;
  companyID?: ID | null;
  branchesID?: ID | null;
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
  employeeID?: string | null;
}

interface DesignationRead {
  id: ID;
  designation?: string | null;
  branchesID?: ID | null;
  departmentID?: ID | null;
  companyID?: ID | null;
  isManager?: boolean | null;

  branches?: {
    id: ID;
    branchName?: string | null;
    companyID?: ID | null;
  } | null;

  departments?: {
    id: ID;
    departmentName?: string | null;
  } | null;
}

interface CompanyModuleRead {
  id: ID;
  moduleKey?: string | null;
  moduleName: string;
  moduleDescription?: string | null;
  moduleStatus?: boolean | null;
}

interface WorkflowStepRead {
  id?: ID;
  approvalWorkflowID?: ID;
  stepNo: number;
  designationID?: ID | null;
  approverType?: string | null;
  stepName?: string | null;
  isMandatory?: boolean;
  canReject?: boolean;
  canSendBack?: boolean;
  approvalTimeout?: number | null;

  designation?: {
    id: ID;
    designation?: string | null;
    branchesID?: ID | null;
    departmentID?: ID | null;
    isManager?: boolean | null;

    branches?: {
      id: ID;
      branchName?: string | null;
    } | null;

    departments?: {
      id: ID;
      departmentName?: string | null;
    } | null;
  } | null;
}


type ConditionMatchType = "ALL" | "ANY";

type WorkflowConditionField =
  | "BRANCH"
  | "DEPARTMENT"
  | "DESIGNATION"
  | "EMPLOYEE"
  | "TOTAL_AMOUNT"
  | "SALARY_AMOUNT"
  | "LEAVE_TYPE"
  | "LEAVE_DAYS"
  | "EXIT_TYPE"
  | "REGULARISATION_TYPE"
  | "REGULARISATION_DAYS"
  | "REQUEST_TEXT";

type WorkflowConditionOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "GREATER_THAN"
  | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN"
  | "LESS_THAN_OR_EQUAL"
  | "IN"
  | "NOT_IN"
  | "CONTAINS"
  | "NOT_CONTAINS"
  | "BETWEEN"
  | "IS_EMPTY"
  | "IS_NOT_EMPTY";

type WorkflowConditionValueType =
  | "BRANCH"
  | "DEPARTMENT"
  | "DESIGNATION"
  | "EMPLOYEE_LIST"
  | "NUMBER"
  | "TEXT"
  | "BOOLEAN"
  | "DATE";

interface WorkflowConditionEmployeeRead {
  id?: ID;
  manageEmployeeID: ID;
  employee?: EmployeeRead | null;
}

interface WorkflowConditionRead {
  id?: ID;
  approvalWorkflowID?: ID;
  conditionNo: number;

  fieldKey: WorkflowConditionField;
  operator: WorkflowConditionOperator;
  valueType: WorkflowConditionValueType;

  departmentID?: ID | null;
  designationID?: ID | null;
  branchesID?: ID | null;

  numberValue?: string | number | null;
  numberValueTo?: string | number | null;
  textValue?: string | null;
  booleanValue?: boolean | null;
  dateValue?: string | null;
  dateValueTo?: string | null;

  department?: DepartmentRead | null;
  designation?: DesignationRead | null;
  branches?: BranchRead | null;
  employees?: WorkflowConditionEmployeeRead[];
}

interface ApprovalWorkflowRead {
  id: ID;
  serviceProviderID?: ID | null;
  companyID: ID;
  branchesID?: ID | null;
  companyModuleID: ID;

  workflowName: string;
  workflowDescription?: string | null;
  effectiveFrom: string;

  conditionMatchType?: ConditionMatchType;
  allowAnySameDesignation?: boolean;
  workflowStatus?: boolean;

  createdAt?: string | null;
  updatedAt?: string | null;

  company?: {
    id: ID;
    companyName?: string | null;
  } | null;

  branches?: {
    id: ID;
    branchName?: string | null;
  } | null;

  companyModule?: CompanyModuleRead | null;

  steps: WorkflowStepRead[];
  conditions?: WorkflowConditionRead[];
}

interface WorkflowStepForm {
  id?: ID;
  localID: string;
  stepNo: number;
  approverType: "DESIGNATION" | "REPORTING_MANAGER";
  designationID: ID | null;
  designationName: string;
  stepName: string;
  isMandatory: boolean;
  canReject: boolean;
  canSendBack: boolean;
  approvalTimeout: string;
}

interface WorkflowForm {
  serviceProviderID: ID | null;
  companyID: ID | null;
  branchesID: ID | null;
  companyModuleID: ID | null;

  companyAutocomplete: string;
  branchAutocomplete: string;
  moduleAutocomplete: string;

  workflowName: string;
  workflowDescription: string;
  effectiveFrom: string;

  conditionMatchType: ConditionMatchType;
  allowAnySameDesignation: boolean;
  workflowStatus: boolean;

  steps: WorkflowStepForm[];
  conditions: WorkflowConditionForm[];
}

interface WorkflowConditionForm {
  id?: ID;
  localID: string;
  conditionNo: number;

  fieldKey: WorkflowConditionField | "";
  operator: WorkflowConditionOperator | "";
  valueType: WorkflowConditionValueType | "";

  departmentID: ID | null;
  departmentName: string;

  designationID: ID | null;
  designationName: string;

  branchesID: ID | null;
  branchName: string;

  employeeIDs: ID[];
  selectedEmployees: EmployeeRead[];
  employeeSearch: string;

  numberValue: string;
  numberValueTo: string;
  textValue: string;

  isActive: boolean;
}

const API = {
  workflows: "/backend/approval-workflows",
  companies: "/backend/company",
  branches: "/backend/branches",
  departments: "/backend/departments",
  designations: "/backend/designations",
  employees: "/backend/manage-emp/workflow-search",
  companyModules: "/backend/company-modules",
} as const;

const COMMON_ORG_CONDITION_FIELDS: WorkflowConditionField[] = [
  "BRANCH",
  "DEPARTMENT",
  "DESIGNATION",
  "EMPLOYEE",
];



function resolveModuleConditionKey(
  module: CompanyModuleRead,
): string | null {
  const rawKey =
    module.moduleKey?.trim();

  if (rawKey) {
    const normalizedKey =
      rawKey.toUpperCase();

    if (
      normalizedKey in
      MODULE_CONDITION_FIELDS
    ) {
      return normalizedKey;
    }
  }

  const normalizedName =
    module.moduleName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  if (
    normalizedName in
    MODULE_CONDITION_FIELDS
  ) {
    return normalizedName;
  }

  if (
    normalizedName.includes(
      "REIMBURSE",
    )
  ) {
    return "REIMBURSEMENT";
  }

  if (
    normalizedName.includes(
      "LEAVE",
    )
  ) {
    return "LEAVE_MANAGEMENT";
  }

  if (
    normalizedName.includes(
      "PAYROLL",
    ) ||
    normalizedName.includes(
      "SALARY",
    )
  ) {
    return "SALARY_MANAGEMENT";
  }

  if (
    normalizedName.includes(
      "OFF_BOARD",
    ) ||
    normalizedName.includes(
      "OFFBOARD",
    ) ||
    normalizedName.includes(
      "TERMINATION",
    )
  ) {
    return "OFF_BOARDING";
  }

  if (
    normalizedName.includes(
      "REGULAR",
    ) ||
    normalizedName.includes(
      "ATTENDANCE",
    )
  ) {
    return "ATTENDANCE_REGULARISATION";
  }

  return null;
}

const MIN_CHARS = 0;
const DEBOUNCE_MS = 250;

const MODULE_CONDITION_FIELDS: Record<
  string,
  WorkflowConditionField[]
> = {

  EMPLOYEE_ONBOARDING_MODULE: [
    'BRANCH',
    'DEPARTMENT',
    'DESIGNATION',
    'EMPLOYEE',
  ],

  REIMBURSEMENT_MODULE: [
    'BRANCH',
    'DEPARTMENT',
    'DESIGNATION',
    'EMPLOYEE',
    'TOTAL_AMOUNT',
  ],

  LEAVE_MODULE: [
    'BRANCH',
    'DEPARTMENT',
    'DESIGNATION',
    'EMPLOYEE',
    'LEAVE_TYPE',
    'LEAVE_DAYS',
  ],

  PAYROLL_MODULE: [
    'BRANCH',
    'DEPARTMENT',
    'DESIGNATION',
    'EMPLOYEE',
    'SALARY_AMOUNT',
  ],

  REIMBURSEMENT: [
    "BRANCH",
    "DEPARTMENT",
    "DESIGNATION",
    "EMPLOYEE",
    "TOTAL_AMOUNT",
  ],



  PAYROLL: [
    "BRANCH",
    "DEPARTMENT",
    "DESIGNATION",
    "EMPLOYEE",
    "SALARY_AMOUNT",
  ],



  SALARY_MANAGEMENT: [
    "BRANCH",
    "DEPARTMENT",
    "DESIGNATION",
    "EMPLOYEE",
    "SALARY_AMOUNT",
  ],

  LEAVE: [
    "BRANCH",
    "DEPARTMENT",
    "DESIGNATION",
    "EMPLOYEE",
    "LEAVE_TYPE",
    "LEAVE_DAYS",
  ],

 

  LEAVE_MANAGEMENT: [
    "BRANCH",
    "DEPARTMENT",
    "DESIGNATION",
    "EMPLOYEE",
    "LEAVE_TYPE",
    "LEAVE_DAYS",
  ],

  OFF_BOARDING: [
    "BRANCH",
    "DEPARTMENT",
    "DESIGNATION",
    "EMPLOYEE",
    "EXIT_TYPE",
  ],

  OFFBOARDING: [
    "BRANCH",
    "DEPARTMENT",
    "DESIGNATION",
    "EMPLOYEE",
    "EXIT_TYPE",
  ],

  OFF_BOARDING_MODULE: [
    "BRANCH",
    "DEPARTMENT",
    "DESIGNATION",
    "EMPLOYEE",
    "EXIT_TYPE",
  ],

  ATTENDANCE_REGULARISATION: [
    "BRANCH",
    "DEPARTMENT",
    "DESIGNATION",
    "EMPLOYEE",
    "REGULARISATION_TYPE",
    "REGULARISATION_DAYS",
  ],

  ATTENDANCE_REGULARIZATION: [
    "BRANCH",
    "DEPARTMENT",
    "DESIGNATION",
    "EMPLOYEE",
    "REGULARISATION_TYPE",
    "REGULARISATION_DAYS",
  ],

  ATTENDANCE_MODULE: [
    "BRANCH",
    "DEPARTMENT",
    "DESIGNATION",
    "EMPLOYEE",
    "REGULARISATION_TYPE",
    "REGULARISATION_DAYS",
  ],
};

const CONDITION_FIELD_LABELS: Record<
  WorkflowConditionField,
  string
> = {

  BRANCH: "Branch",
  DEPARTMENT: "Department",
  DESIGNATION: "Designation",
  EMPLOYEE: "Employee",
  TOTAL_AMOUNT: "Total Amount",
  SALARY_AMOUNT: "Salary Amount",
  LEAVE_TYPE: "Leave Type",
  LEAVE_DAYS: "Leave Days",
  EXIT_TYPE: "Exit Type",
  REGULARISATION_TYPE: "Regularisation Type",
  REGULARISATION_DAYS: "Regularisation Days",
  REQUEST_TEXT: "Request Text",
};

const REGULARISATION_TYPE_OPTIONS = [
  { value: "PRESENT", label: "Present" },
  { value: "HALF_DAY", label: "Half Day" },
  { value: "LATE_MARK", label: "Late Mark" },
  { value: "SL", label: "Sick Leave (SL)" },
  { value: "CL", label: "Casual Leave (CL)" },
  { value: "PL", label: "Privilege Leave (PL)" },
  { value: "LOP", label: "Loss of Pay (LOP)" },
  { value: "WEEKOFF", label: "Week Off" },
] as const;

const APPROVAL_MODE_COPY = {
  SEQUENTIAL: {
    title: "Sequential Approval",
    description:
      "Approvals are completed in order. Step 2 becomes active only after Step 1 is completed. Use this for controlled multi-level approvals.",
  },
  ANY_ELIGIBLE: {
    title: "Any Eligible Approver",
    description:
      "All eligible approvers from the configured workflow may act. The first valid approval completes the request.",
  },
} as const;

const CONDITION_OPERATOR_LABELS: Record<
  WorkflowConditionOperator,
  string
> = {
  EQUALS: "Equals",
  NOT_EQUALS: "Not Equals",
  GREATER_THAN: "Greater Than",
  GREATER_THAN_OR_EQUAL:
    "Greater Than or Equal",
  LESS_THAN: "Less Than",
  LESS_THAN_OR_EQUAL:
    "Less Than or Equal",
  IN: "In",
  NOT_IN: "Not In",
  CONTAINS: "Contains",
  NOT_CONTAINS: "Does Not Contain",
  BETWEEN: "Between",
  IS_EMPTY: "Is Empty",
  IS_NOT_EMPTY: "Is Not Empty",
};

const FIELD_OPERATOR_MAP: Record<
  WorkflowConditionField,
  WorkflowConditionOperator[]
> = {
  BRANCH: [
    "EQUALS",
    "NOT_EQUALS",
  ],

  DEPARTMENT: [
    "EQUALS",
    "NOT_EQUALS",
  ],

  DESIGNATION: [
    "EQUALS",
    "NOT_EQUALS",
  ],

  EMPLOYEE: [
    "IN",
    "NOT_IN",
  ],

  TOTAL_AMOUNT: [
    "EQUALS",
    "NOT_EQUALS",
    "GREATER_THAN",
    "GREATER_THAN_OR_EQUAL",
    "LESS_THAN",
    "LESS_THAN_OR_EQUAL",
    "BETWEEN",
  ],

  SALARY_AMOUNT: [
    "EQUALS",
    "NOT_EQUALS",
    "GREATER_THAN",
    "GREATER_THAN_OR_EQUAL",
    "LESS_THAN",
    "LESS_THAN_OR_EQUAL",
    "BETWEEN",
  ],

  LEAVE_TYPE: [
    "EQUALS",
    "NOT_EQUALS",
    "CONTAINS",
    "NOT_CONTAINS",
  ],

  LEAVE_DAYS: [
    "EQUALS",
    "GREATER_THAN",
    "GREATER_THAN_OR_EQUAL",
    "LESS_THAN",
    "LESS_THAN_OR_EQUAL",
    "BETWEEN",
  ],

  EXIT_TYPE: [
    "EQUALS",
    "NOT_EQUALS",
  ],

  REGULARISATION_TYPE: [
    "EQUALS",
    "NOT_EQUALS",
  ],

  REGULARISATION_DAYS: [
    "EQUALS",
    "GREATER_THAN",
    "GREATER_THAN_OR_EQUAL",
    "LESS_THAN",
    "LESS_THAN_OR_EQUAL",
    "BETWEEN",
  ],

  REQUEST_TEXT: [
    "EQUALS",
    "NOT_EQUALS",
    "CONTAINS",
    "NOT_CONTAINS",
  ],
};

function getConditionValueType(
  fieldKey: WorkflowConditionField,
): WorkflowConditionValueType {
  switch (fieldKey) {
    case "BRANCH":
      return "BRANCH";

    case "DEPARTMENT":
      return "DEPARTMENT";

    case "DESIGNATION":
      return "DESIGNATION";

    case "EMPLOYEE":
      return "EMPLOYEE_LIST";

    case "TOTAL_AMOUNT":
    case "SALARY_AMOUNT":
    case "LEAVE_DAYS":
    case "REGULARISATION_DAYS":
      return "NUMBER";

    default:
      return "TEXT";
  }
}

function createLocalID() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toDateTimeLocal(value?: string | null): string {
  if (!value) {
    const now = new Date();
    now.setSeconds(0, 0);

    const timezoneOffset = now.getTimezoneOffset() * 60_000;

    return new Date(now.getTime() - timezoneOffset)
      .toISOString()
      .slice(0, 16);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 16);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function createEmptyStep(stepNo: number): WorkflowStepForm {
  return {
    id: undefined,
    localID: createLocalID(),
    stepNo,
    approverType: "DESIGNATION",
    designationID: null,
    designationName: "",
    stepName: "",
    isMandatory: true,
    canReject: true,
    canSendBack: false,
    approvalTimeout: "",
  };
}

function createEmptyCondition(
  conditionNo: number,
): WorkflowConditionForm {
  return {
    id: undefined,
    localID: createLocalID(),
    conditionNo,

    fieldKey: "",
    operator: "",
    valueType: "",

    departmentID: null,
    departmentName: "",

    designationID: null,
    designationName: "",

    branchesID: null,
    branchName: "",

    employeeIDs: [],
    selectedEmployees: [],
    employeeSearch: "",

    numberValue: "",
    numberValueTo: "",
    textValue: "",

    isActive: true,
  };
}

function createInitialForm(): WorkflowForm {
  return {
    serviceProviderID: null,
    companyID: null,
    branchesID: null,
    companyModuleID: null,

    companyAutocomplete: "",
    branchAutocomplete: "",
    moduleAutocomplete: "",

    workflowName: "",
    workflowDescription: "",
    effectiveFrom: toDateTimeLocal(),

    conditionMatchType: "ALL",

    allowAnySameDesignation: false,
    workflowStatus: true,

    steps: [createEmptyStep(1)],
    conditions: [],
  };
}

async function fetchJSONSafe<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options?.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...options?.headers,
    },
    cache: "no-store",
  });

  const contentType =
    response.headers.get("content-type") || "";

  const responseText = await response.text();

  let responseBody: any = null;

  if (
    responseText &&
    contentType.includes("application/json")
  ) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = null;
    }
  }

  if (!response.ok) {
    const message = Array.isArray(responseBody?.message)
      ? responseBody.message.join(", ")
      : responseBody?.message ||
      responseBody?.error ||
      (responseText.startsWith("<!DOCTYPE")
        ? `API returned HTML instead of JSON: ${url}`
        : responseText) ||
      `${response.status} ${response.statusText}`;

    throw new Error(message);
  }

  if (
    responseText &&
    !contentType.includes("application/json")
  ) {
    throw new Error(
      `Expected JSON but received "${contentType}" from ${url}`,
    );
  }

  if (!responseText) {
    return undefined as T;
  }

  return (responseBody?.data ?? responseBody) as T;
}

export default function ApprovalWorkflowsPage() {
  const user = useCurrentUser();

  const canManage =
    user?.role === "SUPERADMIN" ||
    user?.role === "SERVICE_PROVIDER" ||
    isCompanyAdminLikeRole(user?.role) ||
    user?.role === "ADMIN" ||
    user?.role === "BRANCH_ADMIN";

  const table = useClientTable("workflowName");

  const [rows, setRows] = useState<
    ApprovalWorkflowRead[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [isFormOpen, setIsFormOpen] =
    useState(false);

  const [isViewing, setIsViewing] =
    useState(false);

  const [editing, setEditing] =
    useState<ApprovalWorkflowRead | null>(null);

  const [viewRow, setViewRow] =
    useState<ApprovalWorkflowRead | null>(null);

  const [formData, setFormData] =
    useState<WorkflowForm>(createInitialForm());

  const [error, setError] =
    useState<string | null>(null);

  const [currentUserMapping, setCurrentUserMapping] =
    useState<any>(null);

  const [companyFilter, setCompanyFilter] =
    useState("ALL");

  const [branchFilter, setBranchFilter] =
    useState("ALL");

  const [moduleFilter, setModuleFilter] =
    useState("ALL");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const companyRef = useRef<HTMLDivElement>(null);
  const branchRef = useRef<HTMLDivElement>(null);
  const moduleRef = useRef<HTMLDivElement>(null);

  const [companyList, setCompanyList] = useState<
    CompanyRead[]
  >([]);

  const [branchList, setBranchList] = useState<
    BranchRead[]
  >([]);

  const [moduleList, setModuleList] = useState<
    CompanyModuleRead[]
  >([]);

  const [
    designationSuggestionMap,
    setDesignationSuggestionMap,
  ] = useState<Record<string, DesignationRead[]>>({});

  const [
    designationLoadingMap,
    setDesignationLoadingMap,
  ] = useState<Record<string, boolean>>({});

  const [allCompanies, setAllCompanies] = useState<
    CompanyRead[]
  >([]);

  const [allBranches, setAllBranches] = useState<
    BranchRead[]
  >([]);

  const [allModules, setAllModules] = useState<
    CompanyModuleRead[]
  >([]);

  const [allDesignations, setAllDesignations] =
    useState<DesignationRead[]>([]);

  const [allDepartments, setAllDepartments] =
    useState<DepartmentRead[]>([]);

  const [
    conditionDepartmentSuggestions,
    setConditionDepartmentSuggestions,
  ] = useState<Record<string, DepartmentRead[]>>({});

  const [
    conditionBranchSuggestions,
    setConditionBranchSuggestions,
  ] = useState<Record<string, BranchRead[]>>({});

  const [
    conditionDesignationSuggestions,
    setConditionDesignationSuggestions,
  ] = useState<Record<string, DesignationRead[]>>({});

  const [
    conditionEmployeeSuggestions,
    setConditionEmployeeSuggestions,
  ] = useState<Record<string, EmployeeRead[]>>({});

  const [
    conditionEmployeeLoading,
    setConditionEmployeeLoading,
  ] = useState<Record<string, boolean>>({});

  const companyTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  const branchTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  const moduleTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  const designationTimerMapRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  const fetchRows = async () => {
    try {
      setLoading(true);

      const all =
        await fetchJSONSafe<ApprovalWorkflowRead[]>(
          API.workflows,
        );

      const mapping =
        await resolveScopeUserMapping(user);

      if (mapping) {
        setCurrentUserMapping(mapping);
      }

      const context = getSidebarContext();

      const activeCompanyID =
        context?.companyID ??
        mapping?.companyID ??
        user?.companyID ??
        null;

      const activeBranchID =
        user?.role === "BRANCH_ADMIN"
          ? mapping?.branchesID ??
          user?.branchesID ??
          null
          : null;

      let scopedRows = Array.isArray(all) ? all : [];

      if (
        user?.role !== "SUPERADMIN" &&
        activeCompanyID
      ) {
        scopedRows = scopedRows.filter(
          (row) =>
            Number(row.companyID) ===
            Number(activeCompanyID),
        );
      }

      if (activeBranchID) {
        scopedRows = scopedRows.filter(
          (row) =>
            row.branchesID == null ||
            Number(row.branchesID) ===
            Number(activeBranchID),
        );
      }

      setRows(scopedRows);
    } catch (err: any) {
      console.error(
        "Failed to load approval workflows:",
        err,
      );

      setRows([]);

      toast.error(
        err?.message ||
        "Failed to load approval workflows",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [
        companies,
        branches,
        modules,
        designations,
        departments,
      ] = await Promise.all([
        fetchJSONSafe<CompanyRead[]>(API.companies),
        fetchJSONSafe<BranchRead[]>(API.branches),
        fetchJSONSafe<CompanyModuleRead[]>(
          API.companyModules,
        ),
        fetchJSONSafe<DesignationRead[]>(
          API.designations,
        ),
        fetchJSONSafe<DepartmentRead[]>(
          API.departments,
        ),
      ]);

      setAllCompanies(
        Array.isArray(companies) ? companies : [],
      );

      setAllBranches(
        Array.isArray(branches) ? branches : [],
      );

      setAllModules(
        (Array.isArray(modules) ? modules : []).filter(
          (module) => module.moduleStatus !== false,
        ),
      );

      setAllDesignations(
        Array.isArray(designations)
          ? designations
          : [],
      );
      setAllDepartments(
        Array.isArray(departments)
          ? departments
          : [],
      );
    } catch (err) {
      console.error(
        "Failed to load workflow lookups:",
        err,
      );
    }
  };

  useEffect(() => {
    fetchRows();
    fetchLookups();

    const reload = () => {
      fetchRows();
      fetchLookups();
    };

    const sidebarPageClickHandler = (event: any) => {
      if (
        event.detail?.path ===
        "/approval-workflows"
      ) {
        closePanels();
        reload();
      }
    };

    window.addEventListener(
      "sidebar-context-changed",
      reload,
    );

    window.addEventListener(
      "app-data-refresh",
      reload,
    );

    window.addEventListener(
      "sidebar-main-page-click",
      sidebarPageClickHandler,
    );

    return () => {
      window.removeEventListener(
        "sidebar-context-changed",
        reload,
      );

      window.removeEventListener(
        "app-data-refresh",
        reload,
      );

      window.removeEventListener(
        "sidebar-main-page-click",
        sidebarPageClickHandler,
      );
    };
  }, [user]);

  useEffect(() => {
    const handleOutsideClick = (
      event: MouseEvent,
    ) => {
      const target = event.target as Node;

      if (
        companyRef.current &&
        !companyRef.current.contains(target)
      ) {
        setCompanyList([]);
      }

      if (
        branchRef.current &&
        !branchRef.current.contains(target)
      ) {
        setBranchList([]);
      }

      if (
        moduleRef.current &&
        !moduleRef.current.contains(target)
      ) {
        setModuleList([]);
      }

      const designationContainer = (
        event.target as HTMLElement
      ).closest("[data-designation-autocomplete]");

if (!designationContainer) {
  setDesignationSuggestionMap({});
}

const conditionContainer = (
  event.target as HTMLElement
).closest(
  "[data-condition-autocomplete]",
);

if (!conditionContainer) {
  setConditionDepartmentSuggestions(
    {},
  );

  setConditionDesignationSuggestions(
    {},
  );

  setConditionEmployeeSuggestions(
    {},
  );
}
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
    };
  }, []);

  const getCurrentCompanyID = () => {
    const context = getSidebarContext();

    return (
      context?.companyID ??
      formData.companyID ??
      currentUserMapping?.companyID ??
      user?.companyID ??
      null
    );
  };

  const getCurrentServiceProviderID = () => {
    const context = getSidebarContext();

    return (
      context?.serviceProviderID ??
      formData.serviceProviderID ??
      currentUserMapping?.serviceProviderID ??
      user?.serviceProviderID ??
      null
    );
  };

  const getCurrentBranchID = () => {
    if (user?.role === "BRANCH_ADMIN") {
      return (
        currentUserMapping?.branchesID ??
        user?.branchesID ??
        formData.branchesID ??
        null
      );
    }

    return formData.branchesID;
  };

  const resetForm = () => {
    const nextForm = createInitialForm();

    const context = getSidebarContext();

    if (context) {
      nextForm.serviceProviderID =
        context.serviceProviderID ?? null;

      nextForm.companyID =
        context.companyID ?? null;

      nextForm.companyAutocomplete =
        context.companyName ?? "";
    } else if (currentUserMapping) {
      nextForm.serviceProviderID =
        currentUserMapping.serviceProviderID ??
        null;

      nextForm.companyID =
        currentUserMapping.companyID ?? null;

      nextForm.companyAutocomplete =
        currentUserMapping.company?.companyName ??
        "";
    } else {
      nextForm.serviceProviderID =
        user?.serviceProviderID ?? null;

      nextForm.companyID =
        user?.companyID ?? null;
    }

    if (user?.role === "BRANCH_ADMIN") {
      nextForm.branchesID =
        currentUserMapping?.branchesID ??
        user?.branchesID ??
        null;

      nextForm.branchAutocomplete =
        currentUserMapping?.branches?.branchName ??
        "";
    }

    setFormData(nextForm);
    setEditing(null);
    setError(null);
    setCompanyList([]);
    setBranchList([]);
    setModuleList([]);
    setDesignationSuggestionMap({});
  };

  const openCreateForm = () => {
    resetForm();
    setViewRow(null);
    setIsViewing(false);
    setIsFormOpen(true);
  };

  const closePanels = () => {
    setIsFormOpen(false);
    setIsViewing(false);
    setEditing(null);
    setViewRow(null);
    setError(null);
    setCompanyList([]);
    setBranchList([]);
    setModuleList([]);
    setDesignationSuggestionMap({});
  };

  const runCompanySuggestions = (
    query: string,
  ) => {
    if (companyTimerRef.current) {
      clearTimeout(companyTimerRef.current);
    }

    companyTimerRef.current = setTimeout(() => {
      const normalized = query
        .trim()
        .toLowerCase();

      let filtered = [...allCompanies];

      const serviceProviderID =
        getCurrentServiceProviderID();

      if (
        user?.role !== "SUPERADMIN" &&
        serviceProviderID
      ) {
        filtered = filtered.filter(
          (company) =>
            Number(company.serviceProviderID) ===
            Number(serviceProviderID),
        );
      }

      if (normalized.length >= MIN_CHARS) {
        filtered = filtered.filter((company) =>
          company.companyName
            ?.toLowerCase()
            .includes(normalized),
        );
      }

      setCompanyList(filtered.slice(0, 20));
    }, DEBOUNCE_MS);
  };

  const runBranchSuggestions = (
    query: string,
  ) => {
    if (branchTimerRef.current) {
      clearTimeout(branchTimerRef.current);
    }

    branchTimerRef.current = setTimeout(() => {
      const normalized = query
        .trim()
        .toLowerCase();

      const companyID = getCurrentCompanyID();

      let filtered = [...allBranches];

      if (companyID) {
        filtered = filtered.filter(
          (branch) =>
            Number(branch.companyID) ===
            Number(companyID),
        );
      }

      if (user?.role === "BRANCH_ADMIN") {
        const permittedBranchID =
          currentUserMapping?.branchesID ??
          user?.branchesID;

        if (permittedBranchID) {
          filtered = filtered.filter(
            (branch) =>
              Number(branch.id) ===
              Number(permittedBranchID),
          );
        }
      }

      if (normalized.length >= MIN_CHARS) {
        filtered = filtered.filter((branch) =>
          branch.branchName
            ?.toLowerCase()
            .includes(normalized),
        );
      }

      setBranchList(filtered.slice(0, 20));
    }, DEBOUNCE_MS);
  };

  const runModuleSuggestions = (
    query: string,
  ) => {
    if (moduleTimerRef.current) {
      clearTimeout(moduleTimerRef.current);
    }

    moduleTimerRef.current = setTimeout(() => {
      const normalized = query
        .trim()
        .toLowerCase();

      const filtered = allModules
        .filter(
          (module) =>
            module.moduleStatus !== false,
        )
        .filter((module) =>
          module.moduleName
            ?.toLowerCase()
            .includes(normalized),
        );

      setModuleList(filtered.slice(0, 20));
    }, DEBOUNCE_MS);
  };

  const runDesignationSuggestions = (
    localID: string,
    query: string,
  ) => {
    const existingTimer =
      designationTimerMapRef.current[localID];

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    designationTimerMapRef.current[localID] =
      setTimeout(() => {
        setDesignationLoadingMap((current) => ({
          ...current,
          [localID]: true,
        }));

        const normalized = query
          .trim()
          .toLowerCase();

        const branchID = getCurrentBranchID();
        const companyID = getCurrentCompanyID();

        let filtered = [...allDesignations];

        /*
         * Your Designations API appears branch-scoped.
         * Therefore branch is the strongest filter.
         */
        if (branchID) {
          filtered = filtered.filter(
            (designation) =>
              Number(
                designation.branchesID ??
                designation.branches?.id,
              ) === Number(branchID),
          );
        } else if (companyID) {
          filtered = filtered.filter(
            (designation) => {
              if (designation.companyID != null) {
                return (
                  Number(designation.companyID) ===
                  Number(companyID)
                );
              }

              const designationBranchID =
                designation.branchesID ??
                designation.branches?.id;

              if (!designationBranchID) {
                return true;
              }

              const branch = allBranches.find(
                (item) =>
                  Number(item.id) ===
                  Number(designationBranchID),
              );

              return (
                Number(branch?.companyID) ===
                Number(companyID)
              );
            },
          );
        }

        if (normalized.length >= MIN_CHARS) {
          filtered = filtered.filter(
            (designation) =>
              designation.designation
                ?.toLowerCase()
                .includes(normalized) ||
              designation.departments?.departmentName
                ?.toLowerCase()
                .includes(normalized),
          );
        }

        setDesignationSuggestionMap(
          (current) => ({
            ...current,
            [localID]: filtered.slice(0, 20),
          }),
        );

        setDesignationLoadingMap((current) => ({
          ...current,
          [localID]: false,
        }));
      }, DEBOUNCE_MS);
  };

  const updateStep = (
    localID: string,
    patch: Partial<WorkflowStepForm>,
  ) => {
    setFormData((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.localID === localID ? { ...step, ...patch } : step,
      ),
    }));
  };

  const renumberSteps = (
    steps: WorkflowStepForm[],
  ): WorkflowStepForm[] => {
    return steps.map((step, index) => ({
      ...step,
      stepNo: index + 1,
    }));
  };

  const addStep = () => {
    setFormData((current) => ({
      ...current,
      steps: [
        ...current.steps,
        createEmptyStep(
          current.steps.length + 1,
        ),
      ],
    }));
  };

  const removeStep = (localID: string) => {
    setFormData((current) => {
      if (current.steps.length === 1) {
        toast.error(
          "At least one approval step is required",
        );

        return current;
      }

      return {
        ...current,
        steps: renumberSteps(
          current.steps.filter(
            (step) => step.localID !== localID,
          ),
        ),
      };
    });
  };

  const moveStep = (
    index: number,
    direction: "UP" | "DOWN",
  ) => {
    setFormData((current) => {
      const nextSteps = [...current.steps];

      const targetIndex =
        direction === "UP"
          ? index - 1
          : index + 1;

      if (
        targetIndex < 0 ||
        targetIndex >= nextSteps.length
      ) {
        return current;
      }

      [
        nextSteps[index],
        nextSteps[targetIndex],
      ] = [
          nextSteps[targetIndex],
          nextSteps[index],
        ];

      return {
        ...current,
        steps: renumberSteps(nextSteps),
      };
    });
  };

  const renumberConditions = (
    conditions: WorkflowConditionForm[],
  ) =>
    conditions.map((condition, index) => ({
      ...condition,
      conditionNo: index + 1,
    }));

  const addCondition = () => {
    setFormData((current) => ({
      ...current,
      conditions: [
        ...current.conditions,
        createEmptyCondition(
          current.conditions.length + 1,
        ),
      ],
    }));
  };

  const removeCondition = (localID: string) => {
    setFormData((current) => ({
      ...current,
      conditions: renumberConditions(
        current.conditions.filter(
          (condition) =>
            condition.localID !== localID,
        ),
      ),
    }));
  };

  const updateCondition = (
    localID: string,
    patch: Partial<WorkflowConditionForm>,
  ) => {
    setFormData((current) => ({
      ...current,
      conditions: current.conditions.map(
        (condition) =>
          condition.localID === localID
            ? {
              ...condition,
              ...patch,
            }
            : condition,
      ),
    }));
  };

  const getSelectedModule = () =>
    allModules.find(
      (module) =>
        Number(module.id) ===
        Number(formData.companyModuleID),
    );

  const getAvailableConditionFields =
  (): WorkflowConditionField[] => {
    const selectedModule =
      getSelectedModule();

    if (!selectedModule) {
      return [];
    }

    const resolvedModuleKey =
      resolveModuleConditionKey(
        selectedModule,
      );

    if (!resolvedModuleKey) {
      return [
        ...COMMON_ORG_CONDITION_FIELDS,
        "REQUEST_TEXT",
      ];
    }

    const fields =
      MODULE_CONDITION_FIELDS[
        resolvedModuleKey
      ] ?? [
        ...COMMON_ORG_CONDITION_FIELDS,
        "REQUEST_TEXT",
      ];

    /*
     * If the workflow itself is already limited to one branch,
     * a BRANCH condition is redundant and can confuse admins.
     * Keep BRANCH available only for company-wide workflows.
     */
    return formData.branchesID != null
      ? fields.filter((field) => field !== "BRANCH")
      : fields;
  };


  const runConditionBranchSuggestions = (
    localID: string,
    query: string,
  ) => {
    const normalized = query.trim().toLowerCase();
    const companyID = getCurrentCompanyID();
    let filtered = [...allBranches];

    if (companyID) {
      filtered = filtered.filter(
        (branch) =>
          Number(branch.companyID) === Number(companyID),
      );
    }

    if (user?.role === "BRANCH_ADMIN") {
      const permittedBranchID =
        currentUserMapping?.branchesID ?? user?.branchesID;
      if (permittedBranchID) {
        filtered = filtered.filter(
          (branch) =>
            Number(branch.id) === Number(permittedBranchID),
        );
      }
    }

    if (normalized.length >= MIN_CHARS) {
      filtered = filtered.filter((branch) =>
        branch.branchName?.toLowerCase().includes(normalized),
      );
    }

    setConditionBranchSuggestions((current) => ({
      ...current,
      [localID]: filtered.slice(0, 20),
    }));
  };

  const runConditionDepartmentSuggestions = (
  localID: string,
  query: string,
) => {
  const normalized =
    query.trim().toLowerCase();

  const companyID =
    getCurrentCompanyID();

  const branchID =
    getCurrentBranchID();

  let filtered = [
    ...allDepartments,
  ];

  if (branchID) {
    filtered = filtered.filter(
      (department) =>
        Number(
          department.branchesID,
        ) === Number(branchID),
    );
  } else if (companyID) {
    filtered = filtered.filter(
      (department) => {
        if (
          department.companyID !=
          null
        ) {
          return (
            Number(
              department.companyID,
            ) === Number(companyID)
          );
        }

        if (
          department.branchesID ==
          null
        ) {
          return false;
        }

        const branch =
          allBranches.find(
            (item) =>
              Number(item.id) ===
              Number(
                department.branchesID,
              ),
          );

        return (
          Number(
            branch?.companyID,
          ) === Number(companyID)
        );
      },
    );
  }

  if (normalized) {
    filtered = filtered.filter(
      (department) =>
        String(
          department.departmentName ??
            "",
        )
          .toLowerCase()
          .includes(normalized),
    );
  }

  setConditionDepartmentSuggestions(
    (current) => ({
      ...current,
      [localID]:
        filtered.slice(0, 20),
    }),
  );
};


  const runConditionDesignationSuggestions = (
  localID: string,
  query: string,
) => {
  const normalized =
    query.trim().toLowerCase();

  const companyID =
    getCurrentCompanyID();

  const branchID =
    getCurrentBranchID();

  let filtered = [
    ...allDesignations,
  ];

  if (branchID) {
    filtered = filtered.filter(
      (designation) =>
        Number(
          designation.branchesID ??
            designation.branches?.id,
        ) === Number(branchID),
    );
  } else if (companyID) {
    filtered = filtered.filter(
      (designation) => {
        if (
          designation.companyID !=
          null
        ) {
          return (
            Number(
              designation.companyID,
            ) === Number(companyID)
          );
        }

        const designationBranchID =
          designation.branchesID ??
          designation.branches?.id;

        if (
          designationBranchID == null
        ) {
          return false;
        }

        const branch =
          allBranches.find(
            (item) =>
              Number(item.id) ===
              Number(
                designationBranchID,
              ),
          );

        return (
          Number(
            branch?.companyID,
          ) === Number(companyID)
        );
      },
    );
  }

  if (normalized) {
    filtered = filtered.filter(
      (designation) =>
        String(
          designation.designation ??
            "",
        )
          .toLowerCase()
          .includes(normalized) ||
        String(
          designation.departments
            ?.departmentName ?? "",
        )
          .toLowerCase()
          .includes(normalized),
    );
  }

  setConditionDesignationSuggestions(
    (current) => ({
      ...current,
      [localID]:
        filtered.slice(0, 20),
    }),
  );
};

  const runConditionEmployeeSuggestions =
    async (
      localID: string,
      query: string,
    ) => {
      const companyID =
        getCurrentCompanyID();

      if (!companyID) {
        toast.error(
          "Select a company before searching employees",
        );
        return;
      }

      try {
        setConditionEmployeeLoading(
          (current) => ({
            ...current,
            [localID]: true,
          }),
        );

        const params =
          new URLSearchParams();

        params.set(
          "companyID",
          String(companyID),
        );

        const branchID =
          getCurrentBranchID();

        if (branchID) {
          params.set(
            "branchesID",
            String(branchID),
          );
        }

        if (query.trim()) {
          params.set(
            "search",
            query.trim(),
          );
        }

        const employees =
          await fetchJSONSafe<EmployeeRead[]>(
            `${API.employees}?${params.toString()}`,
          );

        setConditionEmployeeSuggestions(
          (current) => ({
            ...current,
            [localID]: Array.isArray(
              employees,
            )
              ? employees
              : [],
          }),
        );
      } catch (err: any) {
        toast.error(
          err?.message ||
          "Failed to search employees",
        );
      } finally {
        setConditionEmployeeLoading(
          (current) => ({
            ...current,
            [localID]: false,
          }),
        );
      }
    };

  const handleConditionFieldChange = (
    localID: string,
    fieldKey: WorkflowConditionField,
  ) => {
    const operators =
      FIELD_OPERATOR_MAP[fieldKey];

    updateCondition(localID, {
      fieldKey,
      valueType:
        getConditionValueType(fieldKey),
      operator:
        operators[0] ?? "",

      departmentID: null,
      departmentName: "",

      designationID: null,
      designationName: "",

      branchesID: null,
      branchName: "",

      employeeIDs: [],
      selectedEmployees: [],
      employeeSearch: "",

      numberValue: "",
      numberValueTo: "",
      textValue: "",
    });
  };

  const selectConditionEmployee = (
    localID: string,
    employee: EmployeeRead,
  ) => {
    setFormData((current) => ({
      ...current,
      conditions: current.conditions.map(
        (condition) => {
          if (
            condition.localID !== localID
          ) {
            return condition;
          }

          if (
            condition.employeeIDs.includes(
              employee.id,
            )
          ) {
            return condition;
          }

          return {
            ...condition,
            employeeIDs: [
              ...condition.employeeIDs,
              employee.id,
            ],
            selectedEmployees: [
              ...condition.selectedEmployees,
              employee,
            ],
            employeeSearch: "",
          };
        },
      ),
    }));

    setConditionEmployeeSuggestions(
      (current) => ({
        ...current,
        [localID]: [],
      }),
    );
  };

  const removeConditionEmployee = (
    localID: string,
    employeeID: ID,
  ) => {
    setFormData((current) => ({
      ...current,
      conditions: current.conditions.map(
        (condition) =>
          condition.localID === localID
            ? {
              ...condition,
              employeeIDs:
                condition.employeeIDs.filter(
                  (id) =>
                    id !== employeeID,
                ),
              selectedEmployees:
                condition.selectedEmployees.filter(
                  (employee) =>
                    employee.id !==
                    employeeID,
                ),
            }
            : condition,
      ),
    }));
  };

  const handleEdit = (
    workflow: ApprovalWorkflowRead,
  ) => {
    setEditing(workflow);
    setIsViewing(false);
    setViewRow(null);
    setError(null);

    const mappedSteps: WorkflowStepForm[] =
      [...(workflow.steps ?? [])]
        .sort(
          (a, b) =>
            a.stepNo - b.stepNo,
        )
       .map((step, index) => ({
  id: step.id,
  localID: createLocalID(),
  stepNo: index + 1,

          approverType:
            (step.approverType || "DESIGNATION").toUpperCase() ===
            "REPORTING_MANAGER"
              ? "REPORTING_MANAGER"
              : "DESIGNATION",

          designationID:
            step.designationID ?? null,

          designationName:
            step.designation?.designation ??
            "",

          stepName:
            step.stepName ?? "",

          isMandatory:
            step.isMandatory !== false,

          canReject:
            step.canReject !== false,

          canSendBack:
            step.canSendBack === true,

          approvalTimeout:
            step.approvalTimeout != null
              ? String(
                step.approvalTimeout,
              )
              : "",
        }));

    const mappedConditions:
      WorkflowConditionForm[] = [
        ...(workflow.conditions ?? []),
      ]
        .sort(
          (a, b) =>
            a.conditionNo -
            b.conditionNo,
        )
        .map((condition, index) => {
          const selectedEmployees:
            EmployeeRead[] = (
              condition.employees ?? []
            )
              .map(
                (item) =>
                  item.employee,
              )
              .filter(
                (
                  employee,
                ): employee is EmployeeRead =>
                  employee != null,
              );

          return {
            id: condition.id,
            localID: createLocalID(),
            conditionNo: index + 1,

            fieldKey:
              condition.fieldKey,

            operator:
              condition.operator,

            valueType:
              condition.valueType,

            departmentID:
              condition.departmentID ??
              null,

            departmentName:
              condition.department
                ?.departmentName ??
              "",

            designationID:
              condition.designationID ??
              null,

            designationName:
              condition.designation
                ?.designation ??
              "",

            branchesID:
              condition.branchesID ??
              null,

            branchName:
              condition.branches
                ?.branchName ??
              "",

            employeeIDs: (
              condition.employees ?? []
            ).map(
              (item) =>
                Number(
                  item.manageEmployeeID,
                ),
            ),

            selectedEmployees,
            employeeSearch: "",

            numberValue:
              condition.numberValue != null
                ? String(
                  condition.numberValue,
                )
                : "",

            numberValueTo:
              condition.numberValueTo !=
                null
                ? String(
                  condition.numberValueTo,
                )
                : "",

            textValue:
              condition.textValue ?? "",

            isActive: true,
          };
        });

    setFormData({
      serviceProviderID:
        workflow.serviceProviderID ??
        null,

      companyID:
        workflow.companyID,

      branchesID:
        workflow.branchesID ??
        null,

      companyModuleID:
        workflow.companyModuleID,

      companyAutocomplete:
        workflow.company
          ?.companyName ??
        "",

      branchAutocomplete:
        workflow.branches
          ?.branchName ??
        (workflow.branchesID
          ? ""
          : "All Branches"),

      moduleAutocomplete:
        workflow.companyModule
          ?.moduleName ??
        "",

      workflowName:
        workflow.workflowName ??
        "",

      workflowDescription:
        workflow.workflowDescription ??
        "",

      effectiveFrom:
        toDateTimeLocal(
          workflow.effectiveFrom,
        ),

      conditionMatchType:
        workflow.conditionMatchType ??
        "ALL",

      allowAnySameDesignation:
        workflow.allowAnySameDesignation ??
        false,

      workflowStatus:
        workflow.workflowStatus !==
        false,

      steps:
        mappedSteps.length > 0
          ? mappedSteps
          : [createEmptyStep(1)],

      conditions:
        mappedConditions,
    });

    setCompanyList([]);
    setBranchList([]);
    setModuleList([]);
    setDesignationSuggestionMap({});
    setConditionDepartmentSuggestions({});
    setConditionBranchSuggestions({});
    setConditionDesignationSuggestions({});
    setConditionEmployeeSuggestions({});
    setConditionEmployeeLoading({});

    setIsFormOpen(true);
  };

  const handleView = (
    workflow: ApprovalWorkflowRead,
  ) => {
    setViewRow(workflow);
    setIsViewing(true);
    setIsFormOpen(false);
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!formData.companyID) {
      errors.push(
        "Company is required",
      );
    }

    if (!formData.companyModuleID) {
      errors.push(
        "Workflow module is required",
      );
    }

    if (
      !formData.workflowName.trim()
    ) {
      errors.push(
        "Workflow name is required",
      );
    }

    if (!formData.effectiveFrom) {
      errors.push(
        "Workflow effective date and time are required",
      );
    } else {
      const effectiveDate =
        new Date(
          formData.effectiveFrom,
        );

      if (
        Number.isNaN(
          effectiveDate.getTime(),
        )
      ) {
        errors.push(
          "Workflow effective date is invalid",
        );
      }
    }

    if (
      formData.steps.length === 0
    ) {
      errors.push(
        "At least one approval step is required",
      );
    }

    formData.steps.forEach(
      (step, index) => {
        const stepNumber = index + 1;

        if (
          step.approverType !== "REPORTING_MANAGER" &&
          !step.designationID
        ) {
          errors.push(
            `Designation is required for step ${stepNumber}`,
          );
        }

        if (
          step.approvalTimeout !==
          ""
        ) {
          const timeout = Number(
            step.approvalTimeout,
          );

          if (
            !Number.isFinite(
              timeout,
            ) ||
            timeout <= 0
          ) {
            errors.push(
              `Approval timeout for step ${stepNumber} must be greater than zero`,
            );
          }
        }
      },
    );

    const designationIDs =
      formData.steps
        .filter(
          (step) =>
            step.approverType !==
            "REPORTING_MANAGER",
        )
        .map(
          (step) =>
            step.designationID,
        )
        .filter(
          (id): id is number =>
            id != null,
        );

    if (
      new Set(
        designationIDs,
      ).size !==
      designationIDs.length
    ) {
      errors.push(
        "The same designation cannot be used in multiple approval steps",
      );
    }

    formData.conditions.forEach(
      (condition, index) => {
        const conditionNumber =
          index + 1;

        if (!condition.fieldKey) {
          errors.push(
            `Condition field is required for condition ${conditionNumber}`,
          );
          return;
        }

        if (!condition.operator) {
          errors.push(
            `Operator is required for condition ${conditionNumber}`,
          );
        }

        if (!condition.valueType) {
          errors.push(
            `Value type is required for condition ${conditionNumber}`,
          );
        }

        if (
          condition.fieldKey ===
          "BRANCH" &&
          !condition.branchesID
        ) {
          errors.push(
            `Branch is required for condition ${conditionNumber}`,
          );
        }

        if (
          condition.fieldKey ===
          "DEPARTMENT" &&
          !condition.departmentID
        ) {
          errors.push(
            `Department is required for condition ${conditionNumber}`,
          );
        }

        if (
          condition.fieldKey ===
          "DESIGNATION" &&
          !condition.designationID
        ) {
          errors.push(
            `Designation is required for condition ${conditionNumber}`,
          );
        }

        if (
          condition.fieldKey ===
          "EMPLOYEE"
        ) {
          if (
            condition.employeeIDs
              .length === 0
          ) {
            errors.push(
              `At least one employee is required for condition ${conditionNumber}`,
            );
          }

          if (
            new Set(
              condition.employeeIDs,
            ).size !==
            condition.employeeIDs
              .length
          ) {
            errors.push(
              `Duplicate employees are not allowed in condition ${conditionNumber}`,
            );
          }
        }

        const isNumericField = [
          "TOTAL_AMOUNT",
          "SALARY_AMOUNT",
          "LEAVE_DAYS",
          "REGULARISATION_DAYS",
        ].includes(
          condition.fieldKey,
        );

        if (isNumericField) {
          if (
            condition.numberValue ===
            ""
          ) {
            errors.push(
              `Numeric value is required for condition ${conditionNumber}`,
            );
          } else {
            const lowerValue =
              Number(
                condition.numberValue,
              );

            if (
              !Number.isFinite(
                lowerValue,
              ) ||
              lowerValue < 0
            ) {
              errors.push(
                `Condition ${conditionNumber} must have a valid non-negative numeric value`,
              );
            }
          }

          if (
            condition.operator ===
            "BETWEEN"
          ) {
            if (
              condition.numberValueTo ===
              ""
            ) {
              errors.push(
                `Upper value is required for condition ${conditionNumber}`,
              );
            } else {
              const lowerValue =
                Number(
                  condition.numberValue,
                );

              const upperValue =
                Number(
                  condition.numberValueTo,
                );

              if (
                !Number.isFinite(
                  upperValue,
                ) ||
                upperValue < 0
              ) {
                errors.push(
                  `Condition ${conditionNumber} must have a valid upper value`,
                );
              } else if (
                Number.isFinite(
                  lowerValue,
                ) &&
                upperValue <
                lowerValue
              ) {
                errors.push(
                  `Upper value cannot be lower than the first value for condition ${conditionNumber}`,
                );
              }
            }
          }
        }

        const isTextField = [
          "LEAVE_TYPE",
          "EXIT_TYPE",
          "REGULARISATION_TYPE",
          "REQUEST_TEXT",
        ].includes(
          condition.fieldKey,
        );

        if (
          isTextField &&
          !condition.textValue.trim()
        ) {
          errors.push(
            `Text value is required for condition ${conditionNumber}`,
          );
        }
      },
    );

    return errors;
  };


  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const validationErrors =
      validateForm();

    if (validationErrors.length > 0) {
      validationErrors.forEach(
        (message) =>
          toast.error(message),
      );

      return;
    }

    const context =
      getSidebarContext();

    const serviceProviderID =
      context?.serviceProviderID ??
      formData.serviceProviderID ??
      currentUserMapping
        ?.serviceProviderID ??
      user?.serviceProviderID ??
      undefined;

    const companyID =
      context?.companyID ??
      formData.companyID ??
      currentUserMapping?.companyID ??
      user?.companyID;

    if (!companyID) {
      toast.error(
        "Company is required",
      );
      return;
    }

    if (!formData.companyModuleID) {
      toast.error(
        "Workflow module is required",
      );
      return;
    }

    const effectiveDate = new Date(
      formData.effectiveFrom,
    );

    if (
      Number.isNaN(
        effectiveDate.getTime(),
      )
    ) {
      toast.error(
        "Effective date is invalid",
      );
      return;
    }

    const payload = {
      serviceProviderID:
        serviceProviderID
          ? Number(
            serviceProviderID,
          )
          : undefined,

      companyID:
        Number(companyID),

      branchesID:
        formData.branchesID != null
          ? Number(
            formData.branchesID,
          )
          : null,

      companyModuleID:
        Number(
          formData.companyModuleID,
        ),

      workflowName:
        formData.workflowName.trim(),

      workflowDescription:
        formData.workflowDescription
          .trim() ||
        undefined,

      effectiveFrom:
        effectiveDate.toISOString(),

      conditionMatchType:
        formData.conditionMatchType,

      allowAnySameDesignation:
        formData
          .allowAnySameDesignation,

      workflowStatus:
        formData.workflowStatus,

      createdByUserID:
        user?.id != null
          ? Number(user.id)
          : undefined,

steps: formData.steps.map(
  (step, index) => ({
    id:
      editing && step.id != null
        ? Number(step.id)
        : undefined,
          stepNo: index + 1,

          approverType: step.approverType,

          designationID:
            step.approverType === "REPORTING_MANAGER"
              ? undefined
              : Number(step.designationID),

          stepName:
            step.stepName.trim() ||
            (step.approverType === "REPORTING_MANAGER"
              ? "Reporting Manager Approval"
              : `${step.designationName || "Approver"} Approval`),

          isMandatory:
            step.isMandatory,

          canReject:
            step.canReject,

          canSendBack:
            step.canSendBack,

          approvalTimeout:
            step.approvalTimeout
              ? Number(
                step.approvalTimeout,
              )
              : undefined,
        }),
      ),

      conditions:
        formData.conditions.map(
          (condition, index) => {
            const isNumericField = [
              "TOTAL_AMOUNT",
              "SALARY_AMOUNT",
              "LEAVE_DAYS",
              "REGULARISATION_DAYS",
            ].includes(
              condition.fieldKey,
            );

            const isTextField = [
              "LEAVE_TYPE",
              "EXIT_TYPE",
              "REGULARISATION_TYPE",
              "REQUEST_TEXT",
            ].includes(
              condition.fieldKey,
            );

          return {
  id:
    editing &&
    condition.id != null
      ? Number(condition.id)
      : undefined,

  conditionNo:
    index + 1,

              fieldKey:
                condition.fieldKey as
                WorkflowConditionField,

              operator:
                condition.operator as
                WorkflowConditionOperator,

              valueType:
                condition.valueType as
                WorkflowConditionValueType,

              departmentID:
                condition.fieldKey ===
                  "DEPARTMENT" &&
                  condition.departmentID !=
                  null
                  ? Number(
                    condition.departmentID,
                  )
                  : undefined,

              designationID:
                condition.fieldKey ===
                  "DESIGNATION" &&
                  condition.designationID !=
                  null
                  ? Number(
                    condition.designationID,
                  )
                  : undefined,

              branchesID:
                condition.fieldKey ===
                  "BRANCH" &&
                  condition.branchesID !=
                  null
                  ? Number(
                    condition.branchesID,
                  )
                  : undefined,

              employeeIDs:
                condition.fieldKey ===
                  "EMPLOYEE"
                  ? condition.employeeIDs.map(
                    (id) =>
                      Number(id),
                  )
                  : undefined,

              numberValue:
                isNumericField &&
                  condition.numberValue !==
                  ""
                  ? Number(
                    condition.numberValue,
                  )
                  : undefined,

              numberValueTo:
                isNumericField &&
                  condition.operator ===
                  "BETWEEN" &&
                  condition.numberValueTo !==
                  ""
                  ? Number(
                    condition.numberValueTo,
                  )
                  : undefined,

              textValue:
                isTextField
                  ? condition.textValue
                    .trim()
                  : undefined,
            };
          },
        ),
    };

    try {
      setSaving(true);
      setError(null);

      if (editing) {
        await fetchJSONSafe(
          `${API.workflows}/${editing.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(
              payload,
            ),
          },
        );

        toast.success(
          "Approval workflow updated successfully",
        );
      } else {
        await fetchJSONSafe(
          API.workflows,
          {
            method: "POST",
            body: JSON.stringify(
              payload,
            ),
          },
        );

        toast.success(
          "Approval workflow created successfully",
        );
      }

      await fetchRows();
      closePanels();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to save approval workflow";

      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (
    workflow: ApprovalWorkflowRead,
    workflowStatus: boolean,
  ) => {
    try {
      await fetchJSONSafe(
        `${API.workflows}/${workflow.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            workflowStatus,
          }),
        },
      );

      setRows((current) =>
        current.map((row) =>
          row.id === workflow.id
            ? {
              ...row,
              workflowStatus,
            }
            : row,
        ),
      );

      toast.success(
        workflowStatus
          ? "Workflow activated"
          : "Workflow deactivated",
      );
    } catch (err: any) {
      toast.error(
        err?.message ||
        "Failed to update workflow status",
      );
    }
  };

  const handleDelete = async (
    workflow: ApprovalWorkflowRead,
  ) => {
    const confirmed = window.confirm(
      `Delete workflow "${workflow.workflowName}"?`,
    );

    if (!confirmed) return;

    try {
      await fetchJSONSafe(
        `${API.workflows}/${workflow.id}`,
        {
          method: "DELETE",
        },
      );

      setRows((current) =>
        current.filter(
          (row) => row.id !== workflow.id,
        ),
      );

      toast.success(
        "Approval workflow deleted successfully",
      );
    } catch (err: any) {
      toast.error(
        err?.message ||
        "Failed to delete approval workflow",
      );
    }
  };

  const companyName = (
    workflow: ApprovalWorkflowRead,
  ) => {
    return (
      workflow.company?.companyName ??
      allCompanies.find(
        (company) =>
          Number(company.id) ===
          Number(workflow.companyID),
      )?.companyName ??
      "—"
    );
  };

  const branchName = (
    workflow: ApprovalWorkflowRead,
  ) => {
    if (!workflow.branchesID) {
      return "All branches";
    }

    return (
      workflow.branches?.branchName ??
      allBranches.find(
        (branch) =>
          Number(branch.id) ===
          Number(workflow.branchesID),
      )?.branchName ??
      "—"
    );
  };

  const moduleName = (
    workflow: ApprovalWorkflowRead,
  ) => {
    return (
      workflow.companyModule?.moduleName ??
      allModules.find(
        (module) =>
          Number(module.id) ===
          Number(workflow.companyModuleID),
      )?.moduleName ??
      "—"
    );
  };

  const filteredRows = useMemo(() => {
    const search = table.search
      .trim()
      .toLowerCase();

    const filtered = rows.filter((workflow) => {
      const matchesSearch =
        !search ||
        [
          workflow.workflowName,
          workflow.workflowDescription,
          companyName(workflow),
          branchName(workflow),
          moduleName(workflow),
          ...(workflow.steps || []).map(
            (step) =>
              step.designation
                ?.designation,
          ),
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(search),
          );

      const matchesCompany =
        companyFilter === "ALL" ||
        String(workflow.companyID) ===
        companyFilter;

      const matchesBranch =
        branchFilter === "ALL" ||
        (branchFilter === "COMPANY_WIDE"
          ? workflow.branchesID == null
          : String(
            workflow.branchesID ?? "",
          ) === branchFilter);

      const matchesModule =
        moduleFilter === "ALL" ||
        String(workflow.companyModuleID) ===
        moduleFilter;

      const active =
        workflow.workflowStatus !== false;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" &&
          active) ||
        (statusFilter === "INACTIVE" &&
          !active);

      return (
        matchesSearch &&
        matchesCompany &&
        matchesBranch &&
        matchesModule &&
        matchesStatus
      );
    });

    return sortRows(
      filtered,
      table.sortBy,
      table.sortDir,
      (workflow, key) => {
        if (key === "workflowName") {
          return workflow.workflowName ?? "";
        }

        if (key === "company") {
          return companyName(workflow);
        }

        if (key === "branch") {
          return branchName(workflow);
        }

        if (key === "module") {
          return moduleName(workflow);
        }

        if (key === "effectiveFrom") {
          return workflow.effectiveFrom ?? "";
        }

        if (key === "steps") {
          return workflow.steps?.length ?? 0;
        }

        return "";
      },
    );
  }, [
    rows,
    table.search,
    table.sortBy,
    table.sortDir,
    companyFilter,
    branchFilter,
    moduleFilter,
    statusFilter,
    allCompanies,
    allBranches,
    allModules,
  ]);


  const conditionValueLabel = (
  condition: WorkflowConditionRead,
): string => {
  if (condition.branches?.branchName) {
    return condition.branches.branchName;
  }

  if (
    condition.department
      ?.departmentName
  ) {
    return condition.department
      .departmentName;
  }

  if (
    condition.designation
      ?.designation
  ) {
    return condition.designation
      .designation;
  }

  const employeeNames = (
    condition.employees ?? []
  )
    .map((item) =>
      [
        item.employee
          ?.employeeFirstName,
        item.employee
          ?.employeeLastName,
      ]
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean)
    .join(", ");

  if (employeeNames) {
    return employeeNames;
  }

  if (
    condition.numberValue != null
  ) {
    if (
      condition.operator ===
        "BETWEEN" &&
      condition.numberValueTo !=
        null
    ) {
      return `${condition.numberValue} and ${condition.numberValueTo}`;
    }

    return String(
      condition.numberValue,
    );
  }

  if (
    condition.textValue?.trim()
  ) {
    return condition.textValue;
  }

  return "—";
};

  const companyFilterOptions = useMemo(
    () => [
      {
        value: "ALL",
        label: "All companies",
      },
      ...allCompanies.map((company) => ({
        value: String(company.id),
        label: company.companyName,
      })),
    ],
    [allCompanies],
  );

  const branchFilterOptions = useMemo(
    () => [
      {
        value: "ALL",
        label: "All branch scopes",
      },
      {
        value: "COMPANY_WIDE",
        label: "Company-wide",
      },
      ...allBranches
        .filter(
          (branch) =>
            companyFilter === "ALL" ||
            Number(branch.companyID) ===
            Number(companyFilter),
        )
        .map((branch) => ({
          value: String(branch.id),
          label: branch.branchName,
        })),
    ],
    [allBranches, companyFilter],
  );

  const moduleFilterOptions = useMemo(
    () => [
      {
        value: "ALL",
        label: "All modules",
      },
      ...allModules.map((module) => ({
        value: String(module.id),
        label: module.moduleName,
      })),
    ],
    [allModules],
  );

  const statusFilterOptions = [
    {
      value: "ALL",
      label: "All statuses",
    },
    {
      value: "ACTIVE",
      label: "Active",
    },
    {
      value: "INACTIVE",
      label: "Inactive",
    },
  ];

  const columns = useMemo(
    (): DataTableColumn<ApprovalWorkflowRead>[] => [
      {
        key: "workflowName",
        header: "Workflow",
        sortable: true,
        colSpan: 3,
        cell: (workflow) => (
          <div className="min-w-0">
            <div className="font-medium">
              {workflow.workflowName}
            </div>

            <div className="mt-1 line-clamp-1 text-xs text-gray-500">
              {workflow.workflowDescription ||
                "No description"}
            </div>
          </div>
        ),
      },
      {
        key: "company",
        header: "Company / Branch",
        sortable: true,
        colSpan: 3,
        cell: (workflow) => (
          <div>
            <div className="text-sm font-medium">
              {companyName(workflow)}
            </div>

            <div className="mt-1 text-xs text-gray-500">
              {branchName(workflow)}
            </div>
          </div>
        ),
      },
      {
        key: "module",
        header: "Module",
        sortable: true,
        colSpan: 2,
        cell: (workflow) =>
          moduleName(workflow),
      },
      {
        key: "steps",
        header: "Steps",
        sortable: true,
        colSpan: 1,
        cell: (workflow) => (
          <Badge variant="outline">
            {workflow.steps?.length ?? 0}
          </Badge>
        ),
      },
      {
        key: "status",
        header: "Status",
        colSpan: 1,
        cell: (workflow) => {
          const active =
            workflow.workflowStatus !== false;

          return (
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  active
                    ? "default"
                    : "secondary"
                }
                className={
                  active
                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                }
              >
                {active
                  ? "Active"
                  : "Inactive"}
              </Badge>

              {canManage && (
                <Switch
                  checked={active}
                  onCheckedChange={(checked) =>
                    handleStatusChange(
                      workflow,
                      checked,
                    )
                  }
                />
              )}
            </div>
          );
        },
      },
      {
        key: "actions",
        header: "Actions",
        colSpan: 2,
        align: "right",
        cell: (workflow) => (
          <EntityRowActions
            onView={() =>
              handleView(workflow)
            }
            onEdit={
              canManage
                ? () =>
                  handleEdit(workflow)
                : undefined
            }
            onDelete={
              canManage
                ? () =>
                  handleDelete(workflow)
                : undefined
            }
          />
        ),
      },
    ],
    [
      canManage,
      allCompanies,
      allBranches,
      allModules,
    ],
  );

  return (
    <div className="page-content-enter w-full max-w-none animate-fade-in space-y-6">
      <PageHeader
        icon={Workflow}
        title="Approval Workflows"
        description="Create clear approval rules by company, branch, module, conditions and approver sequence."
        actions={
          !isFormOpen &&
            !isViewing &&
            canManage ? (
            <Button onClick={openCreateForm}>
              <Plus className="mr-1 h-4 w-4" />
              Create Workflow
            </Button>
          ) : null
        }
      />

      <FormDrawer
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) closePanels();
        }}
        title={
          editing
            ? "Edit Approval Workflow"
            : "Create Approval Workflow"
        }
      >
        {error && (
          <NoticeBanner
            variant="error"
            compact
            className="mb-4"
          >
            {error}
          </NoticeBanner>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Workflow Details
              </h3>

              <p className="mt-1 text-xs text-gray-500">
                Define the scope, module, activation date and approval behavior for this workflow.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="effectiveFrom">
                  Effective From *
                </Label>

                <Input
                  id="effectiveFrom"
                  type="datetime-local"
                  value={formData.effectiveFrom}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      effectiveFrom:
                        event.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div
                ref={companyRef}
                className="relative space-y-2"
              >
                <Label>Company *</Label>

                <Input
                  value={
                    formData.companyAutocomplete
                  }
                  onChange={(event) => {
                    const value =
                      event.target.value;

                    setFormData((current) => ({
                      ...current,
                      companyID: null,
                      companyAutocomplete: value,
                      branchesID: null,
                      branchAutocomplete: "",
                      steps: current.steps.map(
                        (step) => ({
                          ...step,
                          designationID: null,
                          designationName: "",
                        }),
                      ),

                      conditions: [],
                    }));

                    runCompanySuggestions(value);
                  }}
                  onFocus={() =>
                    runCompanySuggestions(
                      formData.companyAutocomplete,
                    )
                  }
                  placeholder="Search company..."
                  disabled={
                    user?.role !==
                    "SUPERADMIN" &&
                    Boolean(getSidebarContext())
                  }
                  autoComplete="off"
                />

                {companyList.length > 0 && (
                  <div className="absolute z-30 max-h-52 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
                    {companyList.map(
                      (company) => (
                        <button
                          key={company.id}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                          onMouseDown={(event) =>
                            event.preventDefault()
                          }
                          onClick={() => {
                            setFormData(
                              (current) => ({
                                ...current,
                                companyID:
                                  company.id,
                                companyAutocomplete:
                                  company.companyName,
                                serviceProviderID:
                                  company.serviceProviderID ??
                                  current.serviceProviderID,
                                branchesID: null,
                                branchAutocomplete:
                                  "",
                                steps:
                                  current.steps.map(
                                    (step) => ({
                                      ...step,
                                      designationID:
                                        null,
                                      designationName:
                                        "",
                                    }),
                                  ),

                                conditions: [],
                              }),
                            );

                            setCompanyList([]);
                          }}
                        >
                          {company.companyName}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>

              <div
                ref={branchRef}
                className="relative space-y-2"
              >
                <Label>Branch Scope</Label>

                <Input
                  value={
                    formData.branchAutocomplete
                  }
                  onChange={(event) => {
                    const value =
                      event.target.value;

                    setFormData((current) => ({
                      ...current,
                      branchesID: null,
                      branchAutocomplete: value,
                      steps: current.steps.map(
                        (step) => ({
                          ...step,
                          designationID: null,
                          designationName: "",
                        }),
                      ),

                      conditions: [],
                    }));

                    runBranchSuggestions(value);
                  }}
                  onFocus={() =>
                    runBranchSuggestions(
                      formData.branchAutocomplete,
                    )
                  }
                  placeholder="Select a branch or choose All Branches..."
                  disabled={
                    !formData.companyID ||
                    user?.role ===
                    "BRANCH_ADMIN"
                  }
                  autoComplete="off"
                />

                {branchList.length > 0 && (
                  <div className="absolute z-30 max-h-52 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
                    <button
                      type="button"
                      className="block w-full border-b px-3 py-2 text-left text-sm font-medium hover:bg-gray-50"
                      onClick={() => {
                        setFormData(
                          (current) => ({
                            ...current,
                            branchesID: null,
                            branchAutocomplete:
                              "All Branches",

                            steps: current.steps.map(
                              (step) => ({
                                ...step,
                                designationID: null,
                                designationName: "",
                              }),
                            ),

                            conditions: [],

                          }),
                        );

                        setBranchList([]);
                      }}
                    >
                      All Branches
                    </button>

                    {branchList.map((branch) => (
                      <button
                        key={branch.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        onMouseDown={(event) =>
                          event.preventDefault()
                        }
                        onClick={() => {
                          setFormData(
                            (current) => ({
                              ...current,
                              branchesID:
                                branch.id,
                              branchAutocomplete:
                                branch.branchName,
                              steps:
                                current.steps.map(
                                  (step) => ({
                                    ...step,
                                    designationID:
                                      null,
                                    designationName:
                                      "",
                                  }),
                                ),

                              conditions: [],
                            }),
                          );

                          setBranchList([]);
                        }}
                      >
                        {branch.branchName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="md:col-span-2 -mt-2">
                <p className="text-xs text-gray-500">
                  Branch Scope controls where the workflow exists. Use <strong>All Branches</strong>
                  for a company-wide workflow; exact branch workflows take priority over company-wide fallback.
                </p>
              </div>

              <div
                ref={moduleRef}
                className="relative space-y-2"
              >
                <Label>
                  Workflow Module *
                </Label>

                <Input
                  value={
                    formData.moduleAutocomplete
                  }
                  onChange={(event) => {
                    const value =
                      event.target.value;

                    setFormData((current) => ({
                      ...current,
                      companyModuleID: null,
                      moduleAutocomplete: value,
                    }));

                    runModuleSuggestions(value);
                  }}
                  onFocus={() =>
                    runModuleSuggestions(
                      formData.moduleAutocomplete,
                    )
                  }
                  placeholder="Search workflow module..."
                  autoComplete="off"
                />

                {moduleList.length > 0 && (
                  <div className="absolute z-30 max-h-52 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
                    {moduleList.map((module) => (
                      <button
                        key={module.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-gray-50"
                        onMouseDown={(event) =>
                          event.preventDefault()
                        }
                        onClick={() => {
                          setFormData(
                            (current) => ({
                              ...current,
                              companyModuleID:
                                module.id,
                              moduleAutocomplete:
                                module.moduleName,
                              conditions: [],
                            }),
                          );

                          setModuleList([]);
                        }}
                      >
                        <div className="text-sm font-medium">
                          {module.moduleName}
                        </div>

                        {module.moduleDescription && (
                          <div className="mt-0.5 line-clamp-1 text-xs text-gray-500">
                            {
                              module.moduleDescription
                            }
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workflowName">
                Workflow Name *
              </Label>

              <Input
                id="workflowName"
                value={formData.workflowName}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    workflowName:
                      event.target.value,
                  }))
                }
                placeholder="For example, Attendance Regularisation"
                maxLength={200}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workflowDescription">
                Description
              </Label>

              <Textarea
                id="workflowDescription"
                value={
                  formData.workflowDescription
                }
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    workflowDescription:
                      event.target.value,
                  }))
                }
                placeholder="Explain when and how this workflow should be used..."
                maxLength={2000}
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="space-y-4 rounded-xl border border-gray-200 p-4">
              <div>
                <Label className="text-sm font-semibold">
                  Approval Mode
                </Label>
                <p className="mt-1 text-xs text-gray-500">
                  Choose how the configured approval steps should be executed.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((current) => ({
                      ...current,
                      allowAnySameDesignation: false,
                    }))
                  }
                  className={`rounded-lg border p-4 text-left transition ${
                    !formData.allowAnySameDesignation
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 h-4 w-4 rounded-full border ${
                      !formData.allowAnySameDesignation
                        ? "border-primary bg-primary ring-2 ring-primary/20"
                        : "border-gray-300"
                    }`} />
                    <div>
                      <div className="text-sm font-semibold">
                        {APPROVAL_MODE_COPY.SEQUENTIAL.title}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        {APPROVAL_MODE_COPY.SEQUENTIAL.description}
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFormData((current) => ({
                      ...current,
                      allowAnySameDesignation: true,
                    }))
                  }
                  className={`rounded-lg border p-4 text-left transition ${
                    formData.allowAnySameDesignation
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 h-4 w-4 rounded-full border ${
                      formData.allowAnySameDesignation
                        ? "border-primary bg-primary ring-2 ring-primary/20"
                        : "border-gray-300"
                    }`} />
                    <div>
                      <div className="text-sm font-semibold">
                        {APPROVAL_MODE_COPY.ANY_ELIGIBLE.title}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        {APPROVAL_MODE_COPY.ANY_ELIGIBLE.description}
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <Label>Workflow Status</Label>
                  <p className="mt-1 text-xs text-gray-500">
                    Only active workflows are considered for new requests.
                    Existing approval requests keep their saved workflow snapshot.
                  </p>
                </div>

                <Switch
                  checked={formData.workflowStatus}
                  onCheckedChange={(checked) =>
                    setFormData((current) => ({
                      ...current,
                      workflowStatus: checked,
                    }))
                  }
                />
              </div>
            </div>
          </section>



<section className="space-y-4 border-t pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Approval Workflow Steps
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  {formData.allowAnySameDesignation
                    ? "All configured eligible approvers may act; the first valid approval completes the request."
                    : "Steps are processed from top to bottom. The next step becomes active only after the current step is completed."}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addStep}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Step
              </Button>
            </div>

            <div className="space-y-4">
              {formData.steps.map(
                (step, index) => {
                  const suggestions =
                    designationSuggestionMap[
                    step.localID
                    ] || [];

                  const loadingDesignation =
                    designationLoadingMap[
                    step.localID
                    ];

                  return (
                    <div
                      key={step.localID}
                      className="rounded-xl border border-gray-200 bg-gray-50/50 p-4"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                            {step.stepNo}
                          </div>

                          <div>
                            <div className="text-sm font-semibold">
                              Step {step.stepNo}
                            </div>


                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={index === 0}
                            onClick={() =>
                              moveStep(index, "UP")
                            }
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={
                              index ===
                              formData.steps.length - 1
                            }
                            onClick={() =>
                              moveStep(index, "DOWN")
                            }
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() =>
                              removeStep(
                                step.localID,
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Approver Type *</Label>
                          <select
                            value={step.approverType}
                            onChange={(event) => {
                              const approverType =
                                event.target.value as
                                  | "DESIGNATION"
                                  | "REPORTING_MANAGER";
                              updateStep(step.localID, {
                                approverType,
                                designationID:
                                  approverType ===
                                  "REPORTING_MANAGER"
                                    ? null
                                    : step.designationID,
                                designationName:
                                  approverType ===
                                  "REPORTING_MANAGER"
                                    ? ""
                                    : step.designationName,
                                stepName:
                                  step.stepName ||
                                  (approverType ===
                                  "REPORTING_MANAGER"
                                    ? "Reporting Manager Approval"
                                    : step.stepName),
                              });
                            }}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="DESIGNATION">
                              Designation
                            </option>
                            <option value="REPORTING_MANAGER">
                              Reporting Manager
                            </option>
                          </select>
                          <p className="text-xs text-gray-500">
                            {step.approverType === "REPORTING_MANAGER"
                              ? "Uses the employee's actual mapped reporting manager."
                              : "Uses active employees who hold the selected designation in the workflow company scope."}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>
                            Step Name
                          </Label>

                          <Input
                            value={step.stepName}
                            onChange={(event) =>
                              updateStep(
                                step.localID,
                                {
                                  stepName:
                                    event.target
                                      .value,
                                },
                              )
                            }
                            placeholder="For example, Manager Approval"
                            maxLength={150}
                          />
                        </div>

                        {step.approverType !==
                          "REPORTING_MANAGER" && (
                          <div
                            className="relative space-y-2 md:col-span-2"
                            data-designation-autocomplete
                          >
                            <Label>
                              Approver Designation *
                            </Label>

                            <Input
                              value={
                                step.designationName
                              }
                              onChange={(event) => {
                                const value =
                                  event.target.value;

                                updateStep(
                                  step.localID,
                                  {
                                    designationID:
                                      null,
                                    designationName:
                                      value,
                                  },
                                );

                                runDesignationSuggestions(
                                  step.localID,
                                  value,
                                );
                              }}
                              onFocus={() =>
                                runDesignationSuggestions(
                                  step.localID,
                                  step.designationName,
                                )
                              }
                              placeholder={
                                formData.branchesID
                                  ? "Search branch designation..."
                                  : "Search designation..."
                              }
                              autoComplete="off"
                            />

                            {(suggestions.length > 0 ||
                              loadingDesignation) && (
                                <div className="absolute z-40 max-h-52 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
                                  {loadingDesignation && (
                                    <div className="px-3 py-2 text-sm text-gray-500">
                                      Loading…
                                    </div>
                                  )}

                                  {suggestions.map(
                                    (designation) => (
                                      <button
                                        key={
                                          designation.id
                                        }
                                        type="button"
                                        className="block w-full px-3 py-2 text-left hover:bg-gray-50"
                                        onMouseDown={(
                                          event,
                                        ) =>
                                          event.preventDefault()
                                        }
                                        onClick={() => {
                                          updateStep(
                                            step.localID,
                                            {
                                              designationID:
                                                designation.id,
                                              designationName:
                                                designation.designation ?? "",
                                              stepName:
                                                step.stepName ||
                                                `${designation.designation} Approval`,
                                            },
                                          );

                                          setDesignationSuggestionMap(
                                            (current) => ({
                                              ...current,
                                              [step.localID]:
                                                [],
                                            }),
                                          );
                                        }}
                                      >
                                        <div className="text-sm font-medium">
                                          {
                                            designation.designation
                                          }
                                        </div>

                                        {designation
                                          .departments
                                          ?.departmentName && (
                                            <div className="mt-0.5 text-xs text-gray-500">
                                              {
                                                designation
                                                  .departments
                                                  .departmentName
                                              }
                                            </div>
                                          )}
                                      </button>
                                    ),
                                  )}
                                </div>
                              )}
                          </div>
                        )}

                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </section>


          <section className="space-y-4 border-t pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Apply To / Workflow Conditions
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Conditions decide when this workflow starts. Approval steps decide who approves.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCondition}
                disabled={!formData.companyModuleID}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Condition
              </Button>
            </div>

            {formData.conditions.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-4">
                <div>
                  <Label>Apply To</Label>

              
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      formData.conditionMatchType ===
                        "ALL"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      setFormData((current) => ({
                        ...current,
                        conditionMatchType: "ALL",
                      }))
                    }
                  >
                    Match All
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant={
                      formData.conditionMatchType ===
                        "ANY"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      setFormData((current) => ({
                        ...current,
                        conditionMatchType: "ANY",
                      }))
                    }
                  >
                    Match Any
                  </Button>
                </div>
              </div>
            )}

            {formData.companyModuleID && formData.conditions.length === 0 && (
              <NoticeBanner variant="info" compact>
                No conditions added. This workflow will apply to every request inside the selected
                Company + Branch Scope + Module once it becomes effective.
              </NoticeBanner>
            )}

            {formData.branchesID != null && formData.conditions.some((c) => c.fieldKey === "BRANCH") && (
              <NoticeBanner variant="warning" compact>
                This workflow already has a specific Branch Scope, so an additional Branch condition is redundant.
              </NoticeBanner>
            )}

            <div className="space-y-4">
              {formData.conditions.map(
                (condition) => {
                  const availableFields =
                    getAvailableConditionFields();

                  const availableOperators =
                    condition.fieldKey
                      ? FIELD_OPERATOR_MAP[
                      condition.fieldKey
                      ]
                      : [];

                  const departmentSuggestions =
                    conditionDepartmentSuggestions[
                    condition.localID
                    ] ?? [];

                  const designationSuggestions =
                    conditionDesignationSuggestions[
                    condition.localID
                    ] ?? [];

                  const employeeSuggestions =
                    conditionEmployeeSuggestions[
                    condition.localID
                    ] ?? [];

                  return (
                    <div
                      key={condition.localID}
                      className="rounded-xl border border-gray-200 bg-gray-50/50 p-4"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                            {condition.conditionNo}
                          </div>

                          <div>
                            <div className="text-sm font-semibold">
                              Condition{" "}
                              {condition.conditionNo}
                            </div>

                            <div className="text-xs text-gray-500">
                              Request matching rule
                            </div>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() =>
                            removeCondition(
                              condition.localID,
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Apply To *</Label>

                          <select
                            value={condition.fieldKey}
                            onChange={(event) =>
                              handleConditionFieldChange(
                                condition.localID,
                                event.target
                                  .value as WorkflowConditionField,
                              )
                            }
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="">
                              Select condition field
                            </option>

                            {availableFields.map(
                              (field) => (
                                <option
                                  key={field}
                                  value={field}
                                >
                                  {
                                    CONDITION_FIELD_LABELS[
                                    field
                                    ]
                                  }
                                </option>
                              ),
                            )}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label>Operator *</Label>

                          <select
                            value={condition.operator}
                            onChange={(event) =>
                              updateCondition(
                                condition.localID,
                                {
                                  operator:
                                    event.target
                                      .value as WorkflowConditionOperator,
                                  numberValueTo: "",
                                },
                              )
                            }
                            disabled={
                              !condition.fieldKey
                            }
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                          >
                            <option value="">
                              Select operator
                            </option>

                            {availableOperators.map(
                              (operator) => (
                                <option
                                  key={operator}
                                  value={operator}
                                >
                                  {
                                    CONDITION_OPERATOR_LABELS[
                                    operator
                                    ]
                                  }
                                </option>
                              ),
                            )}
                          </select>
                        </div>

                        {condition.fieldKey ===
                          "BRANCH" && (
                            <div
                              className="relative space-y-2 md:col-span-2"
                              data-condition-autocomplete
                            >
                              <Label>Branch *</Label>
                              <Input
                                value={condition.branchName}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  updateCondition(condition.localID, {
                                    branchesID: null,
                                    branchName: value,
                                  });
                                  runConditionBranchSuggestions(
                                    condition.localID,
                                    value,
                                  );
                                }}
                                onFocus={() =>
                                  runConditionBranchSuggestions(
                                    condition.localID,
                                    condition.branchName,
                                  )
                                }
                                placeholder="Search branch..."
                              />
                              {(conditionBranchSuggestions[
                                condition.localID
                              ] || []).length > 0 && (
                                <div className="absolute z-40 max-h-52 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
                                  {(conditionBranchSuggestions[
                                    condition.localID
                                  ] || []).map((branch) => (
                                    <button
                                      key={branch.id}
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                                      onClick={() => {
                                        updateCondition(
                                          condition.localID,
                                          {
                                            branchesID: branch.id,
                                            branchName:
                                              branch.branchName ?? "",
                                          },
                                        );
                                        setConditionBranchSuggestions(
                                          (current) => ({
                                            ...current,
                                            [condition.localID]: [],
                                          }),
                                        );
                                      }}
                                    >
                                      {branch.branchName}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                        {condition.fieldKey ===
                          "DEPARTMENT" && (
                            <div
  className="relative space-y-2 md:col-span-2"
  data-condition-autocomplete
>
  <Label>Department *</Label>

                              <Input
                                value={
                                  condition.departmentName
                                }
                                onChange={(event) => {
                                  const value =
                                    event.target.value;

                                  updateCondition(
                                    condition.localID,
                                    {
                                      departmentID:
                                        null,
                                      departmentName:
                                        value,
                                    },
                                  );

                                  runConditionDepartmentSuggestions(
                                    condition.localID,
                                    value,
                                  );
                                }}
                                onFocus={() =>
                                  runConditionDepartmentSuggestions(
                                    condition.localID,
                                    condition.departmentName,
                                  )
                                }
                                placeholder="Search department..."
                              />

                              {departmentSuggestions.length >
                                0 && (
                                  <div className="absolute z-40 max-h-52 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
                                    {departmentSuggestions.map(
                                      (department) => (
                                        <button
                                          key={department.id}
                                          type="button"
                                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                                          onClick={() => {
                                            updateCondition(
                                              condition.localID,
                                              {
                                                departmentID:
                                                  department.id,
                                                departmentName:
                                                  department.departmentName ??
                                                  "",
                                              },
                                            );

                                            setConditionDepartmentSuggestions(
                                              (current) => ({
                                                ...current,
                                                [condition.localID]:
                                                  [],
                                              }),
                                            );
                                          }}
                                        >
                                          {department.departmentName}
                                        </button>
                                      ),
                                    )}
                                  </div>
                                )}
                            </div>
                          )}

                        {condition.fieldKey ===
                          "DESIGNATION" && (
                          <div
  className="relative space-y-2 md:col-span-2"
  data-condition-autocomplete
>
  <Label>Designation *</Label>

                              <Input
                                value={
                                  condition.designationName
                                }
                                onChange={(event) => {
                                  const value =
                                    event.target.value;

                                  updateCondition(
                                    condition.localID,
                                    {
                                      designationID:
                                        null,
                                      designationName:
                                        value,
                                    },
                                  );

                                  runConditionDesignationSuggestions(
                                    condition.localID,
                                    value,
                                  );
                                }}
                                onFocus={() =>
                                  runConditionDesignationSuggestions(
                                    condition.localID,
                                    condition.designationName,
                                  )
                                }
                                placeholder="Search designation..."
                              />

                              {designationSuggestions.length >
                                0 && (
                                  <div className="absolute z-40 max-h-52 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
                                    {designationSuggestions.map(
                                      (designation) => (
                                        <button
                                          key={designation.id}
                                          type="button"
                                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                                          onClick={() => {
                                            updateCondition(
                                              condition.localID,
                                              {
                                                designationID:
                                                  designation.id,
                                                designationName:
                                                  designation.designation ??
                                                  "",
                                              },
                                            );

                                            setConditionDesignationSuggestions(
                                              (current) => ({
                                                ...current,
                                                [condition.localID]:
                                                  [],
                                              }),
                                            );
                                          }}
                                        >
                                          {designation.designation}
                                        </button>
                                      ),
                                    )}
                                  </div>
                                )}
                            </div>
                          )}

                        {condition.fieldKey ===
                          "EMPLOYEE" && (
                   <div
  className="relative space-y-3 md:col-span-2"
  data-condition-autocomplete
>
  <Label>Select Employees *</Label>

                              {condition.selectedEmployees
                                .length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {condition.selectedEmployees.map(
                                      (employee) => (
                                        <Badge
                                          key={employee.id}
                                          variant="secondary"
                                          className="gap-1"
                                        >
                                          {[
                                            employee.employeeFirstName,
                                            employee.employeeLastName,
                                          ]
                                            .filter(Boolean)
                                            .join(" ") ||
                                            employee.employeeID}

                                          <button
                                            type="button"
                                            onClick={() =>
                                              removeConditionEmployee(
                                                condition.localID,
                                                employee.id,
                                              )
                                            }
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </Badge>
                                      ),
                                    )}
                                  </div>
                                )}

                              <Input
                                value={
                                  condition.employeeSearch
                                }
                                onChange={(event) => {
                                  const value =
                                    event.target.value;

                                  updateCondition(
                                    condition.localID,
                                    {
                                      employeeSearch:
                                        value,
                                    },
                                  );

                                  runConditionEmployeeSuggestions(
                                    condition.localID,
                                    value,
                                  );
                                }}
                                onFocus={() =>
                                  runConditionEmployeeSuggestions(
                                    condition.localID,
                                    condition.employeeSearch,
                                  )
                                }
                                placeholder="Search employee by name or employee ID..."
                              />

                              {(employeeSuggestions.length >
                                0 ||
                                conditionEmployeeLoading[
                                condition.localID
                                ]) && (
                                  <div className="absolute z-40 max-h-52 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
                                    {conditionEmployeeLoading[
                                      condition.localID
                                    ] && (
                                        <div className="px-3 py-2 text-sm text-gray-500">
                                          Loading…
                                        </div>
                                      )}

                                    {employeeSuggestions.map(
                                      (employee) => (
                                        <button
                                          key={employee.id}
                                          type="button"
                                          className="block w-full px-3 py-2 text-left hover:bg-gray-50"
                                          onClick={() =>
                                            selectConditionEmployee(
                                              condition.localID,
                                              employee,
                                            )
                                          }
                                        >
                                          <div className="text-sm font-medium">
                                            {[
                                              employee.employeeFirstName,
                                              employee.employeeLastName,
                                            ]
                                              .filter(Boolean)
                                              .join(" ")}
                                          </div>

                                          <div className="text-xs text-gray-500">
                                            Employee ID:{" "}
                                            {employee.employeeID ??
                                              "—"}
                                          </div>
                                        </button>
                                      ),
                                    )}
                                  </div>
                                )}
                            </div>
                          )}

                        {[
                          "TOTAL_AMOUNT",
                          "SALARY_AMOUNT",
                          "LEAVE_DAYS",
                          "REGULARISATION_DAYS",
                        ].includes(
                          condition.fieldKey,
                        ) && (
                            <>
                              <div className="space-y-2">
                                <Label>
                                  {condition.operator ===
                                    "BETWEEN"
                                    ? "Minimum Value"
                                    : "Value"}{" "}
                                  *
                                </Label>

                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={
                                    condition.numberValue
                                  }
                                  onChange={(event) =>
                                    updateCondition(
                                      condition.localID,
                                      {
                                        numberValue:
                                          event.target
                                            .value,
                                      },
                                    )
                                  }
                                />
                              </div>

                              {condition.operator ===
                                "BETWEEN" && (
                                  <div className="space-y-2">
                                    <Label>
                                      Maximum Value *
                                    </Label>

                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={
                                        condition.numberValueTo
                                      }
                                      onChange={(event) =>
                                        updateCondition(
                                          condition.localID,
                                          {
                                            numberValueTo:
                                              event.target
                                                .value,
                                          },
                                        )
                                      }
                                    />
                                  </div>
                                )}
                            </>
                          )}

                        {condition.fieldKey === "REGULARISATION_TYPE" && (
                          <div className="space-y-2 md:col-span-2">
                            <Label>Regularisation Type *</Label>
                            <select
                              value={condition.textValue}
                              onChange={(event) =>
                                updateCondition(
                                  condition.localID,
                                  { textValue: event.target.value },
                                )
                              }
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="">Select regularisation type</option>
                              {REGULARISATION_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500">
                              Stored using the same internal code used by Attendance Regularisation.
                            </p>
                          </div>
                        )}

                        {[
                          "LEAVE_TYPE",
                          "EXIT_TYPE",
                          "REQUEST_TEXT",
                        ].includes(
                          condition.fieldKey,
                        ) && (
                          <div className="space-y-2 md:col-span-2">
                            <Label>
                              {condition.fieldKey === "LEAVE_TYPE"
                                ? "Leave Type *"
                                : condition.fieldKey === "EXIT_TYPE"
                                  ? "Exit Type *"
                                  : "Text Value *"}
                            </Label>

                            <Input
                              value={condition.textValue}
                              onChange={(event) =>
                                updateCondition(
                                  condition.localID,
                                  { textValue: event.target.value },
                                )
                              }
                              placeholder={
                                condition.fieldKey === "REQUEST_TEXT"
                                  ? "Enter text to match..."
                                  : "Enter exact value used by the source module..."
                              }
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>

            {!formData.companyModuleID && (
              <NoticeBanner variant="warning" compact>
                Select a workflow module before adding
                conditions.
              </NoticeBanner>
            )}
          </section>

          
          <div className="rounded-xl border bg-gray-50 p-4 text-sm">
            <div className="font-semibold text-gray-900">Workflow Summary</div>
            <div className="mt-2 grid grid-cols-1 gap-2 text-gray-600 md:grid-cols-2">
              <div>
                <span className="font-medium text-gray-800">Scope:</span>{" "}
                {formData.companyAutocomplete || "Company not selected"} /{" "}
                {formData.branchesID == null
                  ? "All Branches"
                  : formData.branchAutocomplete || "Selected Branch"}
              </div>
              <div>
                <span className="font-medium text-gray-800">Module:</span>{" "}
                {formData.moduleAutocomplete || "Not selected"}
              </div>
              <div>
                <span className="font-medium text-gray-800">Conditions:</span>{" "}
                {formData.conditions.length === 0
                  ? "All requests in scope"
                  : `${formData.conditionMatchType === "ALL" ? "Match All" : "Match Any"} (${formData.conditions.length})`}
              </div>
              <div>
                <span className="font-medium text-gray-800">Approval:</span>{" "}
                {formData.allowAnySameDesignation
                  ? APPROVAL_MODE_COPY.ANY_ELIGIBLE.title
                  : APPROVAL_MODE_COPY.SEQUENTIAL.title}{" "}
                · {formData.steps.length} step{formData.steps.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closePanels}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={saving}
            >
              <Save className="mr-1 h-4 w-4" />

              {saving
                ? "Saving..."
                : editing
                  ? "Update Workflow"
                  : "Create Workflow"}
            </Button>
          </div>
        </form>
      </FormDrawer>

      <FormDrawer
        open={Boolean(isViewing && viewRow)}
        onOpenChange={(open) => {
          if (!open) closePanels();
        }}
        title="Approval Workflow Details"
        showHeaderCancel
        cancelLabel="Close"
      >
        {viewRow && (
          <EntityDetailLayout
            hero={
              <EntityDetailHero
                title={viewRow.workflowName}
                subtitle={
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {moduleName(viewRow)}
                    </Badge>

                    <Badge
                      className={
                        viewRow.workflowStatus !==
                          false
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                      }
                    >
                      {viewRow.workflowStatus !==
                        false
                        ? "Active"
                        : "Inactive"}
                    </Badge>
                  </div>
                }
              />
            }
            columns={1}
          >
            <DetailCard
              title="Workflow Configuration"
              subtitle="Workflow scope and activation details"
              rows={[
                {
                  label: "Company",
                  value: companyName(viewRow),
                },
                {
                  label: "Branch Scope",
                  value: branchName(viewRow),
                },
                {
                  label: "Module",
                  value: moduleName(viewRow),
                },
                {
                  label: "Effective From",
                  value: formatDateTime(
                    viewRow.effectiveFrom,
                  ),
                },
                {
                  label: "Description",
                  value:
                    viewRow.workflowDescription ||
                    "No description",
                },
                {
                  label: "Approval Mode",
                  value:
                    viewRow.allowAnySameDesignation
                      ? APPROVAL_MODE_COPY.ANY_ELIGIBLE.title
                      : APPROVAL_MODE_COPY.SEQUENTIAL.title,
                },
                {
                  label: "Status",
                  value:
                    viewRow.workflowStatus !==
                      false
                      ? "Active"
                      : "Inactive",
                },
              ]}
            />


            {(!viewRow.conditions || viewRow.conditions.length === 0) && (
              <DetailCard
                title="Workflow Conditions"
                subtitle="No additional conditions"
                rows={[
                  {
                    label: "Applies To",
                    value: "All requests inside the selected Company + Branch Scope + Module",
                  },
                ]}
              />
            )}

            {viewRow.conditions &&
              viewRow.conditions.length > 0 && (
                <div className="rounded-xl border bg-white p-5">
                  <div className="mb-4">
                    <h3 className="font-semibold">
                      Workflow Conditions
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                      Match{" "}
                      {viewRow.conditionMatchType ===
                        "ANY"
                        ? "any"
                        : "all"}{" "}
                      of the following conditions.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {viewRow.conditions.map(
                      (condition) => (
                        <div
                          key={
                            condition.id ??
                            condition.conditionNo
                          }
                          className="rounded-lg border p-3"
                        >
                          <div className="font-medium">
                            Condition{" "}
                            {condition.conditionNo}:{" "}
                            {
                              CONDITION_FIELD_LABELS[
                              condition.fieldKey
                              ]
                            }
                          </div>

                          <div className="mt-1 text-sm text-gray-600">
                            {
                              CONDITION_OPERATOR_LABELS[
                              condition.operator
                              ]
                            }{" "}
                           {conditionValueLabel(
  condition,
)}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

            <div className="rounded-xl border bg-white p-5">
              <div className="mb-4">
                <h3 className="font-semibold">
                  Approval Steps
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  {viewRow.allowAnySameDesignation
                    ? "Any eligible configured approver may complete the request."
                    : "Approval is processed in this order."}
                </p>
              </div>

              <div className="space-y-3">
                {(viewRow.steps || [])
                  .sort(
                    (a, b) =>
                      a.stepNo - b.stepNo,
                  )
                  .map((step, index) => (
                    <div
                      key={
                        step.id ??
                        `${step.stepNo}-${step.designationID}`
                      }
                      className="relative flex gap-3"
                    >
                      <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                          {step.stepNo}
                        </div>

                        {index <
                          viewRow.steps.length -
                          1 && (
                            <div className="mt-1 h-full min-h-8 w-px bg-gray-200" />
                          )}
                      </div>

                      <div className="flex-1 rounded-lg border p-3">
                        <div className="font-medium">
                          {step.stepName ||
                            (step.approverType ===
                            "REPORTING_MANAGER"
                              ? "Reporting Manager Approval"
                              : `${step.designation?.designation || "Designation"} Approval`)}
                        </div>

                        <div className="mt-1 text-sm text-gray-600">
                          {step.approverType ===
                          "REPORTING_MANAGER"
                            ? "Reporting Manager"
                            : step.designation
                                ?.designation ||
                              (step.designationID
                                ? `Designation #${step.designationID}`
                                : "—")}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {step.isMandatory !==
                            false && (
                              <Badge variant="outline">
                                Mandatory
                              </Badge>
                            )}

                          {step.canReject !==
                            false && (
                              <Badge variant="outline">
                                Can Reject
                              </Badge>
                            )}

                          {step.canSendBack && (
                            <Badge variant="outline">
                              Can Send Back
                            </Badge>
                          )}

                          {step.approvalTimeout && (
                            <Badge variant="outline">
                              {
                                step.approvalTimeout
                              }{" "}
                              hour timeout
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </EntityDetailLayout>
        )}
      </FormDrawer>

      {!isFormOpen && !isViewing && (
        <>
          <FilterBar
            search={{
              value: table.search,
              onChange: table.setSearch,
              placeholder:
                "Search workflow, module or designation…",
            }}
            filters={
              <div className="flex flex-wrap gap-2">
                <FilterSelect
                  id="workflow-company-filter"
                  value={companyFilter}
                  onChange={(value) => {
                    setCompanyFilter(value);
                    setBranchFilter("ALL");
                  }}
                  options={
                    companyFilterOptions
                  }
                  width="w-52"
                  ariaLabel="Filter by company"
                />

                <FilterSelect
                  id="workflow-branch-filter"
                  value={branchFilter}
                  onChange={setBranchFilter}
                  options={
                    branchFilterOptions
                  }
                  width="w-52"
                  ariaLabel="Filter by branch"
                />

                <FilterSelect
                  id="workflow-module-filter"
                  value={moduleFilter}
                  onChange={setModuleFilter}
                  options={
                    moduleFilterOptions
                  }
                  width="w-52"
                  ariaLabel="Filter by module"
                />

                <FilterSelect
                  id="workflow-status-filter"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={
                    statusFilterOptions
                  }
                  width="w-44"
                  ariaLabel="Filter by status"
                />
              </div>
            }
          />

          <EntityListShell
            title="All approval workflows"
            columns={columns}
            rows={filteredRows}
            rowKey={(workflow) =>
              String(workflow.id)
            }
            isLoading={loading}
            sortBy={table.sortBy}
            sortDir={table.sortDir}
            onSort={table.setSort}
            emptyIcon={GitBranch}
            emptyTitle="No approval workflows found"
            emptyDescription={
              table.search ||
                companyFilter !== "ALL" ||
                branchFilter !== "ALL" ||
                moduleFilter !== "ALL" ||
                statusFilter !== "ALL"
                ? "No workflows match the selected filters."
                : "Create a workflow to define module approval levels."
            }
            emptyAction={
              canManage &&
                !table.search &&
                companyFilter === "ALL" &&
                branchFilter === "ALL" &&
                moduleFilter === "ALL" &&
                statusFilter === "ALL" ? (
                <Button
                  onClick={openCreateForm}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Create Workflow
                </Button>
              ) : undefined
            }
          />
        </>
      )}
    </div>
  );
}