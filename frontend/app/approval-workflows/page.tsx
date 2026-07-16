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
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Checkbox } from "../components/ui/checkbox";
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
  moduleName: string;
  moduleDescription?: string | null;
  moduleStatus?: boolean | null;
}

interface WorkflowStepRead {
  id?: ID;
  approvalWorkflowID?: ID;
  stepNo: number;
  designationID: ID;
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

interface ApprovalWorkflowRead {
  id: ID;
  serviceProviderID?: ID | null;
  companyID: ID;
  branchesID?: ID | null;
  companyModuleID: ID;

  workflowName: string;
  workflowDescription?: string | null;
  effectiveFrom: string;

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
}

interface WorkflowStepForm {
  localID: string;
  stepNo: number;
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

  allowAnySameDesignation: boolean;
  workflowStatus: boolean;

  steps: WorkflowStepForm[];
}

const API = {
  workflows: "/backend/approval-workflows",
  companies: "/backend/company",
  branches: "/backend/branches",
  designations: "/backend/designations",
  companyModules: "/backend/company-modules",
};

const MIN_CHARS = 0;
const DEBOUNCE_MS = 250;

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
    localID: createLocalID(),
    stepNo,
    designationID: null,
    designationName: "",
    stepName: "",
    isMandatory: true,
    canReject: true,
    canSendBack: false,
    approvalTimeout: "",
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

    allowAnySameDesignation: false,
    workflowStatus: true,

    steps: [createEmptyStep(1)],
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
    user?.role === "COMPANY_ADMIN" ||
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
      ] = await Promise.all([
        fetchJSONSafe<CompanyRead[]>(API.companies),
        fetchJSONSafe<BranchRead[]>(API.branches),
        fetchJSONSafe<CompanyModuleRead[]>(
          API.companyModules,
        ),
        fetchJSONSafe<DesignationRead[]>(
          API.designations,
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
        step.localID === localID
          ? { ...step, ...patch }
          : step,
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

  const handleEdit = (
    workflow: ApprovalWorkflowRead,
  ) => {
    setEditing(workflow);
    setIsViewing(false);
    setViewRow(null);
    setError(null);

    setFormData({
      serviceProviderID:
        workflow.serviceProviderID ?? null,

      companyID: workflow.companyID,
      branchesID: workflow.branchesID ?? null,

      companyModuleID:
        workflow.companyModuleID,

      companyAutocomplete:
        workflow.company?.companyName ?? "",

      branchAutocomplete:
        workflow.branches?.branchName ?? "",

      moduleAutocomplete:
        workflow.companyModule?.moduleName ?? "",

      workflowName:
        workflow.workflowName ?? "",

      workflowDescription:
        workflow.workflowDescription ?? "",

      effectiveFrom: toDateTimeLocal(
        workflow.effectiveFrom,
      ),

      allowAnySameDesignation:
        workflow.allowAnySameDesignation ??
        false,

      workflowStatus:
        workflow.workflowStatus !== false,

      steps: (workflow.steps || [])
        .sort((a, b) => a.stepNo - b.stepNo)
        .map((step, index) => ({
          localID: createLocalID(),
          stepNo: index + 1,
          designationID:
            step.designationID ?? null,
          designationName:
            step.designation?.designation ??
            "",
          stepName: step.stepName ?? "",
          isMandatory:
            step.isMandatory !== false,
          canReject:
            step.canReject !== false,
          canSendBack:
            step.canSendBack === true,
          approvalTimeout:
            step.approvalTimeout != null
              ? String(step.approvalTimeout)
              : "",
        })),
    });

    setIsFormOpen(true);
  };

  const handleView = (
    workflow: ApprovalWorkflowRead,
  ) => {
    setViewRow(workflow);
    setIsViewing(true);
    setIsFormOpen(false);
  };

  const validateForm = () => {
    const errors: string[] = [];

    if (!formData.companyID) {
      errors.push("Company is required");
    }

    if (!formData.companyModuleID) {
      errors.push("Workflow module is required");
    }

    if (!formData.workflowName.trim()) {
      errors.push("Workflow name is required");
    }

    if (!formData.effectiveFrom) {
      errors.push(
        "Workflow effective date and time are required",
      );
    }

    if (!formData.steps.length) {
      errors.push(
        "At least one approval step is required",
      );
    }

    formData.steps.forEach((step, index) => {
      if (!step.designationID) {
        errors.push(
          `Designation is required for step ${
            index + 1
          }`,
        );
      }

      if (
        step.approvalTimeout &&
        Number(step.approvalTimeout) <= 0
      ) {
        errors.push(
          `Approval timeout for step ${
            index + 1
          } must be greater than zero`,
        );
      }
    });

    const designationIDs = formData.steps
      .map((step) => step.designationID)
      .filter(Boolean);

    /*
     * Repeated designations are normally a configuration mistake.
     */
    if (
      new Set(designationIDs).size !==
      designationIDs.length
    ) {
      errors.push(
        "The same designation cannot be used in multiple approval steps",
      );
    }

    return errors;
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const validationErrors = validateForm();

    if (validationErrors.length) {
      validationErrors.forEach((message) =>
        toast.error(message),
      );

      return;
    }

    const context = getSidebarContext();

    const serviceProviderID =
      context?.serviceProviderID ??
      formData.serviceProviderID ??
      currentUserMapping?.serviceProviderID ??
      user?.serviceProviderID ??
      undefined;

    const companyID =
      context?.companyID ??
      formData.companyID ??
      currentUserMapping?.companyID ??
      user?.companyID;

    const payload = {
      serviceProviderID,
      companyID,
      branchesID:
        formData.branchesID ?? undefined,

      companyModuleID:
        formData.companyModuleID,

      workflowName:
        formData.workflowName.trim(),

      workflowDescription:
        formData.workflowDescription.trim() ||
        undefined,

      effectiveFrom: new Date(
        formData.effectiveFrom,
      ).toISOString(),

      allowAnySameDesignation:
        formData.allowAnySameDesignation,

      workflowStatus:
        formData.workflowStatus,

      createdByUserID:
        user?.id ?? undefined,

      steps: formData.steps.map(
        (step, index) => ({
          stepNo: index + 1,
          designationID:
            step.designationID as number,

          stepName:
            step.stepName.trim() ||
            `${step.designationName} Approval`,

          isMandatory:
            step.isMandatory,

          canReject:
            step.canReject,

          canSendBack:
            step.canSendBack,

          approvalTimeout:
            step.approvalTimeout
              ? Number(step.approvalTimeout)
              : undefined,
        }),
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
            body: JSON.stringify(payload),
          },
        );

        toast.success(
          "Approval workflow updated successfully",
        );
      } else {
        await fetchJSONSafe(API.workflows, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        toast.success(
          "Approval workflow created successfully",
        );
      }

      await fetchRows();
      closePanels();
    } catch (err: any) {
      const message =
        err?.message ||
        "Failed to save approval workflow";

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
        description="Configure module-based, company and branch-specific multi-step approval workflows."
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
                Select where and when this workflow
                applies.
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
                <Label>Branch</Label>

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
                    }));

                    runBranchSuggestions(value);
                  }}
                  onFocus={() =>
                    runBranchSuggestions(
                      formData.branchAutocomplete,
                    )
                  }
                  placeholder="Search branch or leave blank for all branches..."
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

            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="allowAnySameDesignation"
                  checked={
                    formData.allowAnySameDesignation
                  }
                  onCheckedChange={(checked) =>
                    setFormData((current) => ({
                      ...current,
                      allowAnySameDesignation:
                        checked === true,
                    }))
                  }
                />

                <div>
                  <Label
                    htmlFor="allowAnySameDesignation"
                    className="cursor-pointer"
                  >
                    Allow approval by any eligible
                    employee with the selected
                    designation
                  </Label>

                  <p className="mt-1 text-xs text-gray-500">
                    When disabled, the system should
                    resolve the requester&apos;s actual
                    reporting hierarchy. When enabled,
                    any active employee with the selected
                    designation in the applicable company
                    and branch may approve.
                  </p>
                </div>
              </div>

              {/* <div className="flex items-center justify-between border-t pt-3">
                <div>
                  <Label>Workflow Status</Label>

                  <p className="mt-1 text-xs text-gray-500">
                    Only active workflows can be resolved
                    for new requests.
                  </p>
                </div>

                <Switch
                  checked={
                    formData.workflowStatus
                  }
                  onCheckedChange={(checked) =>
                    setFormData((current) => ({
                      ...current,
                      workflowStatus: checked,
                    }))
                  }
                />
              </div> */}
            </div>
          </section>

          <section className="space-y-4 border-t pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Approval Workflow Steps
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Steps are processed sequentially from
                  top to bottom.
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
                        <div
                          className="relative space-y-2"
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

                      
                        </div>
                    </div>
                  );
                },
              )}
            </div>
          </section>

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
                  label:
                    "Any Same Designation Can Approve",
                  value:
                    viewRow.allowAnySameDesignation
                      ? "Yes"
                      : "No",
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

            <div className="rounded-xl border bg-white p-5">
              <div className="mb-4">
                <h3 className="font-semibold">
                  Approval Steps
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Approval is processed in this order.
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
                            `${step.designation?.designation || "Designation"} Approval`}
                        </div>

                        <div className="mt-1 text-sm text-gray-600">
                          {step.designation
                            ?.designation ||
                            `Designation #${step.designationID}`}
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