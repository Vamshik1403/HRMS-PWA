"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Icon } from "@iconify/react";
import { Plus, Edit, Trash2, Eye, X, Save, History, Download, Copy, Users, Key, ExternalLink, FileText, Upload } from "lucide-react";
import { PageHeader } from "../components/app/page-header";
import { DetailCard } from "../components/app/detail-card";
import { displayValue } from "../utils/display";
import { FilterBar, FilterSelect } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import type { DataTableColumn } from "../components/app/data-table";
import { EntityRowActions } from "../components/app/entity-row-actions";
import { useClientTable, sortRows } from "../hooks/use-client-table";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { dispatchAppRefresh, registerDataCacheClearer } from "../utils/appRefresh";
import { authHeaders } from "@/lib/auth";

const jsonAuthHeaders = () => authHeaders({ "Content-Type": "application/json" });
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { FormDrawer } from "../components/ui/form-drawer";
import { NoticeBanner } from "../components/ui/notice-banner";
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";
import { isDesktopManagerEmployee, resolveScopedCompanyId } from "../utils/scopeContext";
import {
  CollapsibleFormGroup,
  EmployeeFormSectionNav,
  EMPLOYEE_FORM_SECTIONS,
  type EmpFormSectionId,
} from "./ManageEmployeeFormUi";
import { MultiValueField } from "../components/ui/multi-value-field";
import { joinMultiValue, parseMultiValue, primaryMultiValue } from "../utils/multiValue";

function parsePayGradeNames(shiftEligibility: string | null | undefined): string[] {
  const s = (shiftEligibility ?? "").trim();
  if (!s.startsWith("{")) return [];
  try {
    const o = JSON.parse(s) as { payGrades?: string[] };
    return Array.isArray(o.payGrades) ? o.payGrades.filter(Boolean) : [];
  } catch {
    return [];
  }
}

/* =========================
   Types aligned to backend
   ========================= */
type ID = number;

interface SP { id: ID; companyName?: string | null; }
interface CO { id: ID; companyName?: string | null; serviceProviderID?: ID | null; branchesID?: ID | null; }
interface BR { id: ID; branchName?: string | null; companyID?: ID | null; branchesID?: ID | null; serviceProviderID?: ID | null; }
interface Device { id: ID; deviceName?: string | null; companyID?: ID | null; branchesID?: ID | null; deviceType?: string | null; }
interface MonthlyPG { id: ID; monthlyPayGradeName?: string | null; companyID?: ID | null; branchesID?: ID | null; }
interface HourlyPG { id: ID; hourlyPayGradeName?: string | null; }


type PromotionForm = {
  id?: number;
  departmentNameID: number | null;
  designationID: number | null;
  managerID: number | null;
  employmentType: string;
  employmentStatus: string;
  probationPeriod: string;
  workShiftID: number | null;
  attendancePolicyID: number | null;
  leavePolicyID: number | null;
  salaryPayGradeType: string;
  monthlyPayGradeID: number | null;
  hourlyPayGradeID: number | null;
};

interface EduRead {
  id: ID;
  instituteType?: string | null;
  instituteName?: string | null;
  degree?: string | null;
  pasingYear?: string | null;
  marks?: string | null;
  gpaCgpa?: string | null;
  class?: string | null;
}
interface ExpRead {
  id: ID;
  orgName?: string | null;
  designation?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  responsibility?: string | null;
  skill?: string | null;
}
interface DevMapRead {
  id: ID;
  manageEmployeeID?: number | null;
  deviceName?: string | null;
  deviceID?: number | null;
  deviceEmpCode?: string | null;
  device?: { id: ID; deviceName?: string | null; deviceType?: 'AT' | 'TR' | 'TV' } | null;
  deviceType?: 'AT' | 'TR' | 'TV';
}


type DevMapForm = {
  id?: ID;
  _localId: string;
  deviceID: string;
  deviceEmpCode: string;
  deviceName?: string;
  deviceType?: string;
  authType?: string;
  _devAutocomplete?: string;
};

type TokenDevMapForm = {
  id?: ID;
  _localId: string;
  deviceID: string;
  deviceEmpCode: string;
  deviceName?: string;
  deviceType: string; // 'TR' or 'TV'
  authType?: string;
  _devAutocomplete?: string;
};

type BankDetailsForm = {
  id?: ID;
  _localId: string;
  bankName: string;
  bankBranchName: string;
  accNumber: string;
  ifscCode: string;
  upi: string;
};

type EmployeeDocumentForm = {
  id?: ID;
  _localId: string;
  name: string;
  category: string;
  description: string;
  issuedDate: string;
  expiryDate: string;
  fileUrl: string;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  file?: File | null;
};

interface BankDetailsRead {
  id: ID;
  bankName?: string | null;
  bankBranchName?: string | null;
  accNumber?: string | null;
  ifscCode?: string | null;
  upi?: string | null;
}

interface ManageEmpRead {
  id: ID;
  // FKs
  serviceProviderID?: ID | null;
  companyID?: ID | null;
  branchesID?: ID | null;
  contractorID?: ID | null;

  // Scalars
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
  deviceEmpCode?: string | null;
  employeeID?: string | null;
  joiningDate?: string | null;

  empType?: string | null;
  pfMemberStatus?: string | null;
  pfNumber?: string | null;
  aadharNo?: string | null;
  panNo?: string | null;
  uanNo?: string | null;
  esiNo?: string | null;

  // Basic position fields (now stored directly on ManageEmployee)
  departmentNameID?: ID | null;
  designationID?: ID | null;
  managerID?: ID | null;
  employmentType?: string | null;
  employmentStatus?: string | null;
  probationPeriod?: string | null;
  workShiftID?: ID | null;
  attendancePolicyID?: ID | null;
  leavePolicyID?: ID | null;
  salaryPayGradeType?: string | null;
  monthlyPayGradeID?: ID | null;
  hourlyPayGradeID?: ID | null;

  shiftEligibility?: string | null;
  nightShiftEligibility?: string | null;
  maxHoursPerDay?: string | null;
  weeklyOffPattern?: string | null;
  noticePeriodDaysForResignation?: string | null;
  noticePeriodDaysForTermination?: string | null;

  typeOfEmployee?: string | null;

  businessPhoneNo?: string | null;
  businessEmail?: string | null;
  personalPhoneNo?: string | null;
  personalEmail?: string | null;
  emergancyContact?: string | null;
  presentAddress?: string | null;
  permenantAddress?: string | null;
  employeePhotoUrl?: string | null;

  gender?: string | null;
  numberOfChildren?: number | null;
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  maritalStatus?: string | null;
  employeeFatherName?: string | null;
  employeeMotherName?: string | null;
  employeeSpouseName?: string | null;

  // Relations for display
  serviceProvider?: { id: ID; companyName?: string | null } | null;
  contractor?: { id: ID; contractorName?: string | null } | null;
  company?: { id: ID; companyName?: string | null } | null;
  branches?: { id: ID; branchName?: string | null } | null;

  // Basic position relations
  departments?: { id: ID; departmentName?: string | null } | null;
  designations?: { id: ID; designation?: string | null } | null;
  manager?: { id: ID; employeeFirstName?: string | null; employeeLastName?: string | null } | null;
  workShift?: { id: ID; workShiftName?: string | null } | null;
  attendancePolicy?: { id: ID; attendancePolicyName?: string | null } | null;
  leavePolicy?: { id: ID; leavePolicyName?: string | null } | null;
  monthlyPayGrade?: { id: ID; monthlyPayGradeName?: string | null } | null;
  hourlyPayGrade?: { id: ID; hourlyPayGradeName?: string | null } | null;

  // Nested arrays
  empEduQualification?: EduRead[];
  empProfExprience?: ExpRead[];
  empDeviceMapping?: DevMapRead[];
  tokenDeviceMapping?: DevMapRead[];
  bankDetails?: BankDetailsRead[];
  employeeBankDetails?: BankDetailsRead[];
  employeeDocuments?: EmployeeDocumentForm[];

  createdAt?: string | null;

  // Optional denormalized:
  serviceProviderName?: string | null;
  contractorName?: string | null;
  companyName?: string | null;
  branchName?: string | null;
}

/* =========================
   Config & helpers
   ========================= */
const API = {
  manageEmp: "/backend/manage-emp",
  manageEmpList: "/backend/manage-emp/list",
  serviceProviders: "/backend/service-provider",
  companies: "/backend/company",
  branches: "/backend/branches",
  upload: "/backend/files/upload",
  employeeDocuments: "/backend/manage-emp-documents",

  // NEW:
  departments: "/backend/departments",
  designations: "/backend/designations",
  employees: "/backend/manage-emp",
  contractors: "/backend/contractors",
  workShifts: "/backend/work-shift",
  factualWorkShifts: "/backend/factual-work-shift",
  attendancePolicies: "/backend/attendance-policy",
  factualAttendancePolicies: "/backend/factual-attendance-policy",
  leavePolicies: "/backend/leave-policy",
  devices: "/backend/devices",
  monthlyGrades: "/backend/monthly-pay-grade",
  hourlyGrades: "/backend/hourly-grade",
};

const MIN_CHARS = 0;
const DEBOUNCE_MS = 250;

async function fetchJSONSafe<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} @ ${url}`);
  }
  const raw = await res.json();
  return (raw?.data ?? raw) as T;
}

/**
 * Session cache for slow-changing reference tables (departments, branches,
 * designations, policies, etc.). The same lists were previously re-downloaded
 * on every dropdown focus and on every form-modal open, which made opening
 * forms feel sluggish. Cached for a short TTL and de-duplicated while in flight.
 */
const REF_CACHE_TTL_MS = 60_000;
const refCache = new Map<string, { ts: number; data: unknown }>();
const refInFlight = new Map<string, Promise<unknown>>();

function clearRefCache() {
  refCache.clear();
  refInFlight.clear();
}

async function fetchRefCached<T>(url: string, signal?: AbortSignal): Promise<T> {
  const hit = refCache.get(url);
  if (hit && Date.now() - hit.ts < REF_CACHE_TTL_MS) {
    return hit.data as T;
  }
  const inflight = refInFlight.get(url);
  if (inflight) return inflight as Promise<T>;

  const p = (async () => {
    const data = await fetchJSONSafe<T>(url, signal);
    refCache.set(url, { ts: Date.now(), data });
    refInFlight.delete(url);
    return data;
  })().catch((err) => {
    refInFlight.delete(url);
    throw err;
  });
  refInFlight.set(url, p);
  return p as Promise<T>;
}

async function fetchFirstById<T extends { id: number }>(url: string, id?: number | null) {
  if (!id) return null;
  try {
    const list = await fetchRefCached<T[]>(url);
    return (list || []).find((x) => x.id === id) ?? null;
  } catch {
    return null;
  }
}

async function resolveLabelsForEdit(
  r: ManageEmpRead,
  setFormData: Dispatch<SetStateAction<any>>
) {
  const contractorId = (r as any)?.contractorID ?? (r as any)?.contractor?.id ?? null;
  const results = await Promise.allSettled([
    fetchFirstById<{ id: ID; departmentName?: string | null }>(API.departments, r.departmentNameID),
    fetchFirstById<{ id: ID; designation?: string | null }>(API.designations, r.designationID),
    fetchFirstById<{ id: ID; workShiftName?: string | null }>(API.workShifts, r.workShiftID),
    fetchFirstById<{ id: ID; attendancePolicyName?: string | null }>(API.attendancePolicies, r.attendancePolicyID),
    fetchFirstById<{ id: ID; leavePolicyName?: string | null }>(API.leavePolicies, r.leavePolicyID),
    fetchRefCached<any[]>(API.devices),
    fetchFirstById<{ id: ID; contractorName?: string | null }>(API.contractors, contractorId),
  ]);

  const get = <T,>(i: number, fallback: T | null = null): T | null =>
    results[i].status === "fulfilled" ? (results[i] as PromiseFulfilledResult<any>).value as T : fallback;

  const dept = get<{ departmentName?: string | null }>(0);
  const desg = get<{ designation?: string | null }>(1);
  const ws = get<{ workShiftName?: string | null }>(2);
  const ap = get<{ attendancePolicyName?: string | null }>(3);
  const lp = get<{ leavePolicyName?: string | null }>(4);
  const devicesList = get<any[]>(5, []) || [];
  const contractor = get<{ id: ID; contractorName?: string | null }>(6);

  setFormData((prev: any) => {
    const devMapForm = (prev.devMapForm || []).map((d: any) => {
      if (d.deviceName) return d;
      const match = devicesList.find((dv) => dv.id === Number(d.deviceID));
      return {
        ...d,
        deviceName: match?.deviceName ?? "",
        _devAutocomplete: match?.deviceName ?? "",
        deviceEmpCode: d.deviceEmpCode ?? "",
      };
    });

    return {
      ...prev,
      deptAutocomplete: dept?.departmentName ?? prev.deptAutocomplete,
      contractorID: contractor?.id ?? prev.contractorID,
      contrAutocomplete: contractor?.contractorName ?? prev.contrAutocomplete,
      desgAutocomplete: desg?.designation ?? prev.desgAutocomplete,
      wsAutocomplete: ws?.workShiftName ?? prev.wsAutocomplete,
      apAutocomplete: ap?.attendancePolicyName ?? prev.apAutocomplete,
      lpAutocomplete: lp?.leavePolicyName ?? prev.lpAutocomplete,
      devMapForm,
      // Sync multi-entry form autocompletes
      empDepartmentForm: (prev.empDepartmentForm || []).map((entry: any, i: number, arr: any[]) =>
        i === arr.length - 1 ? { ...entry, _deptAutocomplete: dept?.departmentName ?? entry._deptAutocomplete } : entry),
      // empWorkShiftForm and empAttendancePolicyForm already have correct names from backend JOIN (including factual)
    };
  });
}

const uid = () => Math.random().toString(36).slice(2, 10);

const getStoredActiveCompanyID = (): number | null => {
  if (typeof window === "undefined") return null;

  try {
    const sessionId = Number(sessionStorage.getItem("activeCompanyID") || 0);
    if (sessionId) return sessionId;

    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const localId = Number(userData?.activeCompanyID || userData?.companyID || 0);

    return localId || null;
  } catch {
    return null;
  }
};

const getUserAssignedCompanyIDs = (user: any): number[] => {
  const ids = new Set<number>();

  if (user?.companyID) ids.add(Number(user.companyID));

  if (Array.isArray(user?.userCompanies)) {
    user.userCompanies.forEach((uc: any) => {
      if (uc?.companyID) ids.add(Number(uc.companyID));
    });
  }

  return Array.from(ids);
};

function upsertHistoryEntry<T extends { _localId: string; id?: ID; effectFrom?: string }>(
  items: T[],
  newEntry: T,
  isSameEntry: (item: T) => boolean,
) {
  const existingIndex = items.findIndex((item) => isSameEntry(item) && !item.effectFrom);
  if (existingIndex === -1) return [...items, newEntry];

  const existing = items[existingIndex];
  const merged = {
    ...existing,
    ...newEntry,
    id: existing.id,
    _localId: existing._localId,
  };

  return [...items.slice(0, existingIndex), ...items.slice(existingIndex + 1), merged];
}

/* =========================
   Component
   ========================= */
export function ManageEmployeesManagement() {
  // Data
  const [rows, setRows] = useState<ManageEmpRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [terminationMap, setTerminationMap] = useState<Record<number, { daysLeft: number; lastWorkingDay: string }>>({});
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN" || user?.role === "BRANCH_ADMIN";
  const isAdmin = user?.role === "ADMIN";
  const isCompanyAdmin = user?.role === "COMPANY_ADMIN";
  const isBranchAdmin = user?.role === "BRANCH_ADMIN";
  const isSuperAdmin = user?.role === "SUPERADMIN";
  const isEmployee = user?.role === "EMPLOYEE";
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [credentialSaving, setCredentialSaving] = useState(false);
  const [credentialEmployee, setCredentialEmployee] = useState<ManageEmpRead | null>(null);
  const [credentialForm, setCredentialForm] = useState({
    username: "",
    password: "",
  });

  const copyText = async (text: string, label: string) => {
    if (!text) {
      toast.error(`${label} is empty`);
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      toast.success(`${label} copied`);
    } catch (err) {
      console.error("Copy failed:", err);
      toast.error("Copy failed. Select and copy manually.");
    }
  };

  const openCredentialModal = async (r: ManageEmpRead) => {
    try {
      const res = await fetch(`/backend/manage-emp/${r.id}/reset-password`, {
        method: "POST",
        headers: authHeaders(),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();

      setCredentialEmployee(r);
      setCredentialForm({
        username: data?.username ?? r.personalPhoneNo ?? "",
        password: data?.initialPassword ?? "",
      });
      setCredentialModalOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate credentials");
    }
  };

  const saveEmployeeCredentials = async () => {
    if (!credentialEmployee) return;

    if (!credentialForm.username.trim()) {
      toast.error("Username is required");
      return;
    }

    if (!credentialForm.password.trim()) {
      toast.error("Password is required");
      return;
    }

    try {
      setCredentialSaving(true);

      const res = await fetch(`/backend/manage-emp/${credentialEmployee.id}/credentials`, {
        method: "PATCH",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({
          username: credentialForm.username.trim(),
          password: credentialForm.password.trim(),
          isActive: true,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      toast.success("Employee credentials saved");
      setCredentialModalOpen(false);
      setCredentialEmployee(null);
      setCredentialForm({ username: "", password: "" });
      await fetchRows();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save credentials");
    } finally {
      setCredentialSaving(false);
    }
  };

  const getActiveEmployeeCompanyID = () => {
    const ctx = getSidebarContext();
    const userAny = user as any;
    const assignedCompanyIDs = getUserAssignedCompanyIDs(userAny);
    const storedActiveCompanyID = getStoredActiveCompanyID();

    if (isSuperAdmin) {
      return ctx?.companyID ? Number(ctx.companyID) : null;
    }

    if (isCompanyAdmin || isAdmin) {
      if (
        assignedCompanyIDs.length > 1 &&
        storedActiveCompanyID &&
        assignedCompanyIDs.includes(Number(storedActiveCompanyID))
      ) {
        return Number(storedActiveCompanyID);
      }

      if (
        assignedCompanyIDs.length > 1 &&
        ctx?.companyID &&
        assignedCompanyIDs.includes(Number(ctx.companyID))
      ) {
        return Number(ctx.companyID);
      }

      return Number(
        userAny?.companyID ||
        assignedCompanyIDs[0] ||
        currentUserMapping?.companyID ||
        0
      ) || null;
    }

    if (isBranchAdmin) {
      return Number(userAny?.companyID || currentUserMapping?.companyID || 0) || null;
    }

    return Number(ctx?.companyID || userAny?.companyID || currentUserMapping?.companyID || 0) || null;
  };

  // UI
  const table = useClientTable("employeeFirstName");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [designationFilter, setDesignationFilter] = useState("ALL");

  const [branchFilterList, setBranchFilterList] = useState<BR[]>([]);
  const [departmentFilterList, setDepartmentFilterList] = useState<Dept[]>([]);
  const [designationFilterList, setDesignationFilterList] = useState<Desg[]>([]);

  const [filterLoading, setFilterLoading] = useState(false);

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [activeFormSection, setActiveFormSection] = useState<EmpFormSectionId>("basic");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const toggleFormGroup = (key: string) =>
    setExpandedGroups((p) => ({ ...p, [key]: !(p[key] ?? false) }));
  const isGroupExpanded = (key: string) => expandedGroups[key] ?? false;
  const formSections = useMemo(
    () =>
      isAdmin
        ? EMPLOYEE_FORM_SECTIONS.filter(
          (s) => s.id !== "additional" && s.id !== "documents"
        )
        : EMPLOYEE_FORM_SECTIONS,
    [isAdmin],
  );

  const [isViewing, setIsViewing] = useState(false);
  const [editingRow, setEditingRow] = useState<ManageEmpRead | null>(null);
  const [viewRow, setViewRow] = useState<ManageEmpRead | null>(null);

  // Quick-add dialog states
  const [quickAddOpen, setQuickAddOpen] = useState<string | null>(null);
  const [quickAddValue, setQuickAddValue] = useState("");
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddSuggestions, setQuickAddSuggestions] = useState<any[]>([]);
  const [quickAddSearching, setQuickAddSearching] = useState(false);
  const quickAddSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // History dialog
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyEmployee, setHistoryEmployee] = useState<ManageEmpRead | null>(null);

  // Suggestion states/refs (SP/CO/BR)
  const spRef = useRef<HTMLDivElement>(null);
  const coRef = useRef<HTMLDivElement>(null);
  const brRef = useRef<HTMLDivElement>(null);

  const monthlyPGRef = useRef<HTMLDivElement>(null);
  const hourlyPGRef = useRef<HTMLDivElement>(null);

  const [spList, setSpList] = useState<SP[]>([]);
  const [coList, setCoList] = useState<CO[]>([]);
  const [brList, setBrList] = useState<BR[]>([]);
  const [monthlyPGList, setMonthlyPGList] = useState<MonthlyPG[]>([]);
  const [hourlyPGList, setHourlyPGList] = useState<HourlyPG[]>([]);

  const [spLoading, setSpLoading] = useState(false);
  const [coLoading, setCoLoading] = useState(false);
  const [brLoading, setBrLoading] = useState(false);
  const [monthlyPGLoading, setMonthlyPGLoading] = useState(false);
  const [hourlyPGLoading, setHourlyPGLoading] = useState(false);

  const spAbortRef = useRef<AbortController | null>(null);
  const coAbortRef = useRef<AbortController | null>(null);
  const brAbortRef = useRef<AbortController | null>(null);
  const monthlyPGAbortRef = useRef<AbortController | null>(null);
  const hourlyPGAbortRef = useRef<AbortController | null>(null);

  const spTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monthlyPGTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hourlyPGTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);



  // Photo upload
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [documentInputKey, setDocumentInputKey] = useState(0);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const documentCategories = [
    "Identity proof",
    "Address proof",
    "Education",
    "Past experience",
    "Offer letter",
    "Appointment letter",
    "Contract",
    "Resignation",
    "Relieving letter",
    "Payroll / Salary slip",
    "Statutory",
    "Certification",
    "Other",
  ];

  const [documentForm, setDocumentForm] = useState({
    name: "",
    category: "Identity proof",
    description: "",
    issuedDate: "",
    expiryDate: "",
    file: null as File | null,
  });

  // refs/lists/loaders for device suggestions
  const devRef = useRef<HTMLDivElement>(null);
  const [devList, setDevList] = useState<Device[]>([]);
  const [devLoading, setDevLoading] = useState(false);
  const devAbortRef = useRef<AbortController | null>(null);
  const devTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Multi-type device detection
  const [hasMultiTypeDevices, setHasMultiTypeDevices] = useState(false);
  const combinedDevRef = useRef<HTMLDivElement>(null);
  const [combinedDevList, setCombinedDevList] = useState<Device[]>([]);
  const [combinedDevLoading, setCombinedDevLoading] = useState(false);
  const combinedDevAbortRef = useRef<AbortController | null>(null);
  const combinedDevTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nested repeaters form types
  type EduForm = {
    id?: ID;
    _localId: string;
    instituteType: string;
    instituteName: string;
    degree: string;
    pasingYear: string;
    marks: string;
    gpaCgpa: string;
    class: string;
  };
  type ExpForm = {
    id?: ID;
    _localId: string;
    orgName: string;
    designation: string;
    fromDate: string;
    toDate: string;
    responsibility: string;
    skill: string;
  };
  type DevMapForm = {
    id?: ID;
    _localId: string;
    deviceID: string;
    deviceEmpCode: string;
    deviceName?: string;
    deviceType?: string;
    authType?: string;
    _devAutocomplete?: string;
  };
  type BankDetailsForm = {
    id?: ID;
    _localId: string;
    bankName: string;
    bankBranchName: string;
    accNumber: string;
    ifscCode: string;
    upi: string;
  };
  type EmpDesignationForm = {
    id?: ID;
    _localId: string;
    designationID: ID | null;
    _desgAutocomplete: string;
    effectFrom?: string;
  };
  type EmpDepartmentForm = {
    id?: ID;
    _localId: string;
    departmentNameID: ID | null;
    _deptAutocomplete: string;
    effectFrom?: string;
  };
  type EmpBranchForm = {
    id?: ID;
    _localId: string;
    branchesID: ID | null;
    _brAutocomplete: string;
    effectFrom?: string;
  };
  type EmpEmploymentTypeForm = {
    id?: ID;
    _localId: string;
    employmentType: string;
    effectFrom?: string;
  };
  type EmpEmploymentStatusForm = {
    id?: ID;
    _localId: string;
    employmentStatus: string;
    probationPeriod: string;
    effectFrom?: string;
  };
  type EmpWorkShiftForm = {
    id?: ID;
    _localId: string;
    workShiftID: ID | null;
    _wsAutocomplete: string;
    effectFrom?: string;
    _isFactual?: boolean;
  };
  type EmpLeavePolicyForm = {
    id?: ID;
    _localId: string;
    leavePolicyID: ID | null;
    _lpAutocomplete: string;
    effectFrom?: string;
  };
  type EmpAttendancePolicyForm = {
    id?: ID;
    _localId: string;
    attendancePolicyID: ID | null;
    _apAutocomplete: string;
    effectFrom?: string;
    _isFactual?: boolean;
  };
  type EmpContractorForm = {
    id?: ID;
    _localId: string;
    contractorID: ID | null;
    _contrAutocomplete: string;
    effectFrom?: string;
  };

  // Track original child IDs to compute deletions on PATCH
  const [originalEduIds, setOriginalEduIds] = useState<ID[]>([]);

  // Staging state for multi-entry search-and-add pattern
  const today = new Date().toISOString().split('T')[0];
  const defaultEffectFrom = () => formData.joiningDate?.trim() || today;
  const [stagingBranch, setStagingBranch] = useState<{ branchesID: ID | null; label: string; effectFrom: string }>({ branchesID: null, label: "", effectFrom: today });
  const [stagingDept, setStagingDept] = useState<{ departmentNameID: ID | null; label: string; effectFrom: string }>({ departmentNameID: null, label: "", effectFrom: today });
  const [stagingDesg, setStagingDesg] = useState<{ designationID: ID | null; label: string; effectFrom: string }>({ designationID: null, label: "", effectFrom: today });
  const [stagingContr, setStagingContr] = useState<{ contractorID: ID | null; label: string; effectFrom: string }>({ contractorID: null, label: "", effectFrom: today });
  const [stagingWS, setStagingWS] = useState<{ workShiftID: ID | null; label: string; effectFrom: string; _isFactual?: boolean }>({ workShiftID: null, label: "", effectFrom: today });
  const [stagingAP, setStagingAP] = useState<{ attendancePolicyID: ID | null; label: string; effectFrom: string; _isFactual?: boolean }>({ attendancePolicyID: null, label: "", effectFrom: today });
  const [stagingLP, setStagingLP] = useState<{ leavePolicyID: ID | null; label: string; effectFrom: string }>({ leavePolicyID: null, label: "", effectFrom: today });
  const [stagingET, setStagingET] = useState<{ employmentType: string; effectFrom: string }>({ employmentType: "", effectFrom: today });
  const [stagingES, setStagingES] = useState<{ employmentStatus: string; probationPeriod: string; effectFrom: string }>({ employmentStatus: "", probationPeriod: "", effectFrom: today });

  const [originalExpIds, setOriginalExpIds] = useState<ID[]>([]);
  const [originalDevMapIds, setOriginalDevMapIds] = useState<ID[]>([]);
  const [originalBankDetailIds, setOriginalBankDetailIds] = useState<ID[]>([]);
  const [originalEmpDesignationIds, setOriginalEmpDesignationIds] = useState<ID[]>([]);
  const [originalEmpBranchIds, setOriginalEmpBranchIds] = useState<ID[]>([]);
  const [originalEmpDepartmentIds, setOriginalEmpDepartmentIds] = useState<ID[]>([]);
  const [originalEmpEmploymentTypeIds, setOriginalEmpEmploymentTypeIds] = useState<ID[]>([]);
  const [originalEmpEmploymentStatusIds, setOriginalEmpEmploymentStatusIds] = useState<ID[]>([]);
  const [originalEmpWorkShiftIds, setOriginalEmpWorkShiftIds] = useState<ID[]>([]);
  const [originalEmpAttendancePolicyIds, setOriginalEmpAttendancePolicyIds] = useState<ID[]>([]);
  const [originalEmpFactualWorkShiftIds, setOriginalEmpFactualWorkShiftIds] = useState<ID[]>([]);
  const [originalEmpFactualAttendancePolicyIds, setOriginalEmpFactualAttendancePolicyIds] = useState<ID[]>([]);
  const [originalEmpLeavePolicyIds, setOriginalEmpLeavePolicyIds] = useState<ID[]>([]);
  const [originalEmpContractorIds, setOriginalEmpContractorIds] = useState<ID[]>([]);
  // For Token Device Mapping
  // For Token Device Mapping
  const [tokenDevMapForm, setTokenDevMapForm] = useState<TokenDevMapForm[]>([]);
  const [originalTokenDevMapIds, setOriginalTokenDevMapIds] = useState<ID[]>([]);
  const [tokenDevList, setTokenDevList] = useState<Device[]>([]);
  const [tokenDevLoading, setTokenDevLoading] = useState(false);
  const tokenDevAbortRef = useRef<AbortController | null>(null);
  const tokenDevTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenDevRef = useRef<HTMLDivElement>(null); // Add this line

  // For Token Verifier Device Mapping
  const [tokenVerifierDevMapForm, setTokenVerifierDevMapForm] = useState<TokenDevMapForm[]>([]);
  const [originalTokenVerifierDevMapIds, setOriginalTokenVerifierDevMapIds] = useState<ID[]>([]);
  const [tokenVerifierDevList, setTokenVerifierDevList] = useState<Device[]>([]);
  const [tokenVerifierDevLoading, setTokenVerifierDevLoading] = useState(false);
  const tokenVerifierDevAbortRef = useRef<AbortController | null>(null);
  const tokenVerifierDevTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenVerifierDevRef = useRef<HTMLDivElement>(null);

  // Linked Employees state
  const [linkedEmployees, setLinkedEmployees] = useState<{ id: ID; employeeFirstName?: string | null; employeeLastName?: string | null; employeeID?: string | null }[]>([]);
  const [linkedEmpSearch, setLinkedEmpSearch] = useState("");
  const [linkedEmpSuggestions, setLinkedEmpSuggestions] = useState<Mgr[]>([]);
  const [linkedEmpLoading, setLinkedEmpLoading] = useState(false);
  const linkedEmpRef = useRef<HTMLDivElement>(null);
  const linkedEmpAbortRef = useRef<AbortController | null>(null);
  const linkedEmpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showManagerSearch, setShowManagerSearch] = useState(false);

  const runFetchLinkedEmpSuggestions = (q: string) => {
    if (linkedEmpTimerRef.current) clearTimeout(linkedEmpTimerRef.current);
    linkedEmpTimerRef.current = setTimeout(async () => {
      if (!formData.companyID) {
        setLinkedEmpSuggestions([]);
        return;
      }
      linkedEmpAbortRef.current?.abort();
      const ctrl = new AbortController();
      linkedEmpAbortRef.current = ctrl;
      setLinkedEmpLoading(true);
      try {
        let all = await fetchRefCached<Mgr[]>(API.employees, ctrl.signal);
        all = all.filter(e => e.companyID === formData.companyID);
        // Exclude already linked employees and the current employee being edited
        const excludeIds = new Set(linkedEmployees.map(le => le.id));
        if (editingRow) excludeIds.add(editingRow.id);
        all = all.filter(e => !excludeIds.has(e.id));
        const ql = q.trim().toLowerCase();
        const filtered = ql.length >= MIN_CHARS
          ? all.filter(m => {
            const name = `${m.employeeFirstName ?? ""} ${m.employeeLastName ?? ""}`.trim().toLowerCase();
            return name.includes(ql);
          })
          : all;
        setLinkedEmpSuggestions(filtered.slice(0, 20));
      } catch (e) {
        if ((e as any)?.name !== "AbortError") console.error("Linked emp fetch error:", e);
      } finally {
        setLinkedEmpLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  const addLinkedEmployee = (emp: Mgr) => {
    if (!linkedEmployees.find(le => le.id === emp.id)) {
      setLinkedEmployees(prev => [...prev, { id: emp.id, employeeFirstName: emp.employeeFirstName, employeeLastName: emp.employeeLastName }]);
    }
    setLinkedEmpSearch("");
    setLinkedEmpSuggestions([]);
  };

  const removeLinkedEmployee = (id: ID) => {
    setLinkedEmployees(prev => prev.filter(le => le.id !== id));
  };

  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);

  useEffect(() => {
    if (user?.role !== "SERVICE_PROVIDER" && user?.role !== "BRANCH_ADMIN" && user?.role !== "ADMIN") return;

    if (user?.role === "SERVICE_PROVIDER") {
      (async () => {
        const res = await fetch("/backend/users");
        const list = await res.json();
        const me = list.find((u: any) => u.username === user.username);
        setCurrentUserMapping(me || null);
      })();
    } else if (user?.role === "BRANCH_ADMIN" || user?.role === "ADMIN") {
      // BRANCH_ADMIN / ADMIN: user object from localStorage already has full details
      setCurrentUserMapping(user);
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
      setFormData(p => ({
        ...p,
        serviceProviderID: currentUserMapping.serviceProviderID,
        companyID: currentUserMapping.companyID,
        branchesID: null,
        coAutocomplete: currentUserMapping.companyName ?? "",
        brAutocomplete: "",
      }));
    } else if (user?.role === "BRANCH_ADMIN" && currentUserMapping) {
      setFormData(p => ({
        ...p,
        serviceProviderID: currentUserMapping.serviceProviderID ?? null,
        companyID: currentUserMapping.companyID ?? null,
        branchesID: currentUserMapping.branchesID ?? null,
        coAutocomplete: currentUserMapping.company?.companyName ?? currentUserMapping.companyName ?? "",
        brAutocomplete: currentUserMapping.branches?.branchName ?? currentUserMapping.branchName ?? "",
      }));
    } else if (user?.role === "ADMIN" && currentUserMapping) {
      setFormData(p => ({
        ...p,
        serviceProviderID: currentUserMapping.serviceProviderID ?? null,
        companyID: currentUserMapping.companyID ?? null,
        branchesID: null,
        coAutocomplete: currentUserMapping.company?.companyName ?? currentUserMapping.companyName ?? "",
        brAutocomplete: "",
      }));
    }
  }, [user, currentUserMapping]);

  // Helper: filter items for MANAGER role based on available user mapping fields
  const filterForManager = (items: any[]) => {
    if (!currentUserMapping) return items;
    if (currentUserMapping.companyID && currentUserMapping.branchesID) {
      return items.filter((x: any) => x.companyID === currentUserMapping.companyID && x.branchesID === currentUserMapping.branchesID);
    }
    if (currentUserMapping.companyID) {
      return items.filter((x: any) => x.companyID === currentUserMapping.companyID);
    }
    if (currentUserMapping.serviceProviderID) {
      return items.filter((x: any) => x.serviceProviderID === currentUserMapping.serviceProviderID);
    }
    return items;
  };

  // Form State
  const [formData, setFormData] = useState({
    // foreign keys + typed names for suggestions
    serviceProviderID: null as ID | null,
    companyID: null as ID | null,
    branchesID: null as ID | null,
    contractorID: null as ID | null,
    spAutocomplete: "",
    coAutocomplete: "",
    brAutocomplete: "",

    // main scalars
    employeeFirstName: "",
    employeeLastName: "",
    deviceEmpCode: "",
    employeeID: "",
    departmentNameID: null as ID | null,
    designationID: null as ID | null,
    joiningDate: "",

    empType: "",
    pfMemberStatus: "",
    pfNumber: "",
    aadharNo: "",
    panNo: "",
    uanNo: "",
    esiNo: "",

    monthlyPGAutocomplete: "",
    hourlyPGAutocomplete: "",

    shiftEligibility: "",
    nightShiftEligibility: "",
    maxHoursPerDay: "",
    weeklyOffPattern: "",
    noticePeriodDaysForResignation: "",
    noticePeriodDaysForTermination: "",
    allowRotatingShift: false,
    allowCreateTaskOnMobile: false,
    pwaShowLeaveBalance: true,
    mobileAttendanceEnabled: false,
    mobileBreakEnabled: true,

    typeOfEmployee: "employee",



    workShiftID: null as ID | null,
    attendancePolicyID: null as ID | null,
    leavePolicyID: null as ID | null,

    businessPhoneNo: "",
    businessEmail: "",
    personalPhoneNo: "",
    personalEmail: "",
    emergancyContact: "",
    personalPhones: [""] as string[],
    personalEmails: [""] as string[],
    emergencyContacts: [""] as string[],
    uanNos: [""] as string[],
    esiNos: [""] as string[],
    businessPhones: [""] as string[],
    businessEmails: [""] as string[],
    salaryPayoutCycle: "",
    monthlyPayGradeNames: [] as string[],
    presentAddress: "",
    permenantAddress: "",
    employeePhotoUrl: "",

    gender: "",
    dateOfBirth: "",
    bloodGroup: "",
    maritalStatus: "",
    employeeFatherName: "",
    employeeMotherName: "",
    employeeSpouseName: "",
    numberOfChildren: "",

    deptAutocomplete: "",
    desgAutocomplete: "",
    contrAutocomplete: "",
    wsAutocomplete: "",
    apAutocomplete: "",
    lpAutocomplete: "",

    promotion: {
      id: undefined,
      departmentNameID: null,
      designationID: null,
      employmentType: "",
      employmentStatus: "",
      probationPeriod: "",
      workShiftID: null,
      attendancePolicyID: null,
      leavePolicyID: null,
      salaryPayGradeType: "",
      monthlyPayGradeID: null,
      hourlyPayGradeID: null,
    } as PromotionForm,

    // nested arrays
    eduForm: [] as EduForm[],
    expForm: [] as ExpForm[],
    devMapForm: [] as DevMapForm[],
    bankDetailsForm: [] as BankDetailsForm[],
    employeeDocuments: [] as EmployeeDocumentForm[],
    empDesignationForm: [] as EmpDesignationForm[],
    empDepartmentForm: [] as EmpDepartmentForm[],
    empBranchForm: [] as EmpBranchForm[],
    empEmploymentTypeForm: [] as EmpEmploymentTypeForm[],
    empEmploymentStatusForm: [] as EmpEmploymentStatusForm[],
    empWorkShiftForm: [] as EmpWorkShiftForm[],
    empLeavePolicyForm: [] as EmpLeavePolicyForm[],
    empAttendancePolicyForm: [] as EmpAttendancePolicyForm[],
    empContractorForm: [] as EmpContractorForm[],
  });

  useEffect(() => {
    const jd = formData.joiningDate?.trim();
    if (!jd) return;
    setStagingBranch((p) => ({ ...p, effectFrom: jd }));
    setStagingDept((p) => ({ ...p, effectFrom: jd }));
    setStagingDesg((p) => ({ ...p, effectFrom: jd }));
    setStagingContr((p) => ({ ...p, effectFrom: jd }));
    setStagingET((p) => ({ ...p, effectFrom: jd }));
    setStagingES((p) => ({ ...p, effectFrom: jd }));
    setStagingLP((p) => ({ ...p, effectFrom: jd }));
    setStagingAP((p) => ({ ...p, effectFrom: jd }));
    setStagingWS((p) => ({ ...p, effectFrom: jd }));
    setFormData((p) => ({
      ...p,
      empBranchForm: p.empBranchForm.map((x) => ({ ...x, effectFrom: jd })),
      empDepartmentForm: p.empDepartmentForm.map((x) => ({ ...x, effectFrom: jd })),
      empDesignationForm: p.empDesignationForm.map((x) => ({ ...x, effectFrom: jd })),
      empContractorForm: p.empContractorForm.map((x) => ({ ...x, effectFrom: jd })),
      empEmploymentTypeForm: p.empEmploymentTypeForm.map((x) => ({ ...x, effectFrom: jd })),
      empEmploymentStatusForm: p.empEmploymentStatusForm.map((x) => ({ ...x, effectFrom: jd })),
      empLeavePolicyForm: p.empLeavePolicyForm.map((x) => ({ ...x, effectFrom: jd })),
      empAttendancePolicyForm: p.empAttendancePolicyForm.map((x) => ({ ...x, effectFrom: jd })),
      empWorkShiftForm: p.empWorkShiftForm.map((x) => ({ ...x, effectFrom: jd })),
    }));
  }, [formData.joiningDate]);

  /* ===========
     Data load
     =========== */

  const fetchEmployeeFilterLists = async () => {
    try {
      setFilterLoading(true);

      const [branchesRes, departmentsRes, designationsRes] = await Promise.all([
        fetchRefCached<BR[]>(API.branches),
        fetchRefCached<Dept[]>(API.departments),
        fetchRefCached<Desg[]>(API.designations),
      ]);

      const ctx = getSidebarContext();

      const activeCompanyID =
        ctx?.companyID ??
        user?.companyID ??
        currentUserMapping?.companyID ??
        null;

      let branches = Array.isArray(branchesRes) ? branchesRes : [];
      let departments = Array.isArray(departmentsRes) ? departmentsRes : [];
      let designations = Array.isArray(designationsRes) ? designationsRes : [];

      if (activeCompanyID) {
        branches = branches.filter((b) => Number(b.companyID) === Number(activeCompanyID));
        departments = departments.filter((d) => Number(d.companyID) === Number(activeCompanyID));
        designations = designations.filter((d) => Number(d.companyID) === Number(activeCompanyID));
      }

      if (user?.role === "BRANCH_ADMIN") {
        const branchID = currentUserMapping?.branchesID ?? user?.branchesID;

        if (branchID) {
          branches = branches.filter((b) => Number(b.id) === Number(branchID));
          departments = departments.filter((d) => Number(d.branchesID) === Number(branchID));
          designations = designations.filter((d) => Number(d.branchesID) === Number(branchID));

          setBranchFilter(String(branchID));
        }
      }

      setBranchFilterList(branches);
      setDepartmentFilterList(departments);
      setDesignationFilterList(designations);
    } catch (e) {
      console.error("Failed to load employee filter lists:", e);
      setBranchFilterList([]);
      setDepartmentFilterList([]);
      setDesignationFilterList([]);
    } finally {
      setFilterLoading(false);
    }
  };

  const fetchRows = async () => {
    try {
      setLoading(true);
      const all = await fetchJSONSafe<ManageEmpRead[]>(API.manageEmpList);

      // Fetch active terminations to show offboarding countdown
      try {
        const termRes = await fetch("/backend/termination");
        const termData = await termRes.json();
        const terminations: any[] = Array.isArray(termData) ? termData : termData?.data ?? [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const newTermMap: Record<number, { daysLeft: number; lastWorkingDay: string }> = {};
        terminations.forEach((t: any) => {
          if (t.exitStatus === "APPROVED" && t.lastWorkingDay && t.employeeId) {
            const lwd = new Date(t.lastWorkingDay);
            lwd.setHours(0, 0, 0, 0);
            const daysLeft = Math.ceil((lwd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            // Include all approved terminations: daysLeft > 0 means countdown, <= 0 means inactive now
            newTermMap[t.employeeId] = { daysLeft, lastWorkingDay: lwd.toLocaleDateString() };
          }
        });
        setTerminationMap(newTermMap);
      } catch {
        // Non-critical, swallow error
      }

      // Device mappings are already included in the /manage-emp payload
      // (empDeviceMapping / tokenDeviceMapping). The previous code fired 2 extra
      // HTTP requests per employee to endpoints that don't exist, which made the
      // list extremely slow and overwrote the real mapping data with empty arrays.
      const enrichedEmployees = all.map((emp: any) => ({
        ...emp,
        empDeviceMapping: emp.empDeviceMapping ?? [],
        tokenDeviceMapping: emp.tokenDeviceMapping ?? [],
      }));

      let filteredRows = enrichedEmployees;

      // SUPERADMIN → filter by sidebar context
      if (user?.role === "SUPERADMIN") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          filteredRows = enrichedEmployees.filter((r: any) => Number(r.companyID) === Number(ctx.companyID));
        } else {
          filteredRows = enrichedEmployees;
        }
      }
      // MANAGER → filter by serviceProviderID
      else if (user?.role === "SERVICE_PROVIDER") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          filteredRows = enrichedEmployees.filter(
            (r: any) => r.companyID === ctx.companyID
          );
        } else {
          const usersRes = await fetch("/backend/users");
          const users = await usersRes.json();
          const currentUser = users.find((u: any) => u.username === user.username);
          if (currentUser) {
            filteredRows = enrichedEmployees.filter(
              (r: any) => r.serviceProviderID === currentUser.serviceProviderID
            );
          }
        }
      }
      // COMPANY_ADMIN / ADMIN → filter by companyID
      // COMPANY_ADMIN / ADMIN → filter by active selected company
      else if (user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN") {
        const activeCompanyID = getActiveEmployeeCompanyID();

        if (activeCompanyID) {
          filteredRows = enrichedEmployees.filter(
            (r: any) => Number(r.companyID) === Number(activeCompanyID)
          );
        } else {
          filteredRows = [];
        }
      }

      // BRANCH_ADMIN → filter by companyID + branchesID
      else if (user?.role === "BRANCH_ADMIN") {
        const usersRes = await fetch("/backend/users");
        const users = await usersRes.json();
        const currentUser = users.find((u: any) => u.username === user.username);
        if (currentUser) {
          filteredRows = enrichedEmployees.filter(
            (r: any) => r.companyID === currentUser.companyID && r.branchesID === currentUser.branchesID
          );
        }
      }
      // Desktop manager → company-wide like COMPANY_ADMIN
      else if (isDesktopManagerEmployee(user)) {
        const companyId = resolveScopedCompanyId(user);
        if (companyId) {
          filteredRows = enrichedEmployees.filter(
            (r: any) => r.companyID === companyId
          );
        } else {
          filteredRows = [];
        }
      }
      // EMPLOYEE → match via manage-emp/credentials/all
      else if (user?.role === "EMPLOYEE") {
        const credsRes = await fetch("/backend/manage-emp/credentials/all");
        const creds = await credsRes.json();
        const emp = creds.find((c: any) => c.username === user?.username);
        if (emp) {
          filteredRows = enrichedEmployees.filter(
            (r: any) =>
              r.companyID === emp.companyID &&
              r.branchesID === emp.branchesID
          );
        } else {
          filteredRows = [];
        }
      }

      setRows(filteredRows);
    } catch (e) {
      console.error("Failed to load employees:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => registerDataCacheClearer(() => clearRefCache()), []);

  useEffect(() => {
    if (user) {
      fetchRows();
      fetchEmployeeFilterLists();
    }
  }, [user]);

  useEffect(() => {
    const handler = () => {
      if (user) {
        fetchRows();
        fetchEmployeeFilterLists();
      }
    };

    const sidebarPageClickHandler = (e: any) => {
      if (e.detail?.path === "/manage-employees") {
        closeEmployeePagePanels();

        if (user) {
          fetchRows();
          fetchEmployeeFilterLists();
        }
      }
    };

    window.addEventListener("sidebar-context-changed", handler);
    window.addEventListener("app-data-refresh", handler);
    window.addEventListener("sidebar-main-page-click", sidebarPageClickHandler);

    return () => {
      window.removeEventListener("sidebar-context-changed", handler);
      window.removeEventListener("app-data-refresh", handler);
      window.removeEventListener("sidebar-main-page-click", sidebarPageClickHandler);
    };
  }, [user]);


  const addTokenDevMap = () => setTokenDevMapForm(p => [...p, {
    _localId: uid(),
    deviceID: "",
    deviceEmpCode: "",
    deviceName: "",
    deviceType: "TR",
    _devAutocomplete: "",
  }]);

  const removeTokenDevMap = (lid: string) => setTokenDevMapForm(p => p.filter(x => x._localId !== lid));

  const updateTokenDevMap = (lid: string, key: keyof TokenDevMapForm, val: string) =>
    setTokenDevMapForm(p => p.map(x => x._localId === lid ? { ...x, [key]: val } : x));

  const runFetchTokenDevices = (q: string) => {
    if (tokenDevTimerRef.current) clearTimeout(tokenDevTimerRef.current);
    tokenDevTimerRef.current = setTimeout(async () => {
      if (q.length < MIN_CHARS) {
        setTokenDevList([]);
        return;
      }
      tokenDevAbortRef.current?.abort();
      const ctrl = new AbortController();
      tokenDevAbortRef.current = ctrl;
      setTokenDevLoading(true);
      try {
        let all = await fetchRefCached<Device[]>(API.devices, ctrl.signal);
        if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
          all = filterForManager(all);
        } else if (formData.companyID) {
          all = all.filter(x => x.companyID === formData.companyID);
        }
        // Filter for TR and AT+TR devices (token register capable)
        const tokenDevices = all.filter(d => d.deviceType === 'TR' || (d.deviceType && d.deviceType.includes('AT') && d.deviceType.includes('TR')));

        const filtered = tokenDevices.filter(d =>
          (d.deviceName ?? "").toLowerCase().includes(q.toLowerCase())
        );
        setTokenDevList(filtered.slice(0, 20));
      } catch (e) {
        if ((e as any).name !== "AbortError") console.error("Token device fetch error:", e);
      } finally {
        setTokenDevLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  // Token Verifier helpers
  const addTokenVerifierDevMap = () => setTokenVerifierDevMapForm(p => [...p, {
    _localId: uid(),
    deviceID: "",
    deviceEmpCode: "",
    deviceName: "",
    deviceType: "TV",
    _devAutocomplete: "",
  }]);

  const removeTokenVerifierDevMap = (lid: string) => setTokenVerifierDevMapForm(p => p.filter(x => x._localId !== lid));

  const updateTokenVerifierDevMap = (lid: string, key: keyof TokenDevMapForm, val: string) =>
    setTokenVerifierDevMapForm(p => p.map(x => x._localId === lid ? { ...x, [key]: val } : x));

  const runFetchTokenVerifierDevices = (q: string) => {
    if (tokenVerifierDevTimerRef.current) clearTimeout(tokenVerifierDevTimerRef.current);
    tokenVerifierDevTimerRef.current = setTimeout(async () => {
      if (q.length < MIN_CHARS) {
        setTokenVerifierDevList([]);
        return;
      }
      tokenVerifierDevAbortRef.current?.abort();
      const ctrl = new AbortController();
      tokenVerifierDevAbortRef.current = ctrl;
      setTokenVerifierDevLoading(true);
      try {
        let all = await fetchRefCached<Device[]>(API.devices, ctrl.signal);
        if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
          all = filterForManager(all);
        } else if (formData.companyID) {
          all = all.filter(x => x.companyID === formData.companyID);
        }
        // Filter for TV devices only
        const tvDevices = all.filter(d => d.deviceType === 'TV');

        const filtered = tvDevices.filter(d =>
          (d.deviceName ?? "").toLowerCase().includes(q.toLowerCase())
        );
        setTokenVerifierDevList(filtered.slice(0, 20));
      } catch (e) {
        if ((e as any).name !== "AbortError") console.error("Token verifier device fetch error:", e);
      } finally {
        setTokenVerifierDevLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  // Check for multi-type devices when form opens
  useEffect(() => {
    if (!isAddingNew) return;
    (async () => {
      try {
        let all = await fetchRefCached<Device[]>(API.devices);
        if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
          all = filterForManager(all);
        } else if (formData.companyID) {
          all = all.filter(x => x.companyID === formData.companyID);
        }
        const hasMulti = all.some(d => d.deviceType && d.deviceType.includes('+'));
        setHasMultiTypeDevices(hasMulti);
      } catch {
        setHasMultiTypeDevices(false);
      }
    })();
  }, [isAddingNew]);

  // Fetch combined (multi-type) devices
  const runFetchCombinedDev = (q: string) => {
    if (combinedDevTimerRef.current) clearTimeout(combinedDevTimerRef.current);
    combinedDevTimerRef.current = setTimeout(async () => {
      if (q.length < MIN_CHARS) {
        setCombinedDevList([]);
        return;
      }
      combinedDevAbortRef.current?.abort();
      const ctrl = new AbortController();
      combinedDevAbortRef.current = ctrl;
      setCombinedDevLoading(true);
      try {
        let all = await fetchRefCached<Device[]>(API.devices, ctrl.signal);
        if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
          all = filterForManager(all);
        } else if (formData.companyID) {
          all = all.filter(x => x.companyID === formData.companyID);
        }
        // Filter for multi-type devices (devices that have '+' in deviceType)
        const multiTypeDevices = all.filter(d => d.deviceType && d.deviceType.includes('+'));
        const filtered = multiTypeDevices.filter(d =>
          (d.deviceName ?? "").toLowerCase().includes(q.toLowerCase())
        );
        setCombinedDevList(filtered.slice(0, 20));
      } catch (e) {
        if ((e as any).name !== "AbortError") console.error("Combined device fetch error:", e);
      } finally {
        setCombinedDevLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  /* =======================
     Debounced suggestions
     ======================= */
  const runFetchSP = (query: string) => {
    if (spTimerRef.current) clearTimeout(spTimerRef.current);
    spTimerRef.current = setTimeout(async () => {
      if (query.length < MIN_CHARS) { setSpList([]); return; }
      if (spAbortRef.current) spAbortRef.current.abort();
      const ctrl = new AbortController();
      spAbortRef.current = ctrl;
      setSpLoading(true);
      try {
        const all = await fetchRefCached<SP[]>(API.serviceProviders, ctrl.signal);
        const filtered = (all || []).filter(s => (s.companyName ?? "").toLowerCase().includes(query.toLowerCase()));
        setSpList(filtered.slice(0, 20));
      } catch (e) {
        if ((e as any).name !== "AbortError") console.error("SP fetch error:", e);
      } finally { setSpLoading(false); }
    }, DEBOUNCE_MS);
  };

  const runFetchMonthlyPG = (q: string) => {
    if (monthlyPGTimerRef.current) clearTimeout(monthlyPGTimerRef.current);
    monthlyPGTimerRef.current = setTimeout(async () => {
      if (q.length < MIN_CHARS) { setMonthlyPGList([]); return; }
      monthlyPGAbortRef.current?.abort();
      const ctrl = new AbortController(); monthlyPGAbortRef.current = ctrl;
      setMonthlyPGLoading(true);
      try {
        let all = await fetchRefCached<MonthlyPG[]>(API.monthlyGrades, ctrl.signal);
        if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
          all = filterForManager(all);
        } else if (formData.companyID) {
          all = all.filter(x => x.companyID === formData.companyID);
        }
        const filtered = (all || []).filter(x =>
          (x.monthlyPayGradeName ?? "").toLowerCase().includes(q.toLowerCase())
        );
        setMonthlyPGList(filtered.slice(0, 20));
      } finally { setMonthlyPGLoading(false); }
    }, DEBOUNCE_MS);
  };

  const runFetchDept = (q: string) => {
    if (deptTimerRef.current) clearTimeout(deptTimerRef.current);

    deptTimerRef.current = setTimeout(async () => {
      if (q.length < MIN_CHARS) {
        setDeptList([]);
        return;
      }

      if (deptAbortRef.current) {
        deptAbortRef.current.abort();
      }

      const ctrl = new AbortController();
      deptAbortRef.current = ctrl;

      setDeptLoading(true);

      try {
        let all = await fetchRefCached<Dept[]>(API.departments, ctrl.signal);

        if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
          all = filterForManager(all);
        } else if (formData.companyID) {
          all = all.filter(x => x.companyID === formData.companyID);
        }

        const filtered = all.filter(d =>
          (d.departmentName ?? "").toLowerCase().includes(q.toLowerCase())
        );

        setDeptList(filtered.slice(0, 20));

      } catch (e: any) {
        if (e.name !== "AbortError") {
          console.error("Dept fetch error:", e);
        }
      } finally {
        setDeptLoading(false);
      }

    }, DEBOUNCE_MS);
  };

  const getActiveDepartmentId = (): ID | null => {
    if (stagingDept.departmentNameID) return stagingDept.departmentNameID;
    const latest = formData.empDepartmentForm[formData.empDepartmentForm.length - 1];
    return latest?.departmentNameID ?? formData.departmentNameID ?? null;
  };

  const runFetchDesg = (q: string) => {
    if (desgTimerRef.current) clearTimeout(desgTimerRef.current);
    desgTimerRef.current = setTimeout(async () => {
      if (q.length < MIN_CHARS) { setDesgList([]); return; }
      desgAbortRef.current?.abort();
      const ctrl = new AbortController(); desgAbortRef.current = ctrl;
      setDesgLoading(true);
      try {
        let all = await fetchRefCached<Desg[]>(API.designations, ctrl.signal);
        if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
          all = filterForManager(all);
        } else if (formData.companyID) {
          all = all.filter(x => x.companyID === formData.companyID);
        }
        const activeDeptId = getActiveDepartmentId();
        if (activeDeptId) {
          all = all.filter(x => x.departmentID === activeDeptId);
        }
        const filtered = (all || []).filter(d => (d.designation ?? "").toLowerCase().includes(q.toLowerCase()));
        setDesgList(filtered.slice(0, 20));
      } finally { setDesgLoading(false); }
    }, DEBOUNCE_MS);
  };

  const runFetchContr = (q: string) => {
    if (contrTimerRef.current) clearTimeout(contrTimerRef.current);
    contrTimerRef.current = setTimeout(async () => {
      if (q.length < MIN_CHARS) { setContrList([]); return; }
      contrAbortRef.current?.abort();
      const ctrl = new AbortController(); contrAbortRef.current = ctrl;
      setContrLoading(true);
      try {
        let all = await fetchRefCached<Contr[]>(API.contractors, ctrl.signal);
        if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
          all = filterForManager(all);
        } else if (formData.companyID) {
          all = all.filter(x => x.companyID === formData.companyID);
        }
        const filtered = (all || []).filter(c => (c.contractorName ?? "").toLowerCase().includes(q.toLowerCase()));
        setContrList(filtered.slice(0, 20));
      } finally { setContrLoading(false); }
    }, DEBOUNCE_MS);
  };

  const runFetchDev = (q: string) => {
    if (devTimerRef.current) clearTimeout(devTimerRef.current);

    devTimerRef.current = setTimeout(async () => {
      if (q.length < MIN_CHARS) {
        setDevList([]);
        return;
      }

      devAbortRef.current?.abort();
      const ctrl = new AbortController();
      devAbortRef.current = ctrl;
      setDevLoading(true);

      try {
        let all = await fetchRefCached<Device[]>(API.devices, ctrl.signal);

        if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
          all = filterForManager(all);
        } else if (formData.companyID) {
          all = all.filter(x => x.companyID === formData.companyID);
        }

        // Filter for AT and AT+TR devices (attendance capable)
        const atDevices = all.filter(d => d.deviceType === 'AT' || (d.deviceType && d.deviceType.includes('AT')));

        const filtered = atDevices.filter(d =>
          (d.deviceName ?? "").toLowerCase().includes(q.toLowerCase())
        );

        setDevList(filtered.slice(0, 20));

      } catch (e) {
        if ((e as any).name !== "AbortError")
          console.error("Device fetch error:", e);
      } finally {
        setDevLoading(false);
      }
    }, DEBOUNCE_MS);
  };


  const runFetchWS = (q: string) => {
    if (wsTimerRef.current) clearTimeout(wsTimerRef.current);
    wsTimerRef.current = setTimeout(async () => {
      if (q.length < MIN_CHARS) { setWsList([]); return; }
      wsAbortRef.current?.abort();
      const ctrl = new AbortController(); wsAbortRef.current = ctrl;
      setWsLoading(true);
      try {
        const [regular, factual] = await Promise.all([
          fetchRefCached<WS[]>(API.workShifts, ctrl.signal),
          fetchRefCached<WS[]>(API.factualWorkShifts, ctrl.signal),
        ]);
        const factualTagged = (factual || []).map(w => ({ ...w, _isFactual: true as const }));
        let all = [...(regular || []), ...factualTagged];
        if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
          all = filterForManager(all);
        } else if (formData.companyID) {
          all = all.filter(x => x.companyID === formData.companyID);
        }
        const filtered = (all || []).filter(w => (w.workShiftName ?? "").toLowerCase().includes(q.toLowerCase()));
        setWsList(filtered.slice(0, 20));
      } finally { setWsLoading(false); }
    }, DEBOUNCE_MS);
  };

  const runFetchAP = (q: string) => {
    if (apTimerRef.current) clearTimeout(apTimerRef.current);
    apTimerRef.current = setTimeout(async () => {
      if (q.length < MIN_CHARS) { setApList([]); return; }
      apAbortRef.current?.abort();
      const ctrl = new AbortController(); apAbortRef.current = ctrl;
      setApLoading(true);
      try {
        const [regular, factual] = await Promise.all([
          fetchRefCached<AP[]>(API.attendancePolicies, ctrl.signal),
          fetchRefCached<AP[]>(API.factualAttendancePolicies, ctrl.signal),
        ]);
        const factualTagged = (factual || []).map(a => ({ ...a, _isFactual: true as const }));
        let all = [...(regular || []), ...factualTagged];
        if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
          all = filterForManager(all);
        } else if (formData.companyID) {
          all = all.filter(x => x.companyID === formData.companyID);
        }
        const filtered = (all || []).filter(a => (a.attendancePolicyName ?? "").toLowerCase().includes(q.toLowerCase()));
        setApList(filtered.slice(0, 20));
      } finally { setApLoading(false); }
    }, DEBOUNCE_MS);
  };

  const runFetchLP = (q: string) => {
    if (lpTimerRef.current) clearTimeout(lpTimerRef.current);
    lpTimerRef.current = setTimeout(async () => {
      if (q.length < MIN_CHARS) { setLpList([]); return; }
      lpAbortRef.current?.abort();
      const ctrl = new AbortController(); lpAbortRef.current = ctrl;
      setLpLoading(true);
      try {
        let all = await fetchRefCached<LP[]>(API.leavePolicies, ctrl.signal);
        const ctx = getSidebarContext();
        const companyId = formData.companyID ?? ctx?.companyID ?? user?.companyID;
        const branchId = formData.branchesID ?? user?.branchesID;
        if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
          all = filterForManager(all);
        } else if (companyId) {
          all = all.filter((x) => x.companyID === companyId);
        }
        if (branchId) {
          all = all.filter((x) => !x.branchesID || x.branchesID === branchId);
        }
        const filtered = (all || []).filter(l => (l.leavePolicyName ?? "").toLowerCase().includes(q.toLowerCase()));
        setLpList(filtered.slice(0, 20));
      } finally { setLpLoading(false); }
    }, DEBOUNCE_MS);
  };

  const runFetchCO = (query: string) => {
    if (coTimerRef.current) clearTimeout(coTimerRef.current);

    coTimerRef.current = setTimeout(async () => {
      if (!formData.serviceProviderID || query.length < MIN_CHARS) {
        setCoList([]);
        return;
      }

      if (coAbortRef.current) coAbortRef.current.abort();
      const ctrl = new AbortController();
      coAbortRef.current = ctrl;
      setCoLoading(true);

      try {
        let all = await fetchRefCached<CO[]>(API.companies, ctrl.signal);

        all = (all || []).filter(
          c => c.serviceProviderID === formData.serviceProviderID
        );

        const ql = query.toLowerCase();
        const filtered = all.filter(c =>
          (c.companyName ?? "").toLowerCase().includes(ql)
        );

        setCoList(filtered.slice(0, 20));
      } catch (e) {
        if ((e as any).name !== "AbortError") {
          console.error("CO fetch error:", e);
        }
      } finally {
        setCoLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  const runFetchBR = (query: string) => {
    if (brTimerRef.current) clearTimeout(brTimerRef.current);

    brTimerRef.current = setTimeout(async () => {
      const companyID =
        user?.role === "SERVICE_PROVIDER"
          ? currentUserMapping?.companyID
          : formData.companyID;

      if (!companyID || query.length < MIN_CHARS) {
        setBrList([]);
        return;
      }

      brAbortRef.current?.abort();
      const ctrl = new AbortController();
      brAbortRef.current = ctrl;
      setBrLoading(true);

      try {
        let all = await fetchRefCached<BR[]>(API.branches, ctrl.signal);

        all = all.filter(b => b.companyID === companyID);
        // 🔒 BRANCH_ADMIN — restrict to their own branch only
        if (user?.role === "BRANCH_ADMIN" && user?.branchesID) {
          all = all.filter(b => Number(b.id) === Number(user.branchesID));
        }

        const ql = query.toLowerCase();
        const filtered = all.filter(b =>
          (b.branchName ?? "").toLowerCase().includes(ql)
        );

        setBrList(filtered.slice(0, 20));
      } catch (e) {
        if ((e as any).name !== "AbortError") {
          console.error("BR fetch error:", e);
        }
      } finally {
        setBrLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  interface Dept { id: ID; departmentName?: string | null; companyID?: ID | null; branchesID?: ID | null; }
  interface Desg { id: ID; designation?: string | null; companyID?: ID | null; branchesID?: ID | null; departmentID?: ID | null; }
  interface Contr { id: ID; contractorName?: string | null; companyID?: ID | null; branchesID?: ID | null; }
  interface Mgr { id: ID; employeeFirstName?: string | null; employeeLastName?: string | null; companyID?: ID | null; branchesID?: ID | null; }
  interface WS { id: ID; workShiftName?: string | null; companyID?: ID | null; branchesID?: ID | null; isRotating?: boolean | null; isFlexible?: boolean | null; _isFactual?: boolean; }
  interface AP { id: ID; attendancePolicyName?: string | null; companyID?: ID | null; branchesID?: ID | null; _isFactual?: boolean; }
  interface LP { id: ID; leavePolicyName?: string | null; companyID?: ID | null; branchesID?: ID | null; }

  // refs for outside-click close
  const deptRef = useRef<HTMLDivElement>(null);
  const desgRef = useRef<HTMLDivElement>(null);
  const contrRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<HTMLDivElement>(null);
  const apRef = useRef<HTMLDivElement>(null);
  const lpRef = useRef<HTMLDivElement>(null);

  // data lists
  const [deptList, setDeptList] = useState<Dept[]>([]);
  const [desgList, setDesgList] = useState<Desg[]>([]);
  const [contrList, setContrList] = useState<Contr[]>([]);
  const [wsList, setWsList] = useState<WS[]>([]);
  const [apList, setApList] = useState<AP[]>([]);
  const [lpList, setLpList] = useState<LP[]>([]);

  // loaders
  const [deptLoading, setDeptLoading] = useState(false);
  const [desgLoading, setDesgLoading] = useState(false);
  const [activeDesgLocalId, setActiveDesgLocalId] = useState<string | null>(null);
  const [activeDeptLocalId, setActiveDeptLocalId] = useState<string | null>(null);
  const [activeBrLocalId, setActiveBrLocalId] = useState<string | null>(null);
  const [activeWsLocalId, setActiveWsLocalId] = useState<string | null>(null);
  const [activeApLocalId, setActiveApLocalId] = useState<string | null>(null);
  const [activeLpLocalId, setActiveLpLocalId] = useState<string | null>(null);
  const [activeContrLocalId, setActiveContrLocalId] = useState<string | null>(null);
  const [contrLoading, setContrLoading] = useState(false);
  const [wsLoading, setWsLoading] = useState(false);
  const [apLoading, setApLoading] = useState(false);
  const [lpLoading, setLpLoading] = useState(false);

  // abort controllers
  const deptAbortRef = useRef<AbortController | null>(null);
  const desgAbortRef = useRef<AbortController | null>(null);
  const contrAbortRef = useRef<AbortController | null>(null);
  const wsAbortRef = useRef<AbortController | null>(null);
  const apAbortRef = useRef<AbortController | null>(null);
  const lpAbortRef = useRef<AbortController | null>(null);

  // timers for debounce
  const deptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close suggestion popovers on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (spRef.current && !spRef.current.contains(e.target as any)) setSpList([]);
      if (coRef.current && !coRef.current.contains(e.target as any)) setCoList([]);
      if (brRef.current && !brRef.current.contains(e.target as any)) setBrList([]);
      if (deptRef.current && !deptRef.current.contains(e.target as any)) setDeptList([]);
      if (desgRef.current && !desgRef.current.contains(e.target as any)) setDesgList([]);
      if (contrRef.current && !contrRef.current.contains(e.target as any)) setContrList([]);
      if (wsRef.current && !wsRef.current.contains(e.target as any)) setWsList([]);
      if (apRef.current && !apRef.current.contains(e.target as any)) setApList([]);
      if (lpRef.current && !lpRef.current.contains(e.target as any)) setLpList([]);
      if (devRef.current && !devRef.current.contains(e.target as any)) setDevList([]);
      if (tokenDevRef.current && !tokenDevRef.current.contains(e.target as any)) setTokenDevList([]);
      if (linkedEmpRef.current && !linkedEmpRef.current.contains(e.target as any)) setLinkedEmpSuggestions([]);
      if (monthlyPGRef.current && !monthlyPGRef.current.contains(e.target as any)) setMonthlyPGList([]);
      if (hourlyPGRef.current && !hourlyPGRef.current.contains(e.target as any)) setHourlyPGList([]);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Cleanup timers/aborts on unmount
  useEffect(() => {
    return () => {
      if (spTimerRef.current) clearTimeout(spTimerRef.current);
      if (coTimerRef.current) clearTimeout(coTimerRef.current);
      if (brTimerRef.current) clearTimeout(brTimerRef.current);
      if (deptTimerRef.current) clearTimeout(deptTimerRef.current);
      if (desgTimerRef.current) clearTimeout(desgTimerRef.current);
      if (contrTimerRef.current) clearTimeout(contrTimerRef.current);
      if (wsTimerRef.current) clearTimeout(wsTimerRef.current);
      if (apTimerRef.current) clearTimeout(apTimerRef.current);
      if (lpTimerRef.current) clearTimeout(lpTimerRef.current);
      if (devTimerRef.current) clearTimeout(devTimerRef.current);
      if (tokenDevTimerRef.current) clearTimeout(tokenDevTimerRef.current);

      spAbortRef.current?.abort();
      coAbortRef.current?.abort();
      brAbortRef.current?.abort();
      deptAbortRef.current?.abort();
      desgAbortRef.current?.abort();
      contrAbortRef.current?.abort();
      wsAbortRef.current?.abort();
      apAbortRef.current?.abort();
      lpAbortRef.current?.abort();
      devAbortRef.current?.abort();
      tokenDevAbortRef.current?.abort();
    };
  }, []);

  /* ===============
     Photo upload
     =============== */
  const onPickPhoto = (file: File | null) => {
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const uploadPhotoIfNeeded = async (): Promise<string | undefined> => {
    if (!photoFile) return undefined;
    const fd = new FormData();
    fd.append("file", photoFile);
    const res = await fetch(API.upload, { method: "POST", headers: authHeaders(), body: fd });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const full = data?.url?.startsWith("http") ? data.url : `/backend${data?.url ?? ""}`;
    return full;
  };

  /* ==================
     Nested repeaters
     ================== */
  const addEdu = () => setFormData(p => ({
    ...p,
    eduForm: [...p.eduForm, {
      _localId: uid(),
      instituteType: "", instituteName: "", degree: "", pasingYear: "", marks: "", gpaCgpa: "", class: "",
    }]
  }));
  const addExp = () => setFormData(p => ({
    ...p,
    expForm: [...p.expForm, {
      _localId: uid(),
      orgName: "", designation: "", fromDate: "", toDate: "", responsibility: "", skill: "",
    }]
  }));
  const addDevMap = () => setFormData(p => ({
    ...p,
    devMapForm: [...p.devMapForm, {
      _localId: uid(),
      deviceID: "",
      deviceEmpCode: "",
      deviceName: "",
      deviceType: "AT", // Set default type
      _devAutocomplete: "",
    }]
  }));

  // Add combined device mapping (for multi-type devices like AT+TR)
  const addCombinedDevMap = () => {
    const localId = uid();
    setFormData(p => ({
      ...p,
      devMapForm: [...p.devMapForm, {
        _localId: localId,
        deviceID: "",
        deviceEmpCode: "",
        deviceName: "",
        deviceType: "", // Will be set when device is selected
        _devAutocomplete: "",
      }]
    }));
  };
  const addBankDetail = () => setFormData(p => ({
    ...p,
    bankDetailsForm: [...p.bankDetailsForm, {
      _localId: uid(),
      bankName: "", bankBranchName: "", accNumber: "", ifscCode: "", upi: "",
    }]
  }));
  const addEmpDesignation = () => setFormData(p => ({
    ...p,
    empDesignationForm: [...p.empDesignationForm, {
      _localId: uid(),
      designationID: null,
      _desgAutocomplete: "",
      effectFrom: today,
    }]
  }));

  const removeEdu = (lid: string) => setFormData(p => ({ ...p, eduForm: p.eduForm.filter(x => x._localId !== lid) }));
  const removeExp = (lid: string) => setFormData(p => ({ ...p, expForm: p.expForm.filter(x => x._localId !== lid) }));
  const removeDevMap = (lid: string) => setFormData(p => ({ ...p, devMapForm: p.devMapForm.filter(x => x._localId !== lid) }));
  const removeBankDetail = (lid: string) => setFormData(p => ({ ...p, bankDetailsForm: p.bankDetailsForm.filter(x => x._localId !== lid) }));
  const removeEmpDesignation = (lid: string) => setFormData(p => ({ ...p, empDesignationForm: p.empDesignationForm.filter(x => x._localId !== lid) }));

  const updateEdu = (lid: string, key: keyof EduForm, val: string) =>
    setFormData(p => ({ ...p, eduForm: p.eduForm.map(x => x._localId === lid ? { ...x, [key]: val } : x) }));
  const updateExp = (lid: string, key: keyof ExpForm, val: string) =>
    setFormData(p => ({ ...p, expForm: p.expForm.map(x => x._localId === lid ? { ...x, [key]: val } : x) }));
  const updateDevMap = (lid: string, key: keyof DevMapForm, val: string) =>
    setFormData(p => ({ ...p, devMapForm: p.devMapForm.map(x => x._localId === lid ? { ...x, [key]: val } : x) }));
  const updateBankDetail = (lid: string, key: keyof BankDetailsForm, val: string) =>
    setFormData(p => ({ ...p, bankDetailsForm: p.bankDetailsForm.map(x => x._localId === lid ? { ...x, [key]: val } : x) }));
  const updateEmpDesignation = (lid: string, patch: Partial<EmpDesignationForm>) =>
    setFormData(p => ({ ...p, empDesignationForm: p.empDesignationForm.map(x => x._localId === lid ? { ...x, ...patch } : x) }));

  // Department multi-entry helpers
  const addEmpDepartment = () => setFormData(p => ({ ...p, empDepartmentForm: [...p.empDepartmentForm, { _localId: uid(), departmentNameID: null, _deptAutocomplete: "", effectFrom: today }] }));
  const removeEmpDepartment = (lid: string) => setFormData(p => {
    const updated = p.empDepartmentForm.filter(x => x._localId !== lid);
    const last = updated[updated.length - 1];
    return { ...p, empDepartmentForm: updated, departmentNameID: last?.departmentNameID ?? null, deptAutocomplete: last?._deptAutocomplete ?? "", promotion: { ...p.promotion, departmentNameID: last?.departmentNameID ?? null } };
  });
  const updateEmpDepartment = (lid: string, patch: Partial<EmpDepartmentForm>) => setFormData(p => {
    const updated = p.empDepartmentForm.map(x => x._localId === lid ? { ...x, ...patch } : x);
    const last = updated[updated.length - 1];
    return { ...p, empDepartmentForm: updated, departmentNameID: last?.departmentNameID ?? null, deptAutocomplete: last?._deptAutocomplete ?? "", promotion: { ...p.promotion, departmentNameID: last?.departmentNameID ?? null } };
  });

  // Branch multi-entry helpers
  const addEmpBranch = () => setFormData(p => ({ ...p, empBranchForm: [...p.empBranchForm, { _localId: uid(), branchesID: null, _brAutocomplete: "", effectFrom: today }] }));
  const removeEmpBranch = (lid: string) => setFormData(p => {
    const updated = p.empBranchForm.filter(x => x._localId !== lid);
    const last = updated[updated.length - 1];
    return { ...p, empBranchForm: updated, branchesID: last?.branchesID ?? null, brAutocomplete: last?._brAutocomplete ?? "" };
  });
  const updateEmpBranch = (lid: string, patch: Partial<EmpBranchForm>) => setFormData(p => {
    const updated = p.empBranchForm.map(x => x._localId === lid ? { ...x, ...patch } : x);
    const last = updated[updated.length - 1];
    return { ...p, empBranchForm: updated, branchesID: last?.branchesID ?? null, brAutocomplete: last?._brAutocomplete ?? "" };
  });

  // Employment Type multi-entry helpers (staging pattern)
  const addEmpEmploymentType = () => {
    if (!stagingET.employmentType) return;
    const newEntry: EmpEmploymentTypeForm = { _localId: uid(), employmentType: stagingET.employmentType, effectFrom: stagingET.effectFrom };
    setFormData(p => {
      const updated = upsertHistoryEntry(p.empEmploymentTypeForm, newEntry, (item) => item.employmentType === newEntry.employmentType);
      const last = updated[updated.length - 1];
      return { ...p, empEmploymentTypeForm: updated, promotion: { ...p.promotion, employmentType: last?.employmentType ?? "" } };
    });
    setStagingET({ employmentType: "", effectFrom: today });
  };
  const removeEmpEmploymentType = (lid: string) => setFormData(p => {
    const updated = p.empEmploymentTypeForm.filter(x => x._localId !== lid);
    const last = updated[updated.length - 1];
    return { ...p, empEmploymentTypeForm: updated, promotion: { ...p.promotion, employmentType: last?.employmentType ?? "" } };
  });
  const updateEmpEmploymentType = (lid: string, patch: Partial<EmpEmploymentTypeForm>) => setFormData(p => {
    const updated = p.empEmploymentTypeForm.map(x => x._localId === lid ? { ...x, ...patch } : x);
    const last = updated[updated.length - 1];
    return { ...p, empEmploymentTypeForm: updated, promotion: { ...p.promotion, employmentType: last?.employmentType ?? "" } };
  });

  // Employment Status multi-entry helpers (staging pattern)
  const addEmpEmploymentStatus = () => {
    if (!stagingES.employmentStatus) return;
    const newEntry: EmpEmploymentStatusForm = { _localId: uid(), employmentStatus: stagingES.employmentStatus, probationPeriod: stagingES.probationPeriod, effectFrom: stagingES.effectFrom };
    setFormData(p => {
      const updated = upsertHistoryEntry(
        p.empEmploymentStatusForm,
        newEntry,
        (item) => item.employmentStatus === newEntry.employmentStatus && item.probationPeriod === newEntry.probationPeriod,
      );
      const last = updated[updated.length - 1];
      return { ...p, empEmploymentStatusForm: updated, promotion: { ...p.promotion, employmentStatus: last?.employmentStatus ?? "", probationPeriod: last?.probationPeriod ?? "" } };
    });
    setStagingES({ employmentStatus: "", probationPeriod: "", effectFrom: today });
  };
  const removeEmpEmploymentStatus = (lid: string) => setFormData(p => {
    const updated = p.empEmploymentStatusForm.filter(x => x._localId !== lid);
    const last = updated[updated.length - 1];
    return { ...p, empEmploymentStatusForm: updated, promotion: { ...p.promotion, employmentStatus: last?.employmentStatus ?? "", probationPeriod: last?.probationPeriod ?? "" } };
  });
  const updateEmpEmploymentStatus = (lid: string, patch: Partial<EmpEmploymentStatusForm>) => setFormData(p => {
    const updated = p.empEmploymentStatusForm.map(x => x._localId === lid ? { ...x, ...patch } : x);
    const last = updated[updated.length - 1];
    return { ...p, empEmploymentStatusForm: updated, promotion: { ...p.promotion, employmentStatus: last?.employmentStatus ?? "", probationPeriod: last?.probationPeriod ?? "" } };
  });

  // Work Shift multi-entry helpers
  const addEmpWorkShift = () => setFormData(p => ({ ...p, empWorkShiftForm: [...p.empWorkShiftForm, { _localId: uid(), workShiftID: null, _wsAutocomplete: "", effectFrom: today }] }));
  const removeEmpWorkShift = (lid: string) => setFormData(p => {
    const updated = p.empWorkShiftForm.filter(x => x._localId !== lid);
    const last = updated[updated.length - 1];
    return { ...p, empWorkShiftForm: updated, workShiftID: last?.workShiftID ?? null, wsAutocomplete: last?._wsAutocomplete ?? "" };
  });
  const updateEmpWorkShift = (lid: string, patch: Partial<EmpWorkShiftForm>) => setFormData(p => {
    const updated = p.empWorkShiftForm.map(x => x._localId === lid ? { ...x, ...patch } : x);
    const last = updated[updated.length - 1];
    return { ...p, empWorkShiftForm: updated, workShiftID: last?.workShiftID ?? null, wsAutocomplete: last?._wsAutocomplete ?? "" };
  });

  // Leave Policy multi-entry helpers
  const addEmpLeavePolicy = () => setFormData(p => ({ ...p, empLeavePolicyForm: [...p.empLeavePolicyForm, { _localId: uid(), leavePolicyID: null, _lpAutocomplete: "", effectFrom: today }] }));
  const removeEmpLeavePolicy = (lid: string) => setFormData(p => {
    const updated = p.empLeavePolicyForm.filter(x => x._localId !== lid);
    const last = updated[updated.length - 1];
    return { ...p, empLeavePolicyForm: updated, leavePolicyID: last?.leavePolicyID ?? null, lpAutocomplete: last?._lpAutocomplete ?? "" };
  });
  const updateEmpLeavePolicy = (lid: string, patch: Partial<EmpLeavePolicyForm>) => setFormData(p => {
    const updated = p.empLeavePolicyForm.map(x => x._localId === lid ? { ...x, ...patch } : x);
    const last = updated[updated.length - 1];
    return { ...p, empLeavePolicyForm: updated, leavePolicyID: last?.leavePolicyID ?? null, lpAutocomplete: last?._lpAutocomplete ?? "" };
  });

  // Attendance Policy multi-entry helpers
  const addEmpAttendancePolicy = () => setFormData(p => ({ ...p, empAttendancePolicyForm: [...p.empAttendancePolicyForm, { _localId: uid(), attendancePolicyID: null, _apAutocomplete: "", effectFrom: today }] }));
  const removeEmpAttendancePolicy = (lid: string) => setFormData(p => {
    const updated = p.empAttendancePolicyForm.filter(x => x._localId !== lid);
    const last = updated[updated.length - 1];
    return { ...p, empAttendancePolicyForm: updated, attendancePolicyID: last?.attendancePolicyID ?? null, apAutocomplete: last?._apAutocomplete ?? "" };
  });
  const updateEmpAttendancePolicy = (lid: string, patch: Partial<EmpAttendancePolicyForm>) => setFormData(p => {
    const updated = p.empAttendancePolicyForm.map(x => x._localId === lid ? { ...x, ...patch } : x);
    const last = updated[updated.length - 1];
    return { ...p, empAttendancePolicyForm: updated, attendancePolicyID: last?.attendancePolicyID ?? null, apAutocomplete: last?._apAutocomplete ?? "" };
  });

  // Contractor multi-entry helpers
  const addEmpContractor = () => setFormData(p => ({ ...p, empContractorForm: [...p.empContractorForm, { _localId: uid(), contractorID: null, _contrAutocomplete: "", effectFrom: today }] }));
  const removeEmpContractor = (lid: string) => setFormData(p => {
    const updated = p.empContractorForm.filter(x => x._localId !== lid);
    const last = updated[updated.length - 1];
    return { ...p, empContractorForm: updated, contractorID: last?.contractorID ?? null, contrAutocomplete: last?._contrAutocomplete ?? "" };
  });
  const updateEmpContractor = (lid: string, patch: Partial<EmpContractorForm>) => setFormData(p => {
    const updated = p.empContractorForm.map(x => x._localId === lid ? { ...x, ...patch } : x);
    const last = updated[updated.length - 1];
    return { ...p, empContractorForm: updated, contractorID: last?.contractorID ?? null, contrAutocomplete: last?._contrAutocomplete ?? "" };
  });

  /* ===============
     Form helpers
     =============== */
  const resetForm = () => {
    const ctx = getSidebarContext();
    const activeCompanyID = getActiveEmployeeCompanyID();
    setFormData({
      serviceProviderID: ctx?.serviceProviderID ?? null,
      companyID: activeCompanyID ?? ctx?.companyID ?? null,
      branchesID: null,
      contractorID: null,

      spAutocomplete: ctx?.serviceProviderName ?? "",
      coAutocomplete: ctx?.companyName ?? "",
      brAutocomplete: "",

      employeeFirstName: "",
      employeeLastName: "",
      deviceEmpCode: "",
      employeeID: "",
      departmentNameID: null,
      designationID: null,

      joiningDate: "",
      empType: "",
      pfMemberStatus: "",
      pfNumber: "",
      aadharNo: "",
      panNo: "",
      uanNo: "",
      esiNo: "",

      monthlyPGAutocomplete: "",
      hourlyPGAutocomplete: "",

      shiftEligibility: "",
      nightShiftEligibility: "",
      maxHoursPerDay: "",
      weeklyOffPattern: "",
      noticePeriodDaysForResignation: "",
      noticePeriodDaysForTermination: "",
      allowRotatingShift: false,
      allowCreateTaskOnMobile: false,
      pwaShowLeaveBalance: true,
      mobileAttendanceEnabled: false,
      mobileBreakEnabled: true,

      typeOfEmployee: "employee",

      workShiftID: null,
      attendancePolicyID: null,
      leavePolicyID: null,

      businessPhoneNo: "",
      businessEmail: "",
      personalPhoneNo: "",
      personalEmail: "",
      emergancyContact: "",
      personalPhones: [""],
      personalEmails: [""],
      emergencyContacts: [""],
      uanNos: [""],
      esiNos: [""],
      businessPhones: [""],
      businessEmails: [""],
      salaryPayoutCycle: "",
      monthlyPayGradeNames: [],
      presentAddress: "",
      permenantAddress: "",
      employeePhotoUrl: "",

      gender: "",
      dateOfBirth: "",
      bloodGroup: "",
      maritalStatus: "",
      employeeFatherName: "",
      employeeMotherName: "",
      employeeSpouseName: "",
      numberOfChildren: "",

      deptAutocomplete: "",
      desgAutocomplete: "",
      contrAutocomplete: "",
      wsAutocomplete: "",
      apAutocomplete: "",
      lpAutocomplete: "",

      promotion: {
        id: undefined,
        departmentNameID: null,
        designationID: null,
        managerID: null,
        employmentType: "",
        employmentStatus: "",
        probationPeriod: "",
        workShiftID: null,
        attendancePolicyID: null,
        leavePolicyID: null,
        salaryPayGradeType: "",
        monthlyPayGradeID: null,
        hourlyPayGradeID: null,
      },

      eduForm: [],
      employeeDocuments: [],
      expForm: [],
      devMapForm: [],
      bankDetailsForm: [],
      empDesignationForm: [],
      empDepartmentForm: [],
      empBranchForm: [],
      empEmploymentTypeForm: [],
      empEmploymentStatusForm: [],
      empWorkShiftForm: [],
      empLeavePolicyForm: [],
      empAttendancePolicyForm: [],
      empContractorForm: [],
    });

    setTokenDevMapForm([]);
    setTokenVerifierDevMapForm([]);
    setHasMultiTypeDevices(false);
    setCombinedDevList([]);
    setLinkedEmployees([]);
    setLinkedEmpSearch("");
    setLinkedEmpSuggestions([]);
    setShowManagerSearch(false);
    setPhotoFile(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    resetDocumentForm();
    setOriginalEduIds([]);
    setOriginalExpIds([]);
    setOriginalDevMapIds([]);
    setOriginalBankDetailIds([]);
    setOriginalEmpDesignationIds([]);
    setOriginalEmpBranchIds([]);
    setOriginalEmpDepartmentIds([]);
    setOriginalEmpEmploymentTypeIds([]);
    setOriginalEmpEmploymentStatusIds([]);
    setOriginalEmpWorkShiftIds([]);
    setOriginalEmpAttendancePolicyIds([]);
    setOriginalEmpFactualWorkShiftIds([]);
    setOriginalEmpFactualAttendancePolicyIds([]);
    setOriginalEmpLeavePolicyIds([]);
    setOriginalEmpContractorIds([]);
    setActiveDesgLocalId(null);
    setActiveDeptLocalId(null);
    setActiveBrLocalId(null);
    setActiveWsLocalId(null);
    setActiveApLocalId(null);
    setActiveLpLocalId(null);
    setActiveContrLocalId(null);
    setActiveFormSection("basic");
    setExpandedGroups({});
    setOriginalDevMapIds([]);
    setOriginalTokenDevMapIds([]);
    setOriginalTokenVerifierDevMapIds([]);
    setEditingRow(null);
    setSpList([]);
    setCoList([]);
    setBrList([]);
    setError(null);
  };

  // Helpers for rendering names in table
  const spName = (r: ManageEmpRead) =>
    r.serviceProvider?.companyName ?? r.serviceProviderName ?? "—";

  const contrName = (r: ManageEmpRead) =>
    r.contractor?.contractorName ?? r.contractorName ?? "—";

  const coName = (r: ManageEmpRead) =>
    r.company?.companyName ?? r.companyName ?? "—";
  const brName = (r: ManageEmpRead) =>
    r.branches?.branchName ?? r.branchName ?? "—";

  /* ===============
     Quick-Add handlers
     =============== */
  const searchQuickAdd = (query: string) => {
    if (quickAddSearchTimerRef.current) clearTimeout(quickAddSearchTimerRef.current);
    quickAddSearchTimerRef.current = setTimeout(async () => {
      if (!quickAddOpen || query.length < 1) {
        setQuickAddSuggestions([]);
        return;
      }
      setQuickAddSearching(true);
      try {
        let url = "";
        let displayField = "";
        switch (quickAddOpen) {
          case "department":
            url = API.departments;
            displayField = "departmentName";
            break;
          case "designation":
            url = API.designations;
            displayField = "designation";
            break;
          case "contractor":
            url = API.contractors;
            displayField = "contractorName";
            break;
          default:
            return;
        }
        const all = await fetchRefCached<any[]>(url);
        let scoped = all;
        if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
          scoped = filterForManager(scoped);
        } else if (formData.companyID) {
          scoped = scoped.filter((x: any) => x.companyID === formData.companyID);
        }
        const ql = query.toLowerCase();
        const filtered = scoped.filter((item: any) =>
          (item[displayField] ?? "").toLowerCase().includes(ql)
        );
        setQuickAddSuggestions(filtered.slice(0, 10));
      } catch (e) {
        console.error("Quick-add search error:", e);
      } finally {
        setQuickAddSearching(false);
      }
    }, 250);
  };

  const handleQuickAddSelect = (item: any) => {
    switch (quickAddOpen) {
      case "department":
        setFormData((p) => ({
          ...p,
          empDepartmentForm: upsertHistoryEntry(
            p.empDepartmentForm,
            {
              _localId: uid(),
              departmentNameID: item.id,
              _deptAutocomplete: item.departmentName ?? "",
              effectFrom: today,
            },
            (entry) => entry.departmentNameID === item.id,
          ),
          departmentNameID: item.id,
          deptAutocomplete: item.departmentName ?? "",
          promotion: { ...p.promotion, departmentNameID: item.id },
        }));
        break;
      case "designation":
        setFormData((p) => ({
          ...p,
          empDesignationForm: upsertHistoryEntry(
            p.empDesignationForm,
            {
              _localId: uid(),
              designationID: item.id,
              _desgAutocomplete: item.designation ?? "",
              effectFrom: today,
            },
            (entry) => entry.designationID === item.id,
          ),
        }));
        break;
      case "contractor":
        setFormData((p) => ({
          ...p,
          empContractorForm: upsertHistoryEntry(
            p.empContractorForm,
            {
              _localId: uid(),
              contractorID: item.id,
              _contrAutocomplete: item.contractorName ?? "",
              effectFrom: today,
            },
            (entry) => entry.contractorID === item.id,
          ),
          contractorID: item.id,
          contrAutocomplete: item.contractorName ?? "",
        }));
        break;
    }
    setQuickAddOpen(null);
    setQuickAddValue("");
    setQuickAddSuggestions([]);
  };

  const handleQuickAdd = async () => {
    if (!quickAddValue.trim() || !quickAddOpen) return;
    setQuickAddSaving(true);
    try {
      const basePayload: any = {};
      if (formData.serviceProviderID) basePayload.serviceProviderID = formData.serviceProviderID;
      if (formData.companyID) basePayload.companyID = formData.companyID;
      if (formData.branchesID) basePayload.branchesID = formData.branchesID;

      let url = "";
      let payload: any = {};

      switch (quickAddOpen) {
        case "department":
          url = API.departments;
          payload = { ...basePayload, departmentName: quickAddValue.trim() };
          break;
        case "designation":
          url = API.designations;
          payload = { ...basePayload, designation: quickAddValue.trim() };
          break;
        case "contractor":
          url = API.contractors;
          payload = { ...basePayload, contractorName: quickAddValue.trim() };
          break;
        default:
          return;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      const item = created?.data ?? created;

      // Auto-select the newly created item
      switch (quickAddOpen) {
        case "department":
          setFormData((p) => ({
            ...p,
            empDepartmentForm: upsertHistoryEntry(
              p.empDepartmentForm,
              {
                _localId: uid(),
                departmentNameID: item.id,
                _deptAutocomplete: item.departmentName ?? quickAddValue,
                effectFrom: today,
              },
              (entry) => entry.departmentNameID === item.id,
            ),
            departmentNameID: item.id,
            deptAutocomplete: item.departmentName ?? quickAddValue,
            promotion: { ...p.promotion, departmentNameID: item.id },
          }));
          break;
        case "designation":
          setFormData((p) => ({
            ...p,
            empDesignationForm: upsertHistoryEntry(
              p.empDesignationForm,
              {
                _localId: uid(),
                designationID: item.id,
                _desgAutocomplete: item.designation ?? quickAddValue,
                effectFrom: today,
              },
              (entry) => entry.designationID === item.id,
            ),
          }));
          break;
        case "contractor":
          setFormData((p) => ({
            ...p,
            empContractorForm: upsertHistoryEntry(
              p.empContractorForm,
              {
                _localId: uid(),
                contractorID: item.id,
                _contrAutocomplete: item.contractorName ?? quickAddValue,
                effectFrom: today,
              },
              (entry) => entry.contractorID === item.id,
            ),
            contractorID: item.id,
            contrAutocomplete: item.contractorName ?? quickAddValue,
          }));
          break;
      }

      setQuickAddOpen(null);
      setQuickAddValue("");
    } catch (e: any) {
      console.error("Quick-add failed:", e);
      setError(e?.message || "Quick-add failed");
    } finally {
      setQuickAddSaving(false);
    }
  };

  const handleViewHistory = async (r: ManageEmpRead) => {
    setHistoryEmployee(r);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API.manageEmp}/${r.id}/field-history`);
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setHistoryData(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (e) {
      console.error("Failed to load history:", e);
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const resetDocumentForm = () => {
    setDocumentForm({
      name: "",
      category: "Identity proof",
      description: "",
      issuedDate: "",
      expiryDate: "",
      file: null,
    });
    setDocumentInputKey((p) => p + 1);
  };

  const formatFileSize = (size?: number) => {
    if (!size) return "—";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  const validateEmployeeDocument = () => {
    if (!documentForm.name.trim()) {
      toast.error("Document name is required");
      return false;
    }

    if (!documentForm.category.trim()) {
      toast.error("Document category is required");
      return false;
    }

    if (!documentForm.file) {
      toast.error("Please choose a file");
      return false;
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(documentForm.file.type)) {
      toast.error("Only PDF, JPG, JPEG, PNG and WEBP files are allowed");
      return false;
    }

    if (documentForm.file.size > 5 * 1024 * 1024) {
      toast.error("File size must be 5 MB or less");
      return false;
    }

    return true;
  };

  const addEmployeeDocument = async () => {
    if (!validateEmployeeDocument()) return;

    try {
      setDocumentSaving(true);

      const fd = new FormData();
      fd.append("file", documentForm.file!);

      const uploadRes = await fetch(API.upload, {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      });

      if (!uploadRes.ok) throw new Error(await uploadRes.text());

      const uploaded = await uploadRes.json();

      const fileUrl = uploaded?.url?.startsWith("http")
        ? uploaded.url
        : `/backend${uploaded?.url ?? ""}`;

      const doc: EmployeeDocumentForm = {
        _localId: uid(),
        name: documentForm.name.trim(),
        category: documentForm.category,
        description: documentForm.description.trim(),
        issuedDate: documentForm.issuedDate,
        expiryDate: documentForm.expiryDate,
        fileUrl,
        fileName: documentForm.file!.name,
        fileMimeType: documentForm.file!.type,
        fileSize: documentForm.file!.size,
      };

      setFormData((p) => ({
        ...p,
        employeeDocuments: [...p.employeeDocuments, doc],
      }));

      resetDocumentForm();
      toast.success("Document added");
    } catch (e: any) {
      toast.error(e?.message || "Document upload failed");
    } finally {
      setDocumentSaving(false);
    }
  };

  const removeEmployeeDocument = (localId: string) => {
    const confirmed = window.confirm("Remove this document?");
    if (!confirmed) return;

    setFormData((p) => ({
      ...p,
      employeeDocuments: p.employeeDocuments.filter((d) => d._localId !== localId),
    }));
  };

  /* ===============
     CRUD submit
     =============== */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const validationErrors: string[] = [];
    if (!formData.employeeFirstName?.trim()) validationErrors.push("Employee First Name is mandatory");
    if (!formData.employeeLastName?.trim()) validationErrors.push("Employee Last Name is mandatory");
    if (!formData.employeeID?.trim()) validationErrors.push("Employee ID is mandatory");
    if (!isAdmin && !primaryMultiValue(formData.personalPhones).trim()) validationErrors.push("Mobile Number is mandatory");
    if (!isAdmin && !formData.joiningDate?.trim()) validationErrors.push("Joining Date is mandatory");

    // Duplicate Employee ID check (within the same company)
    if (formData.employeeID?.trim()) {
      try {
        const res = await fetch("/backend/manage-emp");
        const allEmps = await res.json();
        const emps = Array.isArray(allEmps) ? allEmps : [];
        const duplicate = emps.find(
          (r: any) =>
            r.employeeID?.toLowerCase() === formData.employeeID.trim().toLowerCase() &&
            r.companyID === formData.companyID &&
            (!editingRow || r.id !== editingRow.id)
        );
        if (duplicate) {
          validationErrors.push("Employee ID already exists in this company. Please use a unique Employee ID.");
        }
      } catch {
        // If fetch fails, fall back to local rows check
        const duplicate = rows.find(
          (r) =>
            r.employeeID?.toLowerCase() === formData.employeeID.trim().toLowerCase() &&
            (!editingRow || r.id !== editingRow.id)
        );
        if (duplicate) {
          validationErrors.push("Employee ID already exists. Please use a unique Employee ID.");
        }
      }
    }

    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const uploadedPhotoUrl = await uploadPhotoIfNeeded();

      const edu = formData.eduForm.map(e => ({
        id: e.id,
        instituteType: e.instituteType || undefined,
        instituteName: e.instituteName || undefined,
        degree: e.degree || undefined,
        pasingYear: e.pasingYear || undefined,
        marks: e.marks || undefined,
        gpaCgpa: e.gpaCgpa || undefined,
        class: e.class || undefined,
      }));

      const exp = formData.expForm.map(x => ({
        id: x.id,
        orgName: x.orgName || undefined,
        designation: x.designation || undefined,
        fromDate: x.fromDate || undefined,
        toDate: x.toDate || undefined,
        responsibility: x.responsibility || undefined,
        skill: x.skill || undefined,
      }));

      const devices = formData.devMapForm
        .filter(d => !!d.deviceID)
        .map(d => ({
          id: d.id,
          deviceID: Number(d.deviceID),
          deviceEmpCode: d.deviceEmpCode || undefined,
          authType: d.authType || undefined,
        }));

      // Token register devices
      const tokenDevicesFromForm = tokenDevMapForm
        .filter(d => !!d.deviceID)
        .map(d => ({
          id: d.id,
          deviceID: d.deviceID ? Number(d.deviceID) : undefined,
          deviceEmpCode: d.deviceEmpCode || undefined,
          authType: d.authType || undefined,
          deviceType: d.deviceType || "TR",
        }));

      // Token verifier devices
      const tokenVerifierDevicesFromForm = tokenVerifierDevMapForm
        .filter(d => !!d.deviceID)
        .map(d => ({
          id: d.id,
          deviceID: d.deviceID ? Number(d.deviceID) : undefined,
          deviceEmpCode: d.deviceEmpCode || undefined,
          authType: d.authType || undefined,
          deviceType: "TV",
        }));

      const tokenDevices = [...tokenDevicesFromForm, ...tokenVerifierDevicesFromForm];
      const bankDetails = formData.bankDetailsForm.map(b => ({
        id: b.id,
        bankName: b.bankName || undefined,
        bankBranchName: b.bankBranchName || undefined,
        accNumber: b.accNumber || undefined,
        ifscCode: b.ifscCode || undefined,
        upi: b.upi || undefined,
      }));

      const empDesignations = formData.empDesignationForm
        .filter(d => d.designationID != null)
        .map(d => ({
          id: d.id,
          designationID: d.designationID!,
          effectFrom: d.effectFrom || undefined,
        }));

      const empBranches = formData.empBranchForm
        .filter(b => b.branchesID != null)
        .map(b => ({ id: b.id, branchesID: b.branchesID!, effectFrom: b.effectFrom || undefined }));

      const empDepartments = formData.empDepartmentForm
        .filter(d => d.departmentNameID != null)
        .map(d => ({ id: d.id, departmentNameID: d.departmentNameID!, effectFrom: d.effectFrom || undefined }));

      const empEmploymentTypes = formData.empEmploymentTypeForm
        .filter(t => t.employmentType)
        .map(t => ({ id: t.id, employmentType: t.employmentType, effectFrom: t.effectFrom || undefined }));

      const empEmploymentStatuses = formData.empEmploymentStatusForm
        .filter(s => s.employmentStatus)
        .map(s => ({ id: s.id, employmentStatus: s.employmentStatus, probationPeriod: s.probationPeriod || undefined, effectFrom: s.effectFrom || undefined }));

      const empWorkShifts = formData.empWorkShiftForm
        .filter(w => w.workShiftID != null && !w._isFactual)
        .map(w => ({ id: w.id, workShiftID: w.workShiftID!, effectFrom: w.effectFrom || undefined }));

      const empFactualWorkShifts = formData.empWorkShiftForm
        .filter(w => w.workShiftID != null && w._isFactual)
        .map(w => ({ id: w.id, factualWorkShiftID: w.workShiftID!, effectFrom: w.effectFrom || undefined }));

      const empAttendancePolicies = formData.empAttendancePolicyForm
        .filter(a => a.attendancePolicyID != null && !a._isFactual)
        .map(a => ({ id: a.id, attendancePolicyID: a.attendancePolicyID!, effectFrom: a.effectFrom || undefined }));

      const empFactualAttendancePolicies = formData.empAttendancePolicyForm
        .filter(a => a.attendancePolicyID != null && a._isFactual)
        .map(a => ({ id: a.id, factualAttendancePolicyID: a.attendancePolicyID!, effectFrom: a.effectFrom || undefined }));

      const empLeavePolicies = formData.empLeavePolicyForm
        .filter(l => l.leavePolicyID != null)
        .map(l => ({ id: l.id, leavePolicyID: l.leavePolicyID!, effectFrom: l.effectFrom || undefined }));

      const empContractors = formData.empContractorForm
        .filter(c => c.contractorID != null)
        .map(c => ({ id: c.id, contractorID: c.contractorID!, effectFrom: c.effectFrom || undefined }));

      const eduRemaining = new Set(edu.filter(e => e.id != null).map(e => e.id as number));
      const expRemaining = new Set(exp.filter(x => x.id != null).map(x => x.id as number));
      const devRemaining = new Set(devices.filter(d => d.id != null).map(d => d.id as number));
      const tokenDevRemaining = new Set(tokenDevices.filter(d => d.id != null).map(d => d.id as number));
      const bankRemaining = new Set(bankDetails.filter((b: { id?: number }) => b.id != null).map((b: { id?: number }) => b.id as number));
      const empDesgRemaining = new Set(empDesignations.filter(d => d.id != null).map(d => d.id as number));
      const empBranchRemaining = new Set(empBranches.filter(b => b.id != null).map(b => b.id as number));
      const empDeptRemaining = new Set(empDepartments.filter(d => d.id != null).map(d => d.id as number));
      const empEmpTypeRemaining = new Set(empEmploymentTypes.filter(t => t.id != null).map(t => t.id as number));
      const empEmpStatusRemaining = new Set(empEmploymentStatuses.filter(s => s.id != null).map(s => s.id as number));
      const empWSRemaining = new Set(empWorkShifts.filter(w => w.id != null).map(w => w.id as number));
      const empAPRemaining = new Set(empAttendancePolicies.filter(a => a.id != null).map(a => a.id as number));
      const empFWSRemaining = new Set(empFactualWorkShifts.filter(w => w.id != null).map(w => w.id as number));
      const empFAPRemaining = new Set(empFactualAttendancePolicies.filter(a => a.id != null).map(a => a.id as number));
      const empLPRemaining = new Set(empLeavePolicies.filter(l => l.id != null).map(l => l.id as number));
      const empCtrRemaining = new Set(empContractors.filter(c => c.id != null).map(c => c.id as number));
      const type = formData.promotion?.salaryPayGradeType;

      const payload: any = {
        serviceProviderID: formData.serviceProviderID ?? undefined,
        companyID: formData.companyID ?? undefined,
        branchesID: formData.branchesID ?? undefined,
        contractorID:
          formData.promotion?.employmentType === "Contract"
            ? (formData.contractorID ?? undefined)
            : null,

        employeeFirstName: formData.employeeFirstName || undefined,
        employeeLastName: formData.employeeLastName || undefined,
        employeeID: formData.employeeID || undefined,
        joiningDate: formData.joiningDate || undefined,

        pfMemberStatus: formData.pfMemberStatus || undefined,
        pfNumber: formData.pfNumber || undefined,
        aadharNo: formData.aadharNo || undefined,
        panNo: formData.panNo || undefined,
        uanNo: joinMultiValue(formData.uanNos) || undefined,
        esiNo: joinMultiValue(formData.esiNos) || undefined,

        departmentNameID: formData.departmentNameID ?? undefined,
        designationID: formData.empDesignationForm.length > 0
          ? (formData.empDesignationForm[formData.empDesignationForm.length - 1].designationID ?? undefined)
          : (formData.designationID ?? undefined),
        employmentType: formData.promotion.employmentType || undefined,
        empType: formData.promotion.employmentType || undefined,
        employmentStatus: formData.promotion.employmentStatus || undefined,
        probationPeriod: formData.promotion.probationPeriod || undefined,
        workShiftID: formData.workShiftID ?? undefined,
        attendancePolicyID: formData.attendancePolicyID ?? undefined,
        leavePolicyID: formData.leavePolicyID ?? undefined,
        salaryPayGradeType: formData.promotion.salaryPayGradeType || undefined,
        monthlyPayGradeID: type === "Monthly" ? formData.promotion?.monthlyPayGradeID ?? undefined : undefined,
        hourlyPayGradeID: type === "Hourly" ? formData.promotion?.hourlyPayGradeID ?? undefined : undefined,

        shiftEligibility:
          formData.monthlyPayGradeNames.length > 0
            ? JSON.stringify({ payGrades: formData.monthlyPayGradeNames })
            : formData.shiftEligibility || undefined,
        nightShiftEligibility: formData.nightShiftEligibility || undefined,
        maxHoursPerDay: formData.maxHoursPerDay || undefined,
        weeklyOffPattern: formData.salaryPayoutCycle || formData.weeklyOffPattern || undefined,
        noticePeriodDaysForResignation: formData.noticePeriodDaysForResignation || undefined,
        noticePeriodDaysForTermination: formData.noticePeriodDaysForTermination || undefined,
        allowRotatingShift: formData.allowRotatingShift,
        allowCreateTaskOnMobile: formData.allowCreateTaskOnMobile,
        pwaShowLeaveBalance: formData.pwaShowLeaveBalance,
        mobileAttendanceEnabled: formData.mobileAttendanceEnabled,
        mobileBreakEnabled: formData.mobileBreakEnabled,

        typeOfEmployee: formData.typeOfEmployee || undefined,


        businessPhoneNo: joinMultiValue(formData.businessPhones) || undefined,
        businessEmail: joinMultiValue(formData.businessEmails) || undefined,
        personalPhoneNo: joinMultiValue(formData.personalPhones) || undefined,
        personalEmail: joinMultiValue(formData.personalEmails) || undefined,
        emergancyContact: joinMultiValue(formData.emergencyContacts) || undefined,
        presentAddress: formData.presentAddress || undefined,
        permenantAddress: formData.permenantAddress || undefined,
        employeePhotoUrl: uploadedPhotoUrl ?? (formData.employeePhotoUrl || undefined),

        gender: formData.gender || undefined,
        numberOfChildren: formData.numberOfChildren !== "" ? Number(formData.numberOfChildren) : undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        bloodGroup: formData.bloodGroup || undefined,
        maritalStatus: formData.maritalStatus || undefined,
        employeeFatherName: formData.employeeFatherName || undefined,
        employeeMotherName: formData.employeeMotherName || undefined,
        employeeSpouseName: formData.employeeSpouseName || undefined,

        edu,
        exp,
        devices,
        tokenDevices,
        bankDetails,
        employeeDocuments: formData.employeeDocuments.map((d) => ({
          id: d.id,
          name: d.name,
          category: d.category,
          description: d.description,
          issuedDate: d.issuedDate || undefined,
          expiryDate: d.expiryDate || undefined,
          fileUrl: d.fileUrl,
          fileName: d.fileName,
          fileMimeType: d.fileMimeType,
          fileSize: d.fileSize,
        })),
        empDesignations,
        empBranches,
        empDepartments,
        empEmploymentTypes,
        empEmploymentStatuses,
        empWorkShifts,
        empFactualWorkShifts,
        empAttendancePolicies,
        empFactualAttendancePolicies,
        empLeavePolicies,
        empContractors,

        ...(editingRow ? {
          eduIdsToDelete: originalEduIds.filter(id => !eduRemaining.has(id)),
          expIdsToDelete: originalExpIds.filter(id => !expRemaining.has(id)),
          deviceMapIdsToDelete: originalDevMapIds.filter(id => !devRemaining.has(id)),
          tokenDeviceMapIdsToDelete: [...originalTokenDevMapIds, ...originalTokenVerifierDevMapIds].filter(id => !tokenDevRemaining.has(id)),
          bankDetailsIdsToDelete: originalBankDetailIds.filter(id => !bankRemaining.has(id)),
          empDesignationIdsToDelete: originalEmpDesignationIds.filter(id => !empDesgRemaining.has(id)),
          empBranchIdsToDelete: originalEmpBranchIds.filter(id => !empBranchRemaining.has(id)),
          empDepartmentIdsToDelete: originalEmpDepartmentIds.filter(id => !empDeptRemaining.has(id)),
          empEmploymentTypeIdsToDelete: originalEmpEmploymentTypeIds.filter(id => !empEmpTypeRemaining.has(id)),
          empEmploymentStatusIdsToDelete: originalEmpEmploymentStatusIds.filter(id => !empEmpStatusRemaining.has(id)),
          empWorkShiftIdsToDelete: originalEmpWorkShiftIds.filter(id => !empWSRemaining.has(id)),
          empAttendancePolicyIdsToDelete: originalEmpAttendancePolicyIds.filter(id => !empAPRemaining.has(id)),
          empFactualWorkShiftIdsToDelete: originalEmpFactualWorkShiftIds.filter(id => !empFWSRemaining.has(id)),
          empFactualAttendancePolicyIdsToDelete: originalEmpFactualAttendancePolicyIds.filter(id => !empFAPRemaining.has(id)),
          empLeavePolicyIdsToDelete: originalEmpLeavePolicyIds.filter(id => !empLPRemaining.has(id)),
          empContractorIdsToDelete: originalEmpContractorIds.filter(id => !empCtrRemaining.has(id)),
        } : {}),
      };

      if (editingRow) {
        const res = await fetch(`${API.manageEmp}/${editingRow.id}`, {
          method: "PATCH",
          headers: jsonAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());

        // Save linked employees
        await fetch(`${API.manageEmp}/${editingRow.id}/linked-employees`, {
          method: "POST",
          headers: jsonAuthHeaders(),
          body: JSON.stringify({ linkedEmployeeIds: linkedEmployees.map(le => le.id) }),
        });
      } else {
        const res = await fetch(API.manageEmp, {
          method: "POST",
          headers: jsonAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());

        // Save linked employees for newly created employee
        const created = await res.json().catch(() => null);
        const newId = created?.id ?? created?.data?.id;
        if (newId && linkedEmployees.length > 0) {
          await fetch(`${API.manageEmp}/${newId}/linked-employees`, {
            method: "POST",
            headers: jsonAuthHeaders(),
            body: JSON.stringify({ linkedEmployeeIds: linkedEmployees.map(le => le.id) }),
          });
        }
      }

      clearRefCache();
      await fetchRows();
      resetForm();
      setIsAddingNew(false);
      setEditingRow(null);
      toast.success("Employee saved successfully");
      dispatchAppRefresh();
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (r: ManageEmpRead) => {
    setEditingRow(r);
    setIsAddingNew(true);
    setIsViewing(false);

    try {
      // ✅ Fetch fresh data for this specific employee
      const response = await fetch(`${API.manageEmp}/${r.id}`);
      if (!response.ok) throw new Error('Failed to fetch employee data');
      const freshData = await response.json();

      // Now use freshData instead of r for all mappings
      const eduForm: EduForm[] = (freshData.empEduQualification ?? []).map((e: EduRead) => ({
        id: e.id,
        _localId: uid(),
        instituteType: e.instituteType ?? "",
        instituteName: e.instituteName ?? "",
        degree: e.degree ?? "",
        pasingYear: e.pasingYear ?? "",
        marks: e.marks ?? "",
        gpaCgpa: e.gpaCgpa ?? "",
        class: e.class ?? "",
      }));

      const expForm: ExpForm[] = (freshData.empProfExprience ?? []).map((x: ExpRead) => ({
        id: x.id,
        _localId: uid(),
        orgName: x.orgName ?? "",
        designation: x.designation ?? "",
        fromDate: x.fromDate ?? "",
        toDate: x.toDate ?? "",
        responsibility: x.responsibility ?? "",
        skill: x.skill ?? "",
      }));

      // Biometric devices from empDeviceMapping
      const devMapForm: DevMapForm[] = (freshData.empDeviceMapping ?? []).map((d: DevMapRead) => ({
        id: d.id,
        _localId: uid(),
        deviceID: (d.deviceID ?? "").toString(),
        deviceEmpCode: d.deviceEmpCode ?? "",
        deviceName: d.device?.deviceName ?? d.deviceName ?? "",
        deviceType: d.device?.deviceType ?? "AT",
        authType: (d as any).authType ?? "",
        _devAutocomplete: d.device?.deviceName ?? d.deviceName ?? "",
      }));

      // Token register devices from tokenDeviceMapping (TR only)
      const tokenDevMapForm: TokenDevMapForm[] = (freshData.tokenDeviceMapping ?? [])
        .filter((d: any) => (d.device?.deviceType ?? d.deviceType ?? "TR") !== "TV")
        .map((d: any) => ({
          id: d.id,
          _localId: uid(),
          deviceID: (d.deviceID ?? "").toString(),
          deviceEmpCode: d.deviceEmpCode ?? "",
          deviceName: d.device?.deviceName ?? d.deviceName ?? "",
          deviceType: d.device?.deviceType ?? "TR",
          authType: d.authType ?? "",
          _devAutocomplete: d.device?.deviceName ?? d.deviceName ?? "",
        }));

      // Token verifier devices from tokenDeviceMapping (TV only)
      const tokenVerifierDevMapFormData: TokenDevMapForm[] = (freshData.tokenDeviceMapping ?? [])
        .filter((d: any) => (d.device?.deviceType ?? d.deviceType ?? "") === "TV")
        .map((d: any) => ({
          id: d.id,
          _localId: uid(),
          deviceID: (d.deviceID ?? "").toString(),
          deviceEmpCode: d.deviceEmpCode ?? "",
          deviceName: d.device?.deviceName ?? d.deviceName ?? "",
          deviceType: "TV",
          authType: d.authType ?? "",
          _devAutocomplete: d.device?.deviceName ?? d.deviceName ?? "",
        }));

      // Bank details
      const bankSource: BankDetailsRead[] = (freshData.employeeBankDetails ?? freshData.bankDetails ?? []) as BankDetailsRead[];
      const bankDetailsForm: BankDetailsForm[] = bankSource.map((b): BankDetailsForm => ({
        id: b.id,
        _localId: uid(),
        bankName: b.bankName ?? "",
        bankBranchName: b.bankBranchName ?? "",
        accNumber: b.accNumber ?? "",
        ifscCode: b.ifscCode ?? "",
        upi: b.upi ?? "",
      }));


      // Employee Designations
      const empDesignationForm: EmpDesignationForm[] = (freshData.empDesignation ?? []).map((d: any) => ({
        id: d.id,
        _localId: uid(),
        designationID: d.designationID ?? null,
        _desgAutocomplete: d.designation?.designation ?? "",
        effectFrom: d.effectFrom ?? "",
      }));



      const latestPromotion = (freshData as any).empPromotion && (freshData as any).empPromotion.length
        ? [...(freshData as any).empPromotion].sort((a: any, b: any) => (b.id ?? 0) - (a.id ?? 0))[0]
        : null;

      const effectiveDeptID = freshData.departmentNameID ?? null;
      const effectiveDesgID = freshData.designationID ?? null;
      const effectiveWorkShiftID = freshData.workShiftID ??
        ([...(freshData.empWorkShift ?? [])].sort((a: any, b: any) =>
          new Date(b.effectFrom || 0).getTime() - new Date(a.effectFrom || 0).getTime()
        )[0]?.workShiftID ?? null);
      const effectiveAttendancePolicyID = freshData.attendancePolicyID ??
        ([...(freshData.empAttendancePolicy ?? [])].sort((a: any, b: any) =>
          new Date(b.effectFrom || 0).getTime() - new Date(a.effectFrom || 0).getTime()
        )[0]?.attendancePolicyID ?? null);
      const effectiveLeavePolicyID = freshData.leavePolicyID ??
        ([...(freshData.empLeavePolicy ?? [])].sort((a: any, b: any) =>
          new Date(b.effectFrom || 0).getTime() - new Date(a.effectFrom || 0).getTime()
        )[0]?.leavePolicyID ?? null);

      // Set main form data
      setFormData({
        serviceProviderID: freshData.serviceProviderID ?? freshData.serviceProvider?.id ?? null,
        companyID: freshData.companyID ?? freshData.company?.id ?? null,
        branchesID: freshData.branchesID ?? freshData.branches?.id ?? null,
        departmentNameID: effectiveDeptID,
        designationID: effectiveDesgID,
        contractorID: freshData.contractorID ?? freshData.contractor?.id ?? null,
        spAutocomplete: freshData.serviceProvider?.companyName ?? freshData.serviceProviderName ?? "",
        coAutocomplete: freshData.company?.companyName ?? freshData.companyName ?? "",
        brAutocomplete: freshData.branches?.branchName ?? freshData.branchName ?? "",
        employeeFirstName: freshData.employeeFirstName ?? "",
        employeeLastName: freshData.employeeLastName ?? "",
        deviceEmpCode: freshData.deviceEmpCode ?? "",
        employeeID: freshData.employeeID ?? "",
        joiningDate: freshData.joiningDate ?? "",
        empType: freshData.empType ?? "",
        pfMemberStatus: freshData.pfMemberStatus ?? "",
        pfNumber: freshData.pfNumber ?? "",
        aadharNo: freshData.aadharNo ?? "",
        panNo: freshData.panNo ?? "",
        uanNo: freshData.uanNo ?? "",
        esiNo: freshData.esiNo ?? "",
        uanNos: parseMultiValue(freshData.uanNo),
        esiNos: parseMultiValue(freshData.esiNo),
        monthlyPGAutocomplete: "",
        hourlyPGAutocomplete: "",
        shiftEligibility: freshData.shiftEligibility ?? "",
        nightShiftEligibility: freshData.nightShiftEligibility ?? "",
        maxHoursPerDay: freshData.maxHoursPerDay ?? "",
        weeklyOffPattern: freshData.weeklyOffPattern ?? "",
        salaryPayoutCycle: freshData.weeklyOffPattern ?? "",
        monthlyPayGradeNames: parsePayGradeNames(freshData.shiftEligibility),
        noticePeriodDaysForResignation: freshData.noticePeriodDaysForResignation ?? "",
        noticePeriodDaysForTermination: freshData.noticePeriodDaysForTermination ?? "",
        allowRotatingShift: freshData.allowRotatingShift ?? false,
        allowCreateTaskOnMobile: freshData.allowCreateTaskOnMobile ?? false,
        pwaShowLeaveBalance: freshData.pwaShowLeaveBalance ?? true,
        mobileAttendanceEnabled: freshData.mobileAttendanceEnabled ?? false,
        mobileBreakEnabled: freshData.mobileBreakEnabled !== false,
        typeOfEmployee: freshData.typeOfEmployee ?? "",
        workShiftID: effectiveWorkShiftID,
        attendancePolicyID: effectiveAttendancePolicyID,
        leavePolicyID: effectiveLeavePolicyID,
        businessPhoneNo: freshData.businessPhoneNo ?? "",
        businessEmail: freshData.businessEmail ?? "",
        personalPhoneNo: freshData.personalPhoneNo ?? "",
        personalEmail: freshData.personalEmail ?? "",
        emergancyContact: freshData.emergancyContact ?? "",
        personalPhones: parseMultiValue(freshData.personalPhoneNo),
        personalEmails: parseMultiValue(freshData.personalEmail),
        emergencyContacts: parseMultiValue(freshData.emergancyContact),
        businessPhones: parseMultiValue(freshData.businessPhoneNo),
        businessEmails: parseMultiValue(freshData.businessEmail),
        presentAddress: freshData.presentAddress ?? "",
        permenantAddress: freshData.permenantAddress ?? "",
        employeePhotoUrl: freshData.employeePhotoUrl ?? "",
        gender: freshData.gender ?? "",
        dateOfBirth: freshData.dateOfBirth ?? "",
        bloodGroup: freshData.bloodGroup ?? "",
        maritalStatus: freshData.maritalStatus ?? "",
        employeeFatherName: freshData.employeeFatherName ?? "",
        employeeMotherName: freshData.employeeMotherName ?? "",
        employeeSpouseName: freshData.employeeSpouseName ?? "",
        numberOfChildren: freshData.numberOfChildren != null ? String(freshData.numberOfChildren) : "",
        contrAutocomplete: "",
        wsAutocomplete: "",
        apAutocomplete: "",
        lpAutocomplete: "",
        promotion: latestPromotion ? {
          id: latestPromotion.id,
          departmentNameID: latestPromotion.departmentNameID ?? null,
          designationID: latestPromotion.designationID ?? null,
          managerID: latestPromotion.managerID ?? null,
          employmentType: latestPromotion.employmentType ?? "",
          employmentStatus: latestPromotion.employmentStatus ?? "",
          probationPeriod: latestPromotion.probationPeriod ?? "",
          workShiftID: latestPromotion.workShiftID ?? null,
          attendancePolicyID: latestPromotion.attendancePolicyID ?? null,
          leavePolicyID: latestPromotion.leavePolicyID ?? null,
          salaryPayGradeType: latestPromotion.salaryPayGradeType ?? "",
          monthlyPayGradeID: latestPromotion.monthlyPayGradeID ?? null,
          hourlyPayGradeID: latestPromotion.hourlyPayGradeID ?? null,
        } : {
          id: undefined,
          departmentNameID: effectiveDeptID,
          designationID: effectiveDesgID,
          managerID: freshData.managerID ?? null,
          employmentType: freshData.employmentType ?? "",
          employmentStatus: freshData.employmentStatus ?? "",
          probationPeriod: freshData.probationPeriod ?? "",
          workShiftID: effectiveWorkShiftID,
          attendancePolicyID: effectiveAttendancePolicyID,
          leavePolicyID: effectiveLeavePolicyID,
          salaryPayGradeType: freshData.salaryPayGradeType ?? "",
          monthlyPayGradeID: freshData.monthlyPayGradeID ?? null,
          hourlyPayGradeID: freshData.hourlyPayGradeID ?? null,
        },
        deptAutocomplete: "",
        desgAutocomplete: "",
        eduForm,
        expForm,
        devMapForm,
        bankDetailsForm,
        empDesignationForm,
        // Multi-entry form arrays (populated from junction tables)
        empDepartmentForm: (freshData.empDepartment ?? []).map((d: any) => ({ id: d.id, _localId: uid(), departmentNameID: d.departmentNameID ?? null, _deptAutocomplete: d.department?.departmentName ?? "", effectFrom: d.effectFrom ?? "" })),
        empBranchForm: (freshData.empBranch ?? []).map((d: any) => ({ id: d.id, _localId: uid(), branchesID: d.branchesID ?? null, _brAutocomplete: d.branch?.branchName ?? "", effectFrom: d.effectFrom ?? "" })),
        empEmploymentTypeForm: (freshData.empEmploymentType ?? []).map((d: any) => ({ id: d.id, _localId: uid(), employmentType: d.employmentType ?? "", effectFrom: d.effectFrom ?? "" })),
        empEmploymentStatusForm: (freshData.empEmploymentStatus ?? []).map((d: any) => ({ id: d.id, _localId: uid(), employmentStatus: d.employmentStatus ?? "", probationPeriod: d.probationPeriod ?? "", effectFrom: d.effectFrom ?? "" })),
        empWorkShiftForm: [
          ...(freshData.empWorkShift ?? []).map((d: any) => ({ id: d.id, _localId: uid(), workShiftID: d.workShiftID ?? null, _wsAutocomplete: d.workShift?.workShiftName ?? "", effectFrom: d.effectFrom ?? "", _isFactual: false })),
          ...(freshData.empFactualWorkShift ?? []).map((d: any) => ({ id: d.id, _localId: uid(), workShiftID: d.factualWorkShiftID ?? null, _wsAutocomplete: d.factualWorkShift?.workShiftName ?? '', effectFrom: d.effectFrom ?? "", _isFactual: true })),
        ],
        employeeDocuments: (freshData.employeeDocuments ?? []).map((d: any) => ({
          id: d.id,
          _localId: String(d.id ?? uid()),
          name: d.name ?? "",
          category: d.category ?? "Other",
          description: d.description ?? "",
          issuedDate: d.issuedDate ?? "",
          expiryDate: d.expiryDate ?? "",
          fileUrl: d.fileUrl ?? "",
          fileName: d.fileName ?? "",
          fileMimeType: d.fileMimeType ?? "",
          fileSize: Number(d.fileSize ?? 0),
        })),
        empLeavePolicyForm: (freshData.empLeavePolicy ?? []).map((d: any) => ({ id: d.id, _localId: uid(), leavePolicyID: d.leavePolicyID ?? null, _lpAutocomplete: d.leavePolicy?.leavePolicyName ?? "", effectFrom: d.effectFrom ?? "" })),
        empAttendancePolicyForm: [
          ...(freshData.empAttendancePolicy ?? []).map((d: any) => ({ id: d.id, _localId: uid(), attendancePolicyID: d.attendancePolicyID ?? null, _apAutocomplete: d.attendancePolicy?.attendancePolicyName ?? "", effectFrom: d.effectFrom ?? "", _isFactual: false })),
          ...(freshData.empFactualAttendancePolicy ?? []).map((d: any) => ({ id: d.id, _localId: uid(), attendancePolicyID: d.factualAttendancePolicyID ?? null, _apAutocomplete: d.factualAttendancePolicy?.attendancePolicyName ?? '', effectFrom: d.effectFrom ?? "", _isFactual: true })),
        ],
        empContractorForm: (freshData.empContractor ?? []).map((d: any) => ({ id: d.id, _localId: uid(), contractorID: d.contractorID ?? null, _contrAutocomplete: d.contractor?.contractorName ?? "", effectFrom: d.effectFrom ?? "" })),
      });

      // Set token device mapping state
      setTokenDevMapForm(tokenDevMapForm);
      setOriginalTokenDevMapIds(tokenDevMapForm.filter(x => x.id != null).map(x => x.id!));

      // Set token verifier device mapping state
      setTokenVerifierDevMapForm(tokenVerifierDevMapFormData);
      setOriginalTokenVerifierDevMapIds(tokenVerifierDevMapFormData.filter(x => x.id != null).map(x => x.id!));

      // Async calls for monthly/hourly pay grades
      (async () => {
        const mpId = freshData.monthlyPayGradeID ?? null;
        const hpId = freshData.hourlyPayGradeID ?? null;
        if (mpId) {
          const m = await fetchFirstById<MonthlyPG>(API.monthlyGrades, mpId);
          setFormData((p) => ({ ...p, monthlyPGAutocomplete: m?.monthlyPayGradeName ?? String(mpId) }));
        }
        if (hpId) {
          const h = await fetchFirstById<HourlyPG>(API.hourlyGrades, hpId);
          setFormData((p) => ({ ...p, hourlyPGAutocomplete: h?.hourlyPayGradeName ?? String(hpId) }));
        }
      })();

      resolveLabelsForEdit({
        ...freshData,
        departmentNameID: effectiveDeptID,
        designationID: effectiveDesgID,
        contractorID: freshData.contractorID,
        attendancePolicyID: effectiveAttendancePolicyID,
        leavePolicyID: effectiveLeavePolicyID,
        workShiftID: effectiveWorkShiftID,
      } as any, setFormData);

      // Set original IDs for deletion tracking
      setOriginalEduIds(eduForm.filter(x => x.id != null).map(x => x.id!));
      setOriginalExpIds(expForm.filter(x => x.id != null).map(x => x.id!));
      setOriginalDevMapIds(devMapForm.filter(x => x.id != null).map(x => x.id!));
      setOriginalBankDetailIds(bankDetailsForm.filter(x => x.id != null).map(x => x.id!));
      setOriginalEmpDesignationIds(empDesignationForm.filter(x => x.id != null).map(x => x.id!));

      // Set original IDs for junction table deletion tracking
      const empBranchForm = (freshData.empBranch ?? []).map((d: any) => d);
      const empDepartmentForm2 = (freshData.empDepartment ?? []).map((d: any) => d);
      const empEmploymentTypeForm = (freshData.empEmploymentType ?? []).map((d: any) => d);
      const empEmploymentStatusForm = (freshData.empEmploymentStatus ?? []).map((d: any) => d);
      const empWorkShiftForm = (freshData.empWorkShift ?? []).map((d: any) => d);
      const empAttendancePolicyForm = (freshData.empAttendancePolicy ?? []).map((d: any) => d);
      const empLeavePolicyForm = (freshData.empLeavePolicy ?? []).map((d: any) => d);
      const empContractorForm = (freshData.empContractor ?? []).map((d: any) => d);
      setOriginalEmpBranchIds(empBranchForm.filter((x: any) => x.id != null).map((x: any) => x.id));
      setOriginalEmpDepartmentIds(empDepartmentForm2.filter((x: any) => x.id != null).map((x: any) => x.id));
      setOriginalEmpEmploymentTypeIds(empEmploymentTypeForm.filter((x: any) => x.id != null).map((x: any) => x.id));
      setOriginalEmpEmploymentStatusIds(empEmploymentStatusForm.filter((x: any) => x.id != null).map((x: any) => x.id));
      setOriginalEmpWorkShiftIds(empWorkShiftForm.filter((x: any) => x.id != null && !x._isFactual).map((x: any) => x.id));
      setOriginalEmpAttendancePolicyIds(empAttendancePolicyForm.filter((x: any) => x.id != null && !x._isFactual).map((x: any) => x.id));
      setOriginalEmpFactualWorkShiftIds((freshData.empFactualWorkShift ?? []).filter((x: any) => x.id != null).map((x: any) => x.id));
      setOriginalEmpFactualAttendancePolicyIds((freshData.empFactualAttendancePolicy ?? []).filter((x: any) => x.id != null).map((x: any) => x.id));
      setOriginalEmpLeavePolicyIds(empLeavePolicyForm.filter((x: any) => x.id != null).map((x: any) => x.id));
      setOriginalEmpContractorIds(empContractorForm.filter((x: any) => x.id != null).map((x: any) => x.id));

      // Load linked employees
      try {
        const linkedRes = await fetch(`${API.manageEmp}/${r.id}/linked-employees`);
        if (linkedRes.ok) {
          const linkedData = await linkedRes.json();
          setLinkedEmployees(linkedData || []);
        } else {
          setLinkedEmployees([]);
        }
      } catch {
        setLinkedEmployees([]);
      }

      setPhotoFile(null);
      setPhotoPreview(null);

    } catch (error) {
      console.error('Failed to fetch employee data:', error);
      setError('Failed to load employee data for editing');
    }
  };


  const downloadJoiningForm = async (r: ManageEmpRead) => {
    try {
      const res = await fetch(`${API.manageEmp}/${r.id}/joining-form`, { cache: "no-store" });
      if (!res.ok) {
        const errText = await res.text();
        let msg = errText;
        try {
          const j = JSON.parse(errText) as { message?: string };
          if (j.message) msg = j.message;
        } catch {
          /* plain text */
        }
        throw new Error(msg);
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/pdf")) {
        throw new Error("Server did not return a PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `JoiningForm-${r.employeeID ?? r.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Joining form downloaded");
    } catch {
      toast.error("Could not download joining form");
    }
  };

  const handleView = async (r: ManageEmpRead) => {
    try {
      const res = await fetch(`${API.manageEmp}/${r.id}`, {
        headers: authHeaders(),
        cache: "no-store",
      });

      const fresh = res.ok ? await res.json() : r;

      setViewRow(fresh?.data ?? fresh);
      setIsViewing(true);
      setIsAddingNew(false);
    } catch {
      setViewRow(r);
      setIsViewing(true);
      setIsAddingNew(false);
    }
  };

  const handleDelete = async (id: ID) => {
    if (!confirm("Delete this employee?")) return;
    try {
      const res = await fetch(`${API.manageEmp}/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      clearRefCache();
      await fetchRows();
      toast.success("Employee deleted successfully");
      dispatchAppRefresh();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  const closeEmployeePagePanels = () => {
    resetForm();

    setIsAddingNew(false);
    setIsViewing(false);
    setEditingRow(null);
    setViewRow(null);

    setQuickAddOpen(null);
    setQuickAddValue("");
    setQuickAddSuggestions([]);

    setHistoryOpen(false);
    setHistoryData([]);
    setHistoryEmployee(null);

    setActiveFormSection("basic");
    setExpandedGroups({});

    setSpList([]);
    setCoList([]);
    setBrList([]);
    setDeptList([]);
    setDesgList([]);
    setContrList([]);
    setWsList([]);
    setApList([]);
    setLpList([]);
    setDevList([]);
    setTokenDevList([]);
    setTokenVerifierDevList([]);
    setCombinedDevList([]);
    setLinkedEmpSuggestions([]);
    setMonthlyPGList([]);
    setHourlyPGList([]);
  };

  const handleCancel = () => {
    closeEmployeePagePanels();
  };

  /* ==========
     Search
     ========== */

  const visibleDepartmentFilterList = useMemo(() => {
    if (branchFilter === "ALL") return departmentFilterList;
    return departmentFilterList.filter((d) => String(d.branchesID) === branchFilter);
  }, [departmentFilterList, branchFilter]);

  const visibleDesignationFilterList = useMemo(() => {
    let list = designationFilterList;
    if (branchFilter !== "ALL") {
      list = list.filter((d) => String(d.branchesID) === branchFilter);
    }
    if (departmentFilter !== "ALL") {
      list = list.filter((d) => String(d.departmentID) === departmentFilter);
    }
    return list;
  }, [designationFilterList, branchFilter, departmentFilter]);

  const branchFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All branches" },
      ...branchFilterList.map((b) => ({
        value: String(b.id),
        label: b.branchName || `Branch #${b.id}`,
      })),
    ],
    [branchFilterList],
  );

  const departmentFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All departments" },
      ...visibleDepartmentFilterList.map((d) => ({
        value: String(d.id),
        label: d.departmentName || `Department #${d.id}`,
      })),
    ],
    [visibleDepartmentFilterList],
  );

  const designationFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All designations" },
      ...visibleDesignationFilterList.map((d) => ({
        value: String(d.id),
        label: d.designation || `Designation #${d.id}`,
      })),
    ],
    [visibleDesignationFilterList],
  );

  const filteredRows = useMemo(() => {
    const t = table.search.trim().toLowerCase();

    let list = rows.filter((r) => {
      const matchesBranch =
        branchFilter === "ALL" ||
        branchFilter === String(r.branchesID ?? r.branches?.id ?? "");

      const matchesDepartment =
        departmentFilter === "ALL" ||
        departmentFilter === String(r.departmentNameID ?? r.departments?.id ?? "");

      const matchesDesignation =
        designationFilter === "ALL" ||
        designationFilter === String(r.designationID ?? r.designations?.id ?? "");

      const matchesSearch =
        !t ||
        [
          r.employeeFirstName,
          r.employeeLastName,
          r.employeeID,
          r.businessEmail,
          spName(r),
          contrName(r),
          coName(r),
          brName(r),
          r.departments?.departmentName,
          r.designations?.designation,
        ]
          .filter(Boolean)
          .map((x) => String(x ?? "").toLowerCase())
          .some((f) => f.includes(t));

      return matchesBranch && matchesDepartment && matchesDesignation && matchesSearch;
    });

    return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
      const r = row as ManageEmpRead;
      if (key === "name") return `${r.employeeFirstName ?? ""} ${r.employeeLastName ?? ""}`.trim();
      if (key === "designation") {
        return (r as any).empDesignation?.length > 0
          ? (r as any).empDesignation.map((d: any) => d.designation?.designation).filter(Boolean).join(", ")
          : r.designations?.designation ?? "";
      }
      if (key === "department") return r.departments?.departmentName ?? "";
      if (key === "branch") return brName(r);
      if (key === "employmentType") return r.employmentType ?? r.typeOfEmployee ?? "";
      if (key === "employmentStatus") return r.employmentStatus ?? "";
      return "";
    });
  }, [
    rows,
    table.search,
    table.sortBy,
    table.sortDir,
    branchFilter,
    departmentFilter,
    designationFilter,
  ]);

  /* ==========
     UI Render
     ========== */

  const employeeColumns = useMemo((): DataTableColumn<ManageEmpRead>[] => [
    {
      key: "name",
      header: "Name",
      sortable: true,
      colSpan: 3,
      cell: (r) => (
        <div className="flex flex-col gap-0.5">
          <span>{r.employeeFirstName} {r.employeeLastName}</span>
          {terminationMap[r.id] && terminationMap[r.id].daysLeft > 0 && (
            <Badge className="bg-orange-100 text-orange-700 border border-orange-300 text-xs w-fit">
              Offboarding: Inactive in {terminationMap[r.id].daysLeft} day{terminationMap[r.id].daysLeft !== 1 ? "s" : ""}
            </Badge>
          )}
          {terminationMap[r.id] && terminationMap[r.id].daysLeft <= 0 && (
            <Badge className="bg-gray-200 text-gray-600 border border-gray-400 text-xs w-fit">
              Inactive
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "designation",
      header: "Designation",
      sortable: true,
      colSpan: 2,
      cell: (r) =>
        (r as any).empDesignation?.length > 0
          ? (r as any).empDesignation.map((d: any) => d.designation?.designation).filter(Boolean).join(", ") || r.designations?.designation || "—"
          : r.designations?.designation ?? "—",
    },
    {
      key: "department",
      header: "Department",
      sortable: true,
      colSpan: 2,
      cell: (r) => r.departments?.departmentName ?? "—",
    },
    {
      key: "branch",
      header: "Branch",
      sortable: true,
      colSpan: 2,
      cell: (r) => brName(r),
    },
    {
      key: "employmentType",
      header: "Employment Type",
      sortable: true,
      colSpan: 2,
      cell: (r) => r.employmentType ?? (r.typeOfEmployee ? r.typeOfEmployee.charAt(0).toUpperCase() + r.typeOfEmployee.slice(1) : "—"),
    },
    {
      key: "employmentStatus",
      header: "Employment Status",
      sortable: true,
      colSpan: 2,
      cell: (r) => r.employmentStatus ?? "—",
    },
    {
      key: "actions",
      header: "Actions",
      colSpan: 3,
      align: "right",
      cell: (r) => (
        <EntityRowActions
          onView={() => handleView(r)}
          onEdit={canManage ? () => handleEdit(r) : undefined}
          onDelete={canManage ? () => handleDelete(r.id) : undefined}
          extra={[
            ...(canManage
              ? [{
                icon: Key,
                title: "Generate / Edit Credentials",
                onClick: () => openCredentialModal(r),
                className: "text-orange-600",
              }]
              : []),
            {
              icon: History,
              title: "History",
              onClick: () => handleViewHistory(r),
              className: "text-blue-600",
            },
          ]}
        />
      ),
    },
  ], [canManage, terminationMap]);


  const dash = displayValue;

  const fullName = (r: ManageEmpRead) =>
    [r.employeeFirstName, r.employeeLastName].filter(Boolean).join(" ") || "—";

  const latestBranch = (r: any) =>
    r.empBranch?.length
      ? r.empBranch[r.empBranch.length - 1]?.branch?.branchName
      : r.branches?.branchName ?? r.branchName;

  const latestDepartment = (r: any) =>
    r.empDepartment?.length
      ? r.empDepartment[r.empDepartment.length - 1]?.department?.departmentName
      : r.departments?.departmentName;

  const latestDesignation = (r: any) =>
    r.empDesignation?.length
      ? r.empDesignation[r.empDesignation.length - 1]?.designation?.designation
      : r.designations?.designation;

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={Users}
        title="Employees"
        description="Create, read, update and delete employees"
        actions={
          !isAddingNew && !isViewing && canManage ? (
            <Button onClick={() => { resetForm(); setIsAddingNew(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Add Employee
            </Button>
          ) : null
        }
      />

      {/* Add/Edit Form - Drawer */}
      <FormDrawer
        open={isAddingNew}
        onOpenChange={(v) => { if (!v) handleCancel(); }}
        title={editingRow ? "Edit Employee" : "Add New Employee"}
        showHeaderCancel
      >
        <div>
          {error && (
            <NoticeBanner variant="error" compact className="mb-4">
              {error}
            </NoticeBanner>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <EmployeeFormSectionNav
              active={activeFormSection}
              onChange={setActiveFormSection}
              sections={formSections}
            />

            {/* SP / Company / Branch (autocomplete) */}
            <div className="grid grid-cols-1 gap-6">
              {/* SP/Company - auto-filled from sidebar */}
              {false && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* SERVICE PROVIDER — visible only for SUPERADMIN */}
                  {user?.role === "SUPERADMIN" && (
                    <div ref={spRef} className="space-y-2 relative">
                      <Label>Service Provider *</Label>
                      <Input
                        value={formData.spAutocomplete}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((p) => ({ ...p, spAutocomplete: val, serviceProviderID: null }));
                          runFetchSP(val);
                        }}
                        onFocus={(e) => { runFetchSP(e.target.value); }}
                        placeholder="Start typing service provider…"
                        autoComplete="off"
                      />

                      {spList.length > 0 && (
                        <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                          {spLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                          {spList.map((sp) => (
                            <div
                              key={sp.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setFormData((p) => ({
                                  ...p,
                                  serviceProviderID: sp.id,
                                  spAutocomplete: sp.companyName ?? "",
                                }));
                                setSpList([]);
                              }}
                            >
                              {sp.companyName}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* COMPANY — visible only for SUPERADMIN */}
                  {user?.role === "SUPERADMIN" && (
                    <div ref={coRef} className="space-y-2 relative">
                      <Label>Company *</Label>
                      <Input
                        value={formData.coAutocomplete}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((p) => ({ ...p, coAutocomplete: val, companyID: null }));
                          runFetchCO(val);
                        }}
                        onFocus={(e) => { runFetchCO(e.target.value); }}
                        placeholder="Start typing company…"
                        autoComplete="off"
                      />

                      {coList.length > 0 && (
                        <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                          {coLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                          {coList.map((co) => (
                            <div
                              key={co.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setFormData((p) => ({
                                  ...p,
                                  companyID: co.id,
                                  coAutocomplete: co.companyName ?? "",
                                }));
                                setCoList([]);
                              }}
                            >
                              {co.companyName}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>

            {activeFormSection === "basic" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.employeeFirstName}
                      onChange={(e) => setFormData((p) => ({ ...p, employeeFirstName: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.employeeLastName}
                      onChange={(e) => setFormData((p) => ({ ...p, employeeLastName: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employee ID <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.employeeID}
                      onChange={(e) => setFormData((p) => ({ ...p, employeeID: e.target.value }))}
                      required
                    />
                  </div>
                  {!isAdmin && (
                    <MultiValueField
                      label="Mobile No."
                      values={formData.personalPhones}
                      onChange={(personalPhones) =>
                        setFormData((p) => ({
                          ...p,
                          personalPhones,
                          personalPhoneNo: primaryMultiValue(personalPhones),
                        }))
                      }
                      placeholder="Used as employee login username"
                      required
                    />
                  )}
                  {(isCompanyAdmin || isBranchAdmin || isSuperAdmin || (!isCompanyAdmin && !isBranchAdmin && !isSuperAdmin && !isAdmin)) && (
                    <MultiValueField
                      label="Email ID"
                      type="email"
                      values={formData.personalEmails}
                      onChange={(personalEmails) =>
                        setFormData((p) => ({
                          ...p,
                          personalEmails,
                          personalEmail: primaryMultiValue(personalEmails),
                        }))
                      }
                      placeholder="employee@example.com"
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select
                      value={formData.gender || ""}
                      onValueChange={(val) => setFormData((p) => ({ ...p, gender: val }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select gender…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Transgender">Transgender</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Photo</Label>
                    <Input
                      key={documentInputKey}
                      type="file"
                      accept="image/*"
                      onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
                    />
                    {photoPreview ? (
                      <img src={photoPreview} className="h-20 w-20 rounded object-cover mt-2" alt="preview" />
                    ) : formData.employeePhotoUrl ? (
                      <img src={formData.employeePhotoUrl} className="h-20 w-20 rounded object-cover mt-2" alt="photo" />
                    ) : null}
                  </div>
                </div>

                <CollapsibleFormGroup
                  title="Identity & address"
                  expanded={isGroupExpanded("basic-identity")}
                  onToggle={() => toggleFormGroup("basic-identity")}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Aadhaar No.</Label>
                      <Input
                        value={formData.aadharNo}
                        onChange={(e) => setFormData((p) => ({ ...p, aadharNo: e.target.value.replace(/\D/g, "").slice(0, 12) }))}
                        placeholder="12-digit Aadhaar"
                        inputMode="numeric"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>PAN No.</Label>
                      <Input
                        value={formData.panNo}
                        onChange={(e) => setFormData((p) => ({ ...p, panNo: e.target.value.toUpperCase().slice(0, 10) }))}
                        placeholder="ABCDE1234F"
                        maxLength={10}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Present Address</Label>
                      <Textarea
                        value={formData.presentAddress}
                        onChange={(e) => setFormData((p) => ({ ...p, presentAddress: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Permanent Address</Label>
                      <Textarea
                        value={formData.permenantAddress}
                        onChange={(e) => setFormData((p) => ({ ...p, permenantAddress: e.target.value }))}
                        rows={3}
                      />
                    </div>
                  </div>
                  <MultiValueField
                    label="Emergency Contact No."
                    values={formData.emergencyContacts}
                    onChange={(emergencyContacts) =>
                      setFormData((p) => ({
                        ...p,
                        emergencyContacts,
                        emergancyContact: primaryMultiValue(emergencyContacts),
                      }))
                    }
                  />
                </CollapsibleFormGroup>

                <CollapsibleFormGroup
                  title="Family & personal"
                  expanded={isGroupExpanded("basic-family")}
                  onToggle={() => toggleFormGroup("basic-family")}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date of Birth</Label>
                      <Input
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => setFormData((p) => ({ ...p, dateOfBirth: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Blood Group</Label>
                      <Input
                        value={formData.bloodGroup}
                        onChange={(e) => setFormData((p) => ({ ...p, bloodGroup: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Father Name</Label>
                      <Input
                        value={formData.employeeFatherName}
                        onChange={(e) => setFormData((p) => ({ ...p, employeeFatherName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mother Name</Label>
                      <Input
                        value={formData.employeeMotherName}
                        onChange={(e) => setFormData((p) => ({ ...p, employeeMotherName: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Marital Status</Label>
                      <Select
                        value={formData.maritalStatus || ""}
                        onValueChange={(val) =>
                          setFormData((p) => ({
                            ...p,
                            maritalStatus: val,
                            ...(val !== "Married" ? { employeeSpouseName: "", numberOfChildren: "" } : {}),
                          }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select marital status…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Single">Single</SelectItem>
                          <SelectItem value="Married">Married</SelectItem>
                          <SelectItem value="Divorcee">Divorcee</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.maritalStatus === "Married" && (
                      <>
                        <div className="space-y-2">
                          <Label>Spouse Name</Label>
                          <Input
                            value={formData.employeeSpouseName}
                            onChange={(e) => setFormData((p) => ({ ...p, employeeSpouseName: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>No. of Children</Label>
                          <Input
                            type="number"
                            min={0}
                            value={formData.numberOfChildren}
                            onChange={(e) => setFormData((p) => ({ ...p, numberOfChildren: e.target.value }))}
                            placeholder="0"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </CollapsibleFormGroup>

              </div>
            )}

            {activeFormSection === "employment" && (
              <div className="space-y-4">
                {!isAdmin && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date of Joining <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        value={formData.joiningDate}
                        onChange={(e) => setFormData((p) => ({ ...p, joiningDate: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                )}


                {/* Branch - Search & Add with History */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Branch *</h3>
                    {canManage && <Button type="button" variant="outline" size="sm" onClick={() => window.open('/branches', '_blank')}><Plus className="w-4 h-4 mr-1" /> Manage Branches</Button>}
                  </div>
                  <div className="flex items-end gap-2">
                    <div ref={brRef} className="flex-1 space-y-2 relative">
                      <Label>Branch Name</Label>
                      <Input
                        value={stagingBranch.label}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStagingBranch(p => ({ ...p, label: val, branchesID: null }));
                          runFetchBR(val);
                        }}
                        onFocus={(e) => {
                          if (e.target.value.length >= MIN_CHARS) runFetchBR(e.target.value);
                        }}
                        placeholder="Search branch…"
                        autoComplete="off"
                      />
                      {brList.length > 0 && (
                        <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                          {brLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                          {brList.map((br) => (
                            <div key={br.id} className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onMouseDown={(e) => e.preventDefault()} onClick={() => {
                              setStagingBranch(p => ({ ...p, branchesID: br.id, label: br.branchName ?? "" }));
                              if (user?.role === "SERVICE_PROVIDER") {
                                setFormData((p) => ({ ...p, companyID: br.companyID ?? p.companyID, serviceProviderID: br.serviceProviderID ?? p.serviceProviderID }));
                              }
                              setBrList([]);
                            }}>{br.branchName}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>WEF</Label>
                      <Input type="date" value={stagingBranch.effectFrom} onChange={(e) => setStagingBranch(p => ({ ...p, effectFrom: e.target.value }))} />
                    </div>
                    <Button type="button" size="sm" disabled={!stagingBranch.branchesID} onClick={() => {
                      if (!stagingBranch.branchesID) return;
                      const newEntry: EmpBranchForm = { _localId: uid(), branchesID: stagingBranch.branchesID, _brAutocomplete: stagingBranch.label, effectFrom: stagingBranch.effectFrom };
                      setFormData(p => {
                        const updated = upsertHistoryEntry(p.empBranchForm, newEntry, (item) => item.branchesID === newEntry.branchesID);
                        const last = updated[updated.length - 1];
                        return { ...p, empBranchForm: updated, branchesID: last?.branchesID ?? null, brAutocomplete: last?._brAutocomplete ?? "" };
                      });
                      setStagingBranch({ branchesID: null, label: "", effectFrom: today });
                    }}>Add</Button>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide flex">
                      <span className="flex-1">Branch</span><span className="w-32 text-center">WEF</span><span className="w-10"></span>
                    </div>
                    {formData.empBranchForm.length === 0 ? (
                      <div className="text-center py-4 text-gray-400 text-sm">No branches added</div>
                    ) : (
                      formData.empBranchForm.map((eb, i) => (
                        <div key={eb._localId} className={`flex items-center px-3 py-2 text-sm ${i === formData.empBranchForm.length - 1 ? 'bg-blue-50 font-medium' : 'bg-white'} ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                          <span className="flex-1">{eb._brAutocomplete || '—'}</span>
                          <span className="w-32 text-center text-gray-500">{eb.effectFrom || '—'}</span>
                          {<Button type="button" variant="ghost" size="sm" onClick={() => removeEmpBranch(eb._localId)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"><X className="w-3 h-3" /></Button>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Department - Search & Add with History (visible for all roles including COMPANY_ADMIN) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Department</h3>
                    {canManage && <Button type="button" variant="outline" size="sm" onClick={() => { setQuickAddOpen('department'); setQuickAddValue(''); setQuickAddSuggestions([]); }}><Plus className="w-4 h-4 mr-1" /> Quick Add</Button>}
                  </div>
                  <div className="flex items-end gap-2">
                    <div ref={deptRef} className="flex-1 space-y-2 relative">
                      <Label>Department Name</Label>
                      <Input
                        value={stagingDept.label}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStagingDept(p => ({ ...p, label: val, departmentNameID: null }));
                          runFetchDept(val);
                        }}
                        onFocus={(e) => { if (e.target.value.length >= MIN_CHARS) runFetchDept(e.target.value); }}
                        placeholder="Search department…"
                        autoComplete="off"
                      />
                      {deptList.length > 0 && (
                        <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                          {deptLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                          {deptList.map((d) => (
                            <div key={d.id} className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onMouseDown={(e) => e.preventDefault()} onClick={() => {
                              setStagingDept(p => ({ ...p, departmentNameID: d.id, label: d.departmentName ?? String(d.id) }));
                              setStagingDesg({ designationID: null, label: "", effectFrom: stagingDept.effectFrom || defaultEffectFrom() });
                              setDesgList([]);
                              setDeptList([]);
                            }}>{d.departmentName}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>WEF</Label>
                      <Input type="date" value={stagingDept.effectFrom} onChange={(e) => setStagingDept(p => ({ ...p, effectFrom: e.target.value }))} />
                    </div>
                    <Button type="button" size="sm" disabled={!stagingDept.departmentNameID} onClick={() => {
                      if (!stagingDept.departmentNameID) return;
                      const newEntry: EmpDepartmentForm = { _localId: uid(), departmentNameID: stagingDept.departmentNameID, _deptAutocomplete: stagingDept.label, effectFrom: stagingDept.effectFrom };
                      setFormData(p => {
                        const updated = upsertHistoryEntry(p.empDepartmentForm, newEntry, (item) => item.departmentNameID === newEntry.departmentNameID);
                        const last = updated[updated.length - 1];
                        return { ...p, empDepartmentForm: updated, departmentNameID: last?.departmentNameID ?? null, deptAutocomplete: last?._deptAutocomplete ?? "", promotion: { ...p.promotion, departmentNameID: last?.departmentNameID ?? null } };
                      });
                      setStagingDept({ departmentNameID: null, label: "", effectFrom: defaultEffectFrom() });
                      setStagingDesg({ designationID: null, label: "", effectFrom: defaultEffectFrom() });
                      setDesgList([]);
                    }}>Add</Button>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide flex">
                      <span className="flex-1">Department</span><span className="w-32 text-center">WEF</span><span className="w-10"></span>
                    </div>
                    {formData.empDepartmentForm.length === 0 ? (
                      <div className="text-center py-4 text-gray-400 text-sm">No departments added</div>
                    ) : (
                      formData.empDepartmentForm.map((ed, i) => (
                        <div key={ed._localId} className={`flex items-center px-3 py-2 text-sm ${i === formData.empDepartmentForm.length - 1 ? 'bg-blue-50 font-medium' : 'bg-white'} ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                          <span className="flex-1">{ed._deptAutocomplete || '—'}</span>
                          <span className="w-32 text-center text-gray-500">{ed.effectFrom || '—'}</span>
                          {<Button type="button" variant="ghost" size="sm" onClick={() => removeEmpDepartment(ed._localId)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"><X className="w-3 h-3" /></Button>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Designation - for COMPANY_ADMIN and above (not ADMIN) */}
                {!isAdmin && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Designation</h3>
                      {canManage && <Button type="button" variant="outline" size="sm" onClick={() => { setQuickAddOpen('designation'); setQuickAddValue(''); setQuickAddSuggestions([]); }}><Plus className="w-4 h-4 mr-1" /> Quick Add</Button>}
                    </div>
                    <div className="flex items-end gap-2">
                      <div ref={desgRef} className="flex-1 space-y-2 relative">
                        <Label>Designation Name</Label>
                        {!getActiveDepartmentId() && (
                          <p className="text-xs text-amber-600">Select a department first to load matching designations.</p>
                        )}
                        <Input
                          value={stagingDesg.label}
                          disabled={!getActiveDepartmentId()}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStagingDesg(p => ({ ...p, label: val, designationID: null }));
                            runFetchDesg(val);
                          }}
                          onFocus={(e) => { if (getActiveDepartmentId() && e.target.value.length >= MIN_CHARS) runFetchDesg(e.target.value); }}
                          placeholder={getActiveDepartmentId() ? "Search designation…" : "Select department first"}
                          autoComplete="off"
                        />
                        {desgList.length > 0 && (
                          <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                            {desgLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                            {desgList.map((d) => (
                              <div key={d.id} className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onMouseDown={(e) => e.preventDefault()} onClick={() => {
                                setStagingDesg(p => ({ ...p, designationID: d.id, label: d.designation ?? String(d.id) }));
                                setDesgList([]);
                              }}>{d.designation}</div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>WEF</Label>
                        <Input type="date" value={stagingDesg.effectFrom} onChange={(e) => setStagingDesg(p => ({ ...p, effectFrom: e.target.value }))} />
                      </div>
                      <Button type="button" size="sm" disabled={!stagingDesg.designationID} onClick={() => {
                        if (!stagingDesg.designationID) return;
                        const newEntry: EmpDesignationForm = { _localId: uid(), designationID: stagingDesg.designationID, _desgAutocomplete: stagingDesg.label, effectFrom: stagingDesg.effectFrom };
                        setFormData(p => ({
                          ...p,
                          empDesignationForm: upsertHistoryEntry(p.empDesignationForm, newEntry, (item) => item.designationID === newEntry.designationID),
                        }));
                        setStagingDesg({ designationID: null, label: "", effectFrom: defaultEffectFrom() });
                      }}>Add</Button>
                    </div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide flex">
                        <span className="flex-1">Designation</span><span className="w-32 text-center">WEF</span><span className="w-10"></span>
                      </div>
                      {formData.empDesignationForm.length === 0 ? (
                        <div className="text-center py-4 text-gray-400 text-sm">No designations added</div>
                      ) : (
                        formData.empDesignationForm.map((ed, i) => (
                          <div key={ed._localId} className={`flex items-center px-3 py-2 text-sm ${i === formData.empDesignationForm.length - 1 ? 'bg-blue-50 font-medium' : 'bg-white'} ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                            <span className="flex-1">{ed._desgAutocomplete || '—'}</span>
                            <span className="w-32 text-center text-gray-500">{ed.effectFrom || '—'}</span>
                            {<Button type="button" variant="ghost" size="sm" onClick={() => removeEmpDesignation(ed._localId)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"><X className="w-3 h-3" /></Button>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Manager - Multi-entry repeater */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Manager</h3>
                    <Button variant="outline" size="sm" type="button" onClick={() => { setShowManagerSearch(true); setLinkedEmpSearch(""); setLinkedEmpSuggestions([]); }}>
                      <Plus className="w-4 h-4 mr-1" /> Add Manager
                    </Button>
                  </div>
                  {linkedEmployees.length === 0 && !showManagerSearch && (
                    <div className="text-center py-6 text-gray-500 border border-gray-200 rounded-lg">
                      <Icon icon="mdi:account-supervisor" className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p>No managers added yet</p>
                    </div>
                  )}
                  {linkedEmployees.map((le) => {
                    const name = `${le.employeeFirstName ?? ""} ${le.employeeLastName ?? ""}`.trim() || `#${le.id}`;
                    return (
                      <div key={le.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{name}</span>
                          {<Button type="button" variant="ghost" size="sm" onClick={() => removeLinkedEmployee(le.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50"><X className="w-4 h-4" /></Button>}
                        </div>
                      </div>
                    );
                  })}
                  {showManagerSearch && (
                    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">Manager</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setShowManagerSearch(false); setLinkedEmpSearch(""); setLinkedEmpSuggestions([]); }} className="text-red-600 hover:text-red-700 hover:bg-red-50"><X className="w-4 h-4" /></Button>
                      </div>
                      <div ref={linkedEmpRef} className="space-y-2 relative">
                        <Label>Search Manager</Label>
                        <Input
                          value={linkedEmpSearch}
                          onChange={(e) => {
                            setLinkedEmpSearch(e.target.value);
                            runFetchLinkedEmpSuggestions(e.target.value);
                          }}
                          onFocus={() => {
                            runFetchLinkedEmpSuggestions(linkedEmpSearch);
                          }}
                          placeholder="Search managers to add..."
                          autoComplete="off"
                        />
                        {linkedEmpSuggestions.length > 0 && (
                          <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                            {linkedEmpLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                            {linkedEmpSuggestions.map((m) => {
                              const full = `${m.employeeFirstName ?? ""} ${m.employeeLastName ?? ""}`.trim() || `#${m.id}`;
                              return (
                                <div
                                  key={m.id}
                                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => addLinkedEmployee(m)}
                                >
                                  {full}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {!isAdmin && (
                  <>
                    {/* Employment Type - Search & Add with History */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Employment Type</h3>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-2">
                          <Label>Type</Label>
                          <Select value={stagingET.employmentType || ""} onValueChange={(val) => setStagingET(p => ({ ...p, employmentType: val }))}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Select employment type…" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Company">Company</SelectItem>
                              <SelectItem value="Contract">Contract</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>WEF</Label>
                          <Input type="date" value={stagingET.effectFrom} onChange={(e) => setStagingET(p => ({ ...p, effectFrom: e.target.value }))} />
                        </div>
                        <Button type="button" size="sm" disabled={!stagingET.employmentType} onClick={addEmpEmploymentType}>Add</Button>
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide flex">
                          <span className="flex-1">Employment Type</span><span className="w-32 text-center">WEF</span><span className="w-10"></span>
                        </div>
                        {formData.empEmploymentTypeForm.length === 0 ? (
                          <div className="text-center py-4 text-gray-400 text-sm">No employment type entries added</div>
                        ) : (
                          formData.empEmploymentTypeForm.map((et, i) => (
                            <div key={et._localId} className={`flex items-center px-3 py-2 text-sm ${i === formData.empEmploymentTypeForm.length - 1 ? 'bg-blue-50 font-medium' : 'bg-white'} ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                              <span className="flex-1">{et.employmentType || '—'}</span>
                              <span className="w-32 text-center text-gray-500">{et.effectFrom || '—'}</span>
                              {<Button type="button" variant="ghost" size="sm" onClick={() => removeEmpEmploymentType(et._localId)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"><X className="w-3 h-3" /></Button>}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Contractor - Search & Add with History */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Contractor</h3>
                        {canManage && <Button type="button" variant="outline" size="sm" onClick={() => { setQuickAddOpen('contractor'); setQuickAddValue(''); setQuickAddSuggestions([]); }}><Plus className="w-4 h-4 mr-1" /> Quick Add</Button>}
                      </div>
                      <div className="flex items-end gap-2">
                        <div ref={contrRef} className="flex-1 space-y-2 relative">
                          <Label>Contractor Name</Label>
                          <Input
                            value={stagingContr.label}
                            onChange={(e) => {
                              const val = e.target.value;
                              setStagingContr(p => ({ ...p, label: val, contractorID: null }));
                              runFetchContr(val);
                            }}
                            onFocus={(e) => { if (e.target.value.length >= MIN_CHARS) runFetchContr(e.target.value); }}
                            placeholder="Search contractor…"
                            autoComplete="off"
                          />
                          {contrList.length > 0 && (
                            <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                              {contrLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                              {contrList.map((c) => (
                                <div key={c.id} className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onMouseDown={(e) => e.preventDefault()} onClick={() => {
                                  setStagingContr(p => ({ ...p, contractorID: c.id, label: c.contractorName ?? String(c.id) }));
                                  setContrList([]);
                                }}>{c.contractorName}</div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>WEF</Label>
                          <Input type="date" value={stagingContr.effectFrom} onChange={(e) => setStagingContr(p => ({ ...p, effectFrom: e.target.value }))} />
                        </div>
                        <Button type="button" size="sm" disabled={!stagingContr.contractorID} onClick={() => {
                          if (!stagingContr.contractorID) return;
                          const newEntry: EmpContractorForm = { _localId: uid(), contractorID: stagingContr.contractorID, _contrAutocomplete: stagingContr.label, effectFrom: stagingContr.effectFrom };
                          setFormData(p => ({
                            ...p,
                            empContractorForm: upsertHistoryEntry(p.empContractorForm, newEntry, (item) => item.contractorID === newEntry.contractorID),
                          }));
                          setStagingContr({ contractorID: null, label: "", effectFrom: today });
                        }}>Add</Button>
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide flex">
                          <span className="flex-1">Contractor</span><span className="w-32 text-center">WEF</span><span className="w-10"></span>
                        </div>
                        {formData.empContractorForm.length === 0 ? (
                          <div className="text-center py-4 text-gray-400 text-sm">No contractors added</div>
                        ) : (
                          formData.empContractorForm.map((ec, i) => (
                            <div key={ec._localId} className={`flex items-center px-3 py-2 text-sm ${i === formData.empContractorForm.length - 1 ? 'bg-blue-50 font-medium' : 'bg-white'} ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                              <span className="flex-1">{ec._contrAutocomplete || '—'}</span>
                              <span className="w-32 text-center text-gray-500">{ec.effectFrom || '—'}</span>
                              {<Button type="button" variant="ghost" size="sm" onClick={() => removeEmpContractor(ec._localId)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"><X className="w-3 h-3" /></Button>}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Employment Status - Search & Add with History */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Employment Status</h3>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-2">
                          <Label>Status</Label>
                          <Select value={stagingES.employmentStatus || ""} onValueChange={(val) => setStagingES(p => ({ ...p, employmentStatus: val }))}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Select status…" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Trainee">Trainee</SelectItem>
                              <SelectItem value="Probation">Probation</SelectItem>
                              <SelectItem value="Permanent">Permanent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {stagingES.employmentStatus === "Probation" && (
                          <div className="space-y-2">
                            <Label>Probation Period</Label>
                            <Input value={stagingES.probationPeriod} onChange={(e) => setStagingES(p => ({ ...p, probationPeriod: e.target.value }))} placeholder="e.g. 6 months" />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>WEF</Label>
                          <Input type="date" value={stagingES.effectFrom} onChange={(e) => setStagingES(p => ({ ...p, effectFrom: e.target.value }))} />
                        </div>
                        <Button type="button" size="sm" disabled={!stagingES.employmentStatus} onClick={addEmpEmploymentStatus}>Add</Button>
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide flex">
                          <span className="flex-1">Status</span><span className="w-28 text-center">Probation</span><span className="w-32 text-center">WEF</span><span className="w-10"></span>
                        </div>
                        {formData.empEmploymentStatusForm.length === 0 ? (
                          <div className="text-center py-4 text-gray-400 text-sm">No employment status entries added</div>
                        ) : (
                          formData.empEmploymentStatusForm.map((es, i) => (
                            <div key={es._localId} className={`flex items-center px-3 py-2 text-sm ${i === formData.empEmploymentStatusForm.length - 1 ? 'bg-blue-50 font-medium' : 'bg-white'} ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                              <span className="flex-1">{es.employmentStatus || '—'}</span>
                              <span className="w-28 text-center text-gray-500">{es.probationPeriod || '—'}</span>
                              <span className="w-32 text-center text-gray-500">{es.effectFrom || '—'}</span>
                              {<Button type="button" variant="ghost" size="sm" onClick={() => removeEmpEmploymentStatus(es._localId)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"><X className="w-3 h-3" /></Button>}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <CollapsibleFormGroup
                      title="Shift & policies"
                      expanded={isGroupExpanded("employment-policies")}
                      onToggle={() => toggleFormGroup("employment-policies")}
                    >
                      {/* Leave Policy — visible for COMPANY_ADMIN / BRANCH_ADMIN / SERVICE_PROVIDER (hidden for ADMIN) */}
                      {!isAdmin && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Leave Policy</h3>
                            {canManage && (
                              <Button type="button" variant="outline" size="sm" onClick={() => window.open('/leave-policy', '_blank')}>
                                <Plus className="w-4 h-4 mr-1" /> Manage Policies
                              </Button>
                            )}
                          </div>
                          <div className="flex items-end gap-2">
                            <div ref={lpRef} className="flex-1 space-y-2 relative">
                              <Label>Leave Policy</Label>
                              <Input
                                value={stagingLP.label}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStagingLP((p) => ({ ...p, label: val, leavePolicyID: null }));
                                  runFetchLP(val);
                                }}
                                onFocus={(e) => {
                                  if (e.target.value.length >= MIN_CHARS) runFetchLP(e.target.value);
                                }}
                                placeholder="Search leave policy…"
                                autoComplete="off"
                              />
                              {lpList.length > 0 && (
                                <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                                  {lpLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                                  {lpList.map((l) => (
                                    <div
                                      key={l.id}
                                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => {
                                        setStagingLP((p) => ({ ...p, leavePolicyID: l.id, label: l.leavePolicyName ?? "" }));
                                        setLpList([]);
                                      }}
                                    >
                                      {l.leavePolicyName}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label>WEF</Label>
                              <Input
                                type="date"
                                value={stagingLP.effectFrom}
                                onChange={(e) => setStagingLP((p) => ({ ...p, effectFrom: e.target.value }))}
                              />
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!stagingLP.leavePolicyID}
                              onClick={() => {
                                if (!stagingLP.leavePolicyID) return;
                                const newEntry: EmpLeavePolicyForm = {
                                  _localId: uid(),
                                  leavePolicyID: stagingLP.leavePolicyID,
                                  _lpAutocomplete: stagingLP.label,
                                  effectFrom: stagingLP.effectFrom,
                                };
                                setFormData((p) => {
                                  const newList = upsertHistoryEntry(
                                    p.empLeavePolicyForm,
                                    newEntry,
                                    (item) => item.leavePolicyID === newEntry.leavePolicyID,
                                  );
                                  const last = newList[newList.length - 1];
                                  return {
                                    ...p,
                                    empLeavePolicyForm: newList,
                                    leavePolicyID: last?.leavePolicyID ?? null,
                                  };
                                });
                                setStagingLP({ leavePolicyID: null, label: "", effectFrom: today });
                              }}
                            >
                              Add
                            </Button>
                          </div>
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide flex">
                              <span className="flex-1">Leave Policy</span>
                              <span className="w-32 text-center">WEF</span>
                              <span className="w-10"></span>
                            </div>
                            {formData.empLeavePolicyForm.length === 0 ? (
                              <div className="text-center py-4 text-gray-400 text-sm">No leave policies added</div>
                            ) : (
                              formData.empLeavePolicyForm.map((el, i) => (
                                <div
                                  key={el._localId}
                                  className={`flex items-center px-3 py-2 text-sm ${i === formData.empLeavePolicyForm.length - 1 ? "bg-blue-50 font-medium" : "bg-white"
                                    } ${i > 0 ? "border-t border-gray-100" : ""}`}
                                >
                                  <span className="flex-1">{el._lpAutocomplete || "—"}</span>
                                  <span className="w-32 text-center text-gray-500">{el.effectFrom || "—"}</span>
                                  {
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeEmpLeavePolicy(el._localId)}
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  }
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {/* Attendance Policy - Search & Add with History (visible for COMPANY_ADMIN and above, hidden for ADMIN) */}
                      {!isAdmin && <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Attendance Policy</h3>
                          {canManage && <Button type="button" variant="outline" size="sm" onClick={() => window.open('/attendance-policy', '_blank')}><Plus className="w-4 h-4 mr-1" /> Manage Policies</Button>}
                        </div>
                        <div className="flex items-end gap-2">
                          <div ref={apRef} className="flex-1 space-y-2 relative">
                            <Label>Attendance Policy</Label>
                            <Input
                              value={stagingAP.label}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStagingAP(p => ({ ...p, label: val, attendancePolicyID: null }));
                                runFetchAP(val);
                              }}
                              onFocus={(e) => {
                                if (e.target.value.length >= MIN_CHARS) runFetchAP(e.target.value);
                              }}
                              placeholder="Search attendance policy…"
                              autoComplete="off"
                            />
                            {apList.length > 0 && (
                              <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                                {apLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                                {apList.map((a) => (
                                  <div key={a.id} className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onMouseDown={(e) => e.preventDefault()} onClick={() => {
                                    setStagingAP(p => ({ ...p, attendancePolicyID: a.id, label: a.attendancePolicyName ?? "", _isFactual: a._isFactual ?? false }));
                                    setApList([]);
                                  }}>{a.attendancePolicyName}</div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>WEF</Label>
                            <Input type="date" value={stagingAP.effectFrom} onChange={(e) => setStagingAP(p => ({ ...p, effectFrom: e.target.value }))} />
                          </div>
                          <Button type="button" size="sm" disabled={!stagingAP.attendancePolicyID} onClick={() => {
                            if (!stagingAP.attendancePolicyID) return;
                            const newEntry: EmpAttendancePolicyForm = { _localId: uid(), attendancePolicyID: stagingAP.attendancePolicyID, _apAutocomplete: stagingAP.label, effectFrom: stagingAP.effectFrom, _isFactual: stagingAP._isFactual ?? false };
                            setFormData(p => {
                              const newList = upsertHistoryEntry(p.empAttendancePolicyForm, newEntry, (item) => item.attendancePolicyID === newEntry.attendancePolicyID);
                              const last = newList[newList.length - 1];
                              return { ...p, empAttendancePolicyForm: newList, attendancePolicyID: last?.attendancePolicyID ?? null };
                            });
                            setStagingAP({ attendancePolicyID: null, label: "", effectFrom: today });
                          }}>Add</Button>
                        </div>
                        {/* History Box */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide flex">
                            <span className="flex-1">Attendance Policy</span><span className="w-32 text-center">WEF</span><span className="w-10"></span>
                          </div>
                          {formData.empAttendancePolicyForm.length === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-sm">No attendance policies added</div>
                          ) : (
                            formData.empAttendancePolicyForm.map((ea, i) => (
                              <div key={ea._localId} className={`flex items-center px-3 py-2 text-sm ${i === formData.empAttendancePolicyForm.length - 1 ? 'bg-blue-50 font-medium' : 'bg-white'} ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                                <span className="flex-1 flex items-center gap-1">{ea._apAutocomplete || '—'}</span>
                                <span className="w-32 text-center text-gray-500">{ea.effectFrom || '—'}</span>
                                {<Button type="button" variant="ghost" size="sm" onClick={() => removeEmpAttendancePolicy(ea._localId)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"><X className="w-3 h-3" /></Button>}
                              </div>
                            ))
                          )}
                        </div>
                      </div>}

                      {/* Work Shift - Search & Add with History (visible for COMPANY_ADMIN and above, hidden for ADMIN) */}
                      {!isAdmin && <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Work Shift</h3>
                          {canManage && <Button type="button" variant="outline" size="sm" onClick={() => window.open('/work-shifts', '_blank')}><Plus className="w-4 h-4 mr-1" /> Manage Shifts</Button>}
                        </div>

                        {/* Work shift field */}
                        <div className="flex items-end gap-2">
                          <div ref={wsRef} className="flex-1 space-y-2 relative">
                            <Label>Work Shift</Label>
                            <Input
                              value={stagingWS.label}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStagingWS(p => ({ ...p, label: val, workShiftID: null }));
                                runFetchWS(val);
                              }}
                              onFocus={(e) => {
                                if (e.target.value.length >= MIN_CHARS) runFetchWS(e.target.value);
                              }}
                              placeholder="Search work shift…"
                              autoComplete="off"
                            />
                            {wsList.length > 0 && !formData.allowRotatingShift && (
                              <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                                {wsLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                                {wsList.map((w) => (
                                  <div key={w.id} className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onMouseDown={(e) => e.preventDefault()} onClick={() => {
                                    setStagingWS(p => ({ ...p, workShiftID: w.id, label: w.workShiftName ?? "", _isFactual: w._isFactual ?? false }));
                                    setWsList([]);
                                  }}>{w.workShiftName}</div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>WEF</Label>
                            <Input type="date" disabled={formData.allowRotatingShift} value={stagingWS.effectFrom} onChange={(e) => setStagingWS(p => ({ ...p, effectFrom: e.target.value }))} />
                          </div>
                          <Button type="button" size="sm" disabled={!stagingWS.workShiftID || formData.allowRotatingShift} onClick={() => {
                            if (!stagingWS.workShiftID) return;
                            const newEntry: EmpWorkShiftForm = { _localId: uid(), workShiftID: stagingWS.workShiftID, _wsAutocomplete: stagingWS.label, effectFrom: stagingWS.effectFrom, _isFactual: stagingWS._isFactual ?? false };
                            setFormData(p => {
                              const newList = upsertHistoryEntry(p.empWorkShiftForm, newEntry, (item) => item.workShiftID === newEntry.workShiftID);
                              const last = newList[newList.length - 1];
                              return { ...p, empWorkShiftForm: newList, workShiftID: last?.workShiftID ?? null };
                            });
                            setStagingWS({ workShiftID: null, label: "", effectFrom: today });
                          }}>Add</Button>
                        </div>
                        {/* History Box */}
                        {!formData.allowRotatingShift && (
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide flex">
                              <span className="flex-1">Work Shift</span><span className="w-32 text-center">WEF</span><span className="w-10"></span>
                            </div>
                            {formData.empWorkShiftForm.length === 0 ? (
                              <div className="text-center py-4 text-gray-400 text-sm">No work shifts added</div>
                            ) : (
                              formData.empWorkShiftForm.map((ew, i) => (
                                <div key={ew._localId} className={`flex items-center px-3 py-2 text-sm ${i === formData.empWorkShiftForm.length - 1 ? 'bg-blue-50 font-medium' : 'bg-white'} ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                                  <span className="flex-1 flex items-center gap-1">{ew._wsAutocomplete || '—'}</span>
                                  <span className="w-32 text-center text-gray-500">{ew.effectFrom || '—'}</span>
                                  {<Button type="button" variant="ghost" size="sm" onClick={() => removeEmpWorkShift(ew._localId)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"><X className="w-3 h-3" /></Button>}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                        {formData.allowRotatingShift && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                            Rotating employee — shifts will be assigned day-by-day in the <strong>Workshift Roster</strong>.
                          </div>
                        )}
                      </div>}
                    </CollapsibleFormGroup>



                    <CollapsibleFormGroup
                      title="Salary payout & pay grade"
                      expanded={isGroupExpanded("employment-salary")}
                      onToggle={() => toggleFormGroup("employment-salary")}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Salary payout cycle</Label>
                          <Input
                            value={formData.salaryPayoutCycle}
                            onChange={(e) => setFormData((p) => ({ ...p, salaryPayoutCycle: e.target.value }))}
                            placeholder="e.g. Monthly, Weekly"
                          />
                        </div>
                        {/* Salary Pay Grade Type + conditional autocompletes */}
                        <div className="space-y-3 sm:col-span-2">
                          <div className="space-y-2">
                            <Label>Salary Pay Grade Type</Label>
                            <Select
                              value={formData.promotion.salaryPayGradeType || ""}
                              onValueChange={(val) =>
                                setFormData((p) => ({
                                  ...p,
                                  salaryPayGradeType: val,
                                  promotion: {
                                    ...p.promotion,
                                    salaryPayGradeType: val,
                                    monthlyPayGradeID: val === "Monthly" ? p.promotion.monthlyPayGradeID : null,
                                  },
                                  monthlyPGAutocomplete: val === "Monthly" ? p.monthlyPGAutocomplete : "",
                                }))
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select type…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Monthly PG (only when Monthly is selected) */}
                          <div ref={monthlyPGRef} className="space-y-2 relative">
                            <div className="flex items-center justify-between">
                              <Label>Pay Grade</Label>
                              {canManage && <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" title="Manage Pay Grades" onClick={() => window.open('/monthly-pay-grade', '_blank')}><Plus className="w-3 h-3" /></Button>}
                            </div>
                            <Input
                              value={formData.monthlyPGAutocomplete}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormData((p) => ({
                                  ...p,
                                  monthlyPGAutocomplete: val,
                                  promotion: { ...p.promotion, monthlyPayGradeID: null },
                                }));
                                runFetchMonthlyPG(val);
                              }}
                              onFocus={(e) => {
                                const val = e.target.value;
                                if (val.length >= MIN_CHARS) runFetchMonthlyPG(val);
                              }}
                              placeholder="Start typing pay grade…"
                              autoComplete="off"
                            />
                            {monthlyPGList.length > 0 && (
                              <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                                {monthlyPGLoading && (
                                  <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>
                                )}
                                {monthlyPGList.map((g) => (
                                  <div
                                    key={g.id}
                                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      const name = g.monthlyPayGradeName ?? String(g.id);
                                      setFormData((p) => ({
                                        ...p,
                                        monthlyPGAutocomplete: name,
                                        promotion: { ...p.promotion, monthlyPayGradeID: g.id },
                                        monthlyPayGradeNames: p.monthlyPayGradeNames.includes(name)
                                          ? p.monthlyPayGradeNames
                                          : [...p.monthlyPayGradeNames, name],
                                      }));
                                      setMonthlyPGList([]);
                                    }}
                                  >
                                    {g.monthlyPayGradeName}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {formData.monthlyPayGradeNames.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {formData.monthlyPayGradeNames.map((name) => (
                                <span
                                  key={name}
                                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800"
                                >
                                  {name}
                                  <button
                                    type="button"
                                    className="text-blue-600 hover:text-blue-900"
                                    onClick={() =>
                                      setFormData((p) => ({
                                        ...p,
                                        monthlyPayGradeNames: p.monthlyPayGradeNames.filter((n) => n !== name),
                                      }))
                                    }
                                    aria-label={`Remove ${name}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleFormGroup>

                    <CollapsibleFormGroup
                      title="EPF / UAN / ESI"
                      expanded={isGroupExpanded("employment-statutory")}
                      onToggle={() => toggleFormGroup("employment-statutory")}
                    >
                      <div className="space-y-2">
                        <Label>EPF Member</Label>
                        <div className="flex items-center space-x-4">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={formData.pfMemberStatus === "Yes"}
                              onChange={(e) => setFormData((p) => ({ ...p, pfMemberStatus: e.target.checked ? "Yes" : "No" }))}
                            />
                            <span>Yes</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={formData.pfMemberStatus === "No"}
                              onChange={(e) => setFormData((p) => ({ ...p, pfMemberStatus: e.target.checked ? "No" : "Yes" }))}
                            />
                            <span>No</span>
                          </label>
                        </div>
                      </div>
                      {formData.pfMemberStatus === "Yes" && (
                        <div className="space-y-2">
                          <Label>PF Number</Label>
                          <Input
                            value={formData.pfNumber}
                            onChange={(e) => setFormData((p) => ({ ...p, pfNumber: e.target.value }))}
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <MultiValueField
                          label="UAN No."
                          values={formData.uanNos}
                          onChange={(uanNos) =>
                            setFormData((p) => ({ ...p, uanNos, uanNo: primaryMultiValue(uanNos) }))
                          }
                          placeholder="Universal Account Number"
                          inputMode="numeric"
                          maxLength={12}
                          transform={(v) => v.replace(/\D/g, "").slice(0, 12)}
                        />
                        <MultiValueField
                          label="ESI No."
                          values={formData.esiNos}
                          onChange={(esiNos) =>
                            setFormData((p) => ({ ...p, esiNos, esiNo: primaryMultiValue(esiNos) }))
                          }
                          placeholder="ESI insurance number"
                        />
                      </div>
                    </CollapsibleFormGroup>

                    <CollapsibleFormGroup
                      title="Office contact"
                      expanded={isGroupExpanded("employment-office-contact")}
                      onToggle={() => toggleFormGroup("employment-office-contact")}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <MultiValueField
                          label="Office Mobile No."
                          values={formData.businessPhones}
                          onChange={(businessPhones) =>
                            setFormData((p) => ({
                              ...p,
                              businessPhones,
                              businessPhoneNo: primaryMultiValue(businessPhones),
                            }))
                          }
                        />
                        <MultiValueField
                          label="Office Email ID"
                          type="email"
                          values={formData.businessEmails}
                          onChange={(businessEmails) =>
                            setFormData((p) => ({
                              ...p,
                              businessEmails,
                              businessEmail: primaryMultiValue(businessEmails),
                            }))
                          }
                        />
                      </div>
                    </CollapsibleFormGroup>
                  </>
                )}



              </div>
            )}

            {activeFormSection === "documents" && !isAdmin && (
              <div className="space-y-5">
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold">Upload document</h3>
                    <p className="text-sm text-muted-foreground">
                      Upload Aadhaar, PAN, address proof, certificates, experience letters or other employee documents. Max 5 MB each.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Name <span className="text-red-500">*</span></Label>
                      <Input
                        value={documentForm.name}
                        onChange={(e) =>
                          setDocumentForm((p) => ({ ...p, name: e.target.value }))
                        }
                        placeholder="Aadhaar card"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Category <span className="text-red-500">*</span></Label>
                      <Select
                        value={documentForm.category}
                        onValueChange={(value) =>
                          setDocumentForm((p) => ({ ...p, category: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {documentCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 lg:col-span-2">
                      <Label>Description</Label>
                      <Textarea
                        value={documentForm.description}
                        onChange={(e) =>
                          setDocumentForm((p) => ({ ...p, description: e.target.value }))
                        }
                        rows={2}
                        placeholder="Optional note about this document"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Issued date</Label>
                      <Input
                        type="date"
                        value={documentForm.issuedDate}
                        onChange={(e) =>
                          setDocumentForm((p) => ({ ...p, issuedDate: e.target.value }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Expiry date</Label>
                      <Input
                        type="date"
                        value={documentForm.expiryDate}
                        onChange={(e) =>
                          setDocumentForm((p) => ({ ...p, expiryDate: e.target.value }))
                        }
                      />
                    </div>

                    <div className="space-y-2 lg:col-span-2">
                      <Label>File <span className="text-red-500">*</span></Label>
                      <Input
                        key={documentInputKey}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) =>
                          setDocumentForm((p) => ({
                            ...p,
                            file: e.target.files?.[0] ?? null,
                          }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Allowed: PDF, JPG, JPEG, PNG, WEBP. Max 5 MB.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button type="button" onClick={addEmployeeDocument} disabled={documentSaving}>
                      <Upload className="mr-1 size-4" />
                      {documentSaving ? "Uploading..." : "Add document"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-border">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div>
                      <h3 className="text-sm font-semibold">Uploaded documents</h3>
                      <p className="text-xs text-muted-foreground">
                        {formData.employeeDocuments.length} document(s) added
                      </p>
                    </div>
                  </div>

                  {formData.employeeDocuments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
                      <FileText className="size-9" />
                      <p className="text-sm">No documents uploaded yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {formData.employeeDocuments.map((doc) => (
                        <div
                          key={doc._localId}
                          className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">{doc.name}</p>
                              <Badge variant="secondary">{doc.category}</Badge>
                            </div>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {doc.fileName} · {formatFileSize(doc.fileSize)}
                            </p>

                            {doc.description ? (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {doc.description}
                              </p>
                            ) : null}

                            <p className="mt-1 text-xs text-muted-foreground">
                              Issued: {doc.issuedDate || "—"} · Expiry: {doc.expiryDate || "—"}
                            </p>
                          </div>

                          <div className="flex shrink-0 gap-2">
                            {doc.fileUrl ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(doc.fileUrl, "_blank")}
                              >
                                <ExternalLink className="mr-1 size-4" />
                                View
                              </Button>
                            ) : null}

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => removeEmployeeDocument(doc._localId)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeFormSection === "additional" && !isAdmin && (
              <div className="space-y-4">
                {/* ==========================
                  EDUCATION (repeater)
                  ========================== */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Education</h3>
                    <Button variant="outline" size="sm" type="button" onClick={addEdu}>
                      <Plus className="w-4 h-4 mr-1" /> Add Education
                    </Button>
                  </div>

                  {formData.eduForm.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 border border-gray-200 rounded-lg">
                      <Icon icon="mdi:school" className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p>No education rows added yet</p>
                    </div>
                  ) : (
                    formData.eduForm.map((ed) => (
                      <div key={ed._localId} className="border border-gray-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">Education</span>
                          {<Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeEdu(ed._localId)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Institute Type</Label>
                            <Input value={ed.instituteType} onChange={(e) => updateEdu(ed._localId, "instituteType", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Institute Name</Label>
                            <Input value={ed.instituteName} onChange={(e) => updateEdu(ed._localId, "instituteName", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Degree</Label>
                            <Input value={ed.degree} onChange={(e) => updateEdu(ed._localId, "degree", e.target.value)} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label>Passing Year</Label>
                            <Input value={ed.pasingYear} onChange={(e) => updateEdu(ed._localId, "pasingYear", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Marks</Label>
                            <Input value={ed.marks} onChange={(e) => updateEdu(ed._localId, "marks", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>GPA/CGPA</Label>
                            <Input value={ed.gpaCgpa} onChange={(e) => updateEdu(ed._localId, "gpaCgpa", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Class</Label>
                            <Input value={ed.class} onChange={(e) => updateEdu(ed._localId, "class", e.target.value)} />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* ==========================
                  EXPERIENCE (repeater)
                  ========================== */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Experience</h3>
                    <Button variant="outline" size="sm" type="button" onClick={addExp}>
                      <Plus className="w-4 h-4 mr-1" /> Add Experience
                    </Button>
                  </div>

                  {formData.expForm.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 border border-gray-200 rounded-lg">
                      <Icon icon="mdi:briefcase" className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p>No experience rows added yet</p>
                    </div>
                  ) : (
                    formData.expForm.map((xp) => (
                      <div key={xp._localId} className="border border-gray-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">Experience</span>
                          {<Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeExp(xp._localId)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Organisation</Label>
                            <Input value={xp.orgName} onChange={(e) => updateExp(xp._localId, "orgName", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>designation</Label>
                            <Input value={xp.designation} onChange={(e) => updateExp(xp._localId, "designation", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Skill</Label>
                            <Input value={xp.skill} onChange={(e) => updateExp(xp._localId, "skill", e.target.value)} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>From</Label>
                            <Input type="date" value={xp.fromDate} onChange={(e) => updateExp(xp._localId, "fromDate", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>To</Label>
                            <Input type="date" value={xp.toDate} onChange={(e) => updateExp(xp._localId, "toDate", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Responsibility</Label>
                            <Input value={xp.responsibility} onChange={(e) => updateExp(xp._localId, "responsibility", e.target.value)} />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* ==========================
                  BANK DETAILS (repeater)
                  ========================== */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Bank Details</h3>
                    <Button variant="outline" size="sm" type="button" onClick={addBankDetail}>
                      <Plus className="w-4 h-4 mr-1" /> Add Bank
                    </Button>
                  </div>

                  {formData.bankDetailsForm.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 border border-gray-200 rounded-lg">
                      <Icon icon="mdi:bank" className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p>No bank details added yet</p>
                    </div>
                  ) : (
                    formData.bankDetailsForm.map((bk) => (
                      <div key={bk._localId} className="border border-gray-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">Bank</span>
                          {<Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBankDetail(bk._localId)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                          <div className="space-y-2">
                            <Label>Bank Name</Label>
                            <Input value={bk.bankName} onChange={(e) => updateBankDetail(bk._localId, "bankName", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Branch Name</Label>
                            <Input value={bk.bankBranchName} onChange={(e) => updateBankDetail(bk._localId, "bankBranchName", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Account Number</Label>
                            <Input value={bk.accNumber} onChange={(e) => updateBankDetail(bk._localId, "accNumber", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>IFSC Code</Label>
                            <Input value={bk.ifscCode} onChange={(e) => updateBankDetail(bk._localId, "ifscCode", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>UPI</Label>
                            <Input value={bk.upi} onChange={(e) => updateBankDetail(bk._localId, "upi", e.target.value)} />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeFormSection === "attendance" && (
              <div className="space-y-4">
                <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-800">Mobile app & selfcare</h3>
                  <div className="space-y-2">
                    <Label>Employee Type</Label>
                    <select className="w-full rounded-md border px-3 py-2" value={formData.typeOfEmployee || "employee"} onChange={(e) => setFormData((p) => ({ ...p, typeOfEmployee: e.target.value }))}>
                      <option value="employee">Employee</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!formData.mobileAttendanceEnabled}
                      disabled={!primaryMultiValue(formData.personalPhones).trim()}
                      onChange={(e) => setFormData((p) => ({ ...p, mobileAttendanceEnabled: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Enable mobile app attendance (requires mobile number in Basic Information)</span>
                  </label>
                  <p className="text-xs text-gray-500 -mt-1 ml-6">
                    When enabled, this employee punches in/out only via the mobile app and their device punches are ignored. When disabled, they punch in/out only via the assigned attendance device.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.mobileBreakEnabled !== false}
                      disabled={!formData.mobileAttendanceEnabled}
                      onChange={(e) => setFormData((p) => ({ ...p, mobileBreakEnabled: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Enable break-in / break-out on mobile app</span>
                  </label>
                  <p className="text-xs text-gray-500 -mt-1 ml-6">
                    When enabled, break-in and break-out buttons appear in the employee selfcare app during an active work session. Requires mobile attendance to be enabled.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!formData.pwaShowLeaveBalance}
                      onChange={(e) => setFormData((p) => ({ ...p, pwaShowLeaveBalance: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Show leave status bar in mobile app</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!formData.allowCreateTaskOnMobile}
                      onChange={(e) => setFormData((p) => ({ ...p, allowCreateTaskOnMobile: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Allow employee to create tasks from mobile app</span>
                  </label>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Attendance Device Mapping</h3>
                    <Button variant="outline" size="sm" type="button" onClick={addDevMap}>
                      <Plus className="w-4 h-4 mr-1" /> Add Attendance Device
                    </Button>
                  </div>

                  {formData.devMapForm.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 border border-gray-200 rounded-lg">
                      <Icon icon="mdi:fingerprint" className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p>No attendance device mappings added yet</p>
                    </div>
                  ) : (
                    formData.devMapForm.map((dm) => (
                      <div key={dm._localId} className="border border-gray-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">

                          {<Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDevMap(dm._localId)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div ref={devRef} className="space-y-2 relative">
                            <Label>Attendance Device</Label>
                            <Input
                              value={dm._devAutocomplete ?? dm.deviceName ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateDevMap(dm._localId, "_devAutocomplete", val);
                                updateDevMap(dm._localId, "deviceID", "");
                                runFetchDev(val);
                              }}
                              placeholder="Type attendance device name…"
                              autoComplete="off"
                            />
                            {devList.length > 0 && (
                              <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                                {devLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                                {devList.map((dv) => (
                                  <div
                                    key={dv.id}
                                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      updateDevMap(dm._localId, "deviceID", String(dv.id));
                                      updateDevMap(dm._localId, "deviceName", dv.deviceName ?? "");
                                      updateDevMap(dm._localId, "_devAutocomplete", dv.deviceName ?? "");
                                      updateDevMap(dm._localId, "deviceType", dv.deviceType ?? "AT");
                                      setDevList([]);
                                    }}
                                  >
                                    {dv.deviceName ?? `#${dv.id}`}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>DeviceEmployee Code</Label>
                            <Input
                              value={dm.deviceEmpCode}
                              onChange={(e) =>
                                updateDevMap(dm._localId, "deviceEmpCode", e.target.value)
                              }
                              placeholder="Device Employee Code"
                              autoComplete="off"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Auth Type</Label>
                            <select
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                              value={dm.authType ?? ""}
                              onChange={(e) => updateDevMap(dm._localId, "authType", e.target.value)}
                            >
                              <option value="">Select auth type</option>
                              {(() => {
                                const allOptions = [
                                  { value: "FACE", label: "Face ID" },
                                  { value: "FINGER", label: "Fingerprint" },
                                  { value: "PIN", label: "PIN / Password" },
                                  { value: "CARD", label: "Card" },
                                ];
                                return allOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>);
                              })()}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-gray-200">
              {editingRow && (
                <Button
                  type="button"
                  variant="outline"
                  className="mr-auto gap-1.5"
                  onClick={() => void downloadJoiningForm(editingRow)}
                >
                  <Download className="w-4 h-4" />
                  Download joining form
                </Button>
              )}
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" className="" disabled={saving}>
                <Save className="w-4 h-4 mr-1" />
                {saving ? "Saving..." : editingRow ? "Update Employee" : "Add Employee"}
              </Button>
            </div>
          </form>
        </div>
      </FormDrawer>

      {/* View Details - Drawer */}
      <FormDrawer
        open={!!(isViewing && viewRow)}
        onOpenChange={(v) => {
          if (!v) handleCancel();
        }}
        title="Employee Details"
        showHeaderCancel
        cancelLabel="Close"
      >
        {viewRow && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary">
                  {viewRow.employeePhotoUrl ? (
                    <img
                      src={viewRow.employeePhotoUrl}
                      alt={fullName(viewRow)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Users className="size-7" />
                  )}
                </div>

                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {fullName(viewRow)}
                  </h2>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{dash(viewRow.employeeID)}</span>
                    <span>·</span>
                    <span>{dash(latestDesignation(viewRow as any))}</span>
                    <span>·</span>
                    <span>{dash(latestDepartment(viewRow as any))}</span>

                    <Badge
                      variant="secondary"
                      className="ml-1 bg-emerald-50 text-emerald-700"
                    >
                      {dash(
                        (viewRow as any).lifecycleStatus ??
                        viewRow.employmentStatus ??
                        "Active"
                      )}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {canManage ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleEdit(viewRow)}
                  >
                    <Edit className="mr-1 size-4" />
                    Edit
                  </Button>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void downloadJoiningForm(viewRow)}
                >
                  <Download className="size-4" />
                  Joining Form
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <DetailCard
                title="Identity"
                subtitle="Personal identification details"
                rows={[
                  { label: "Employee code", value: viewRow.employeeID },
                  { label: "Full name", value: fullName(viewRow) },
                  { label: "Gender", value: viewRow.gender },
                  { label: "Date of birth", value: viewRow.dateOfBirth },
                  { label: "Blood group", value: viewRow.bloodGroup },
                  { label: "Marital status", value: viewRow.maritalStatus },
                  { label: "Father name", value: viewRow.employeeFatherName },
                  { label: "Mother name", value: viewRow.employeeMotherName },
                  { label: "Spouse name", value: viewRow.employeeSpouseName },
                  { label: "Children", value: viewRow.numberOfChildren },
                ]}
              />

              <DetailCard
                title="Contact"
                subtitle="How to reach the employee"
                rows={[
                  { label: "Business email", value: viewRow.businessEmail },
                  { label: "Personal email", value: viewRow.personalEmail },
                  { label: "Business phone", value: viewRow.businessPhoneNo },
                  { label: "Mobile", value: viewRow.personalPhoneNo },
                  { label: "Emergency contact", value: viewRow.emergancyContact },
                  { label: "Present address", value: viewRow.presentAddress },
                  { label: "Permanent address", value: viewRow.permenantAddress },
                ]}
              />

              <DetailCard
                title="Employment"
                subtitle="Organisation mapping"
                rows={[
                  { label: "Service provider", value: spName(viewRow) },
                  { label: "Company", value: coName(viewRow) },
                  { label: "Branch", value: latestBranch(viewRow as any) },
                  { label: "Department", value: latestDepartment(viewRow as any) },
                  { label: "Designation", value: latestDesignation(viewRow as any) },
                  { label: "Joining date", value: viewRow.joiningDate },
                  { label: "Employment type", value: viewRow.employmentType ?? viewRow.typeOfEmployee },
                  { label: "Employment status", value: viewRow.employmentStatus },
                  { label: "Probation period", value: viewRow.probationPeriod },
                  { label: "Contractor", value: contrName(viewRow) },
                ]}
              />

              <DetailCard
                title="Statutory"
                subtitle="Government and legal identifiers"
                rows={[
                  { label: "PAN", value: viewRow.panNo },
                  { label: "Aadhaar", value: viewRow.aadharNo },
                  { label: "UAN", value: viewRow.uanNo },
                  { label: "PF number", value: viewRow.pfNumber },
                  { label: "PF member", value: viewRow.pfMemberStatus },
                  { label: "ESIC", value: viewRow.esiNo },
                ]}
              />

              <div className="xl:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Documents</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Employee identity, statutory and supporting documents
                    </p>
                  </div>
                </div>

                {((viewRow as any).employeeDocuments ?? []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-muted-foreground">
                    <FileText className="size-9" />
                    <p className="text-sm">No documents uploaded yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border rounded-xl border border-border">
                    {((viewRow as any).employeeDocuments ?? []).map((doc: any) => (
                      <div
                        key={doc.id ?? doc._localId}
                        className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{doc.name}</p>
                            <Badge variant="secondary">{doc.category}</Badge>
                          </div>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {doc.fileName || "—"} · {formatFileSize(Number(doc.fileSize ?? 0))}
                          </p>

                          {doc.description ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {doc.description}
                            </p>
                          ) : null}

                          <p className="mt-1 text-xs text-muted-foreground">
                            Issued: {doc.issuedDate || "—"} · Expiry: {doc.expiryDate || "—"}
                          </p>
                        </div>

                        {doc.fileUrl ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(doc.fileUrl, "_blank")}
                          >
                            <ExternalLink className="mr-1 size-4" />
                            View
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </FormDrawer>

      {!isAddingNew && !isViewing && (
        <>
          <FilterBar
            search={{
              value: table.search,
              onChange: table.setSearch,
              placeholder: "Search employees…",
            }}
            filters={
              <>
                {branchFilterList.length > 0 && (
                  <FilterSelect
                    id="employees-branch"
                    value={branchFilter}
                    onChange={(value) => {
                      setBranchFilter(value);
                      setDepartmentFilter("ALL");
                      setDesignationFilter("ALL");
                    }}
                    options={branchFilterOptions}
                    width="w-48"
                    ariaLabel="Filter by branch"
                  />
                )}
                {departmentFilterOptions.length > 1 && (
                  <FilterSelect
                    id="employees-department"
                    value={departmentFilter}
                    onChange={(value) => {
                      setDepartmentFilter(value);
                      setDesignationFilter("ALL");
                    }}
                    options={departmentFilterOptions}
                    width="w-48"
                    ariaLabel="Filter by department"
                  />
                )}
                {designationFilterOptions.length > 1 && (
                  <FilterSelect
                    id="employees-designation"
                    value={designationFilter}
                    onChange={setDesignationFilter}
                    options={designationFilterOptions}
                    width="w-48"
                    ariaLabel="Filter by designation"
                  />
                )}
              </>
            }
          />

          <EntityListShell
            title="Employee list"
            columns={employeeColumns}
            rows={filteredRows}
            rowKey={(r) => String(r.id)}
            isLoading={loading}
            sortBy={table.sortBy}
            sortDir={table.sortDir}
            onSort={table.setSort}
            emptyIcon={Users}
            emptyTitle="No employees found"
            emptyDescription="Try adjusting your search or filter criteria."
            emptyAction={
              canManage ? (
                <Button onClick={() => { resetForm(); setIsAddingNew(true); }}>
                  <Plus className="w-4 h-4 mr-1" /> Add Employee
                </Button>
              ) : undefined
            }
          />
        </>
      )}


      <Dialog open={credentialModalOpen} onOpenChange={setCredentialModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Employee Login Credentials</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              {credentialEmployee?.employeeFirstName} {credentialEmployee?.employeeLastName}{" "}
              ({credentialEmployee?.employeeID})
            </div>

            <div className="space-y-2">
              <Label>Username / Mobile No.</Label>
              <div className="flex gap-2">
                <Input
                  value={credentialForm.username}
                  onChange={(e) =>
                    setCredentialForm((p) => ({ ...p, username: e.target.value }))
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    copyText(credentialForm.username, "Username");
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <div className="flex gap-2">
                <Input
                  value={credentialForm.password}
                  onChange={(e) =>
                    setCredentialForm((p) => ({ ...p, password: e.target.value }))
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copyText(credentialForm.password, "Password")}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Employee must change this password on first login.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCredentialModalOpen(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                disabled={credentialSaving}
                onClick={saveEmployeeCredentials}
              >
                {credentialSaving ? "Saving..." : "Save Credentials"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick-Add Dialog */}
      <Dialog open={!!quickAddOpen} onOpenChange={(open) => { if (!open) { setQuickAddOpen(null); setQuickAddSuggestions([]); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {quickAddOpen === "department" ? "Department" : quickAddOpen === "designation" ? "Designation" : quickAddOpen === "contractor" ? "Contractor" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>
                Search or create {quickAddOpen === "department" ? "department" : quickAddOpen === "designation" ? "designation" : "contractor"}
              </Label>
              <Input
                value={quickAddValue}
                onChange={(e) => {
                  setQuickAddValue(e.target.value);
                  searchQuickAdd(e.target.value);
                }}
                placeholder={`Type to search or enter new ${quickAddOpen === "department" ? "department" : quickAddOpen === "designation" ? "designation" : "contractor"} name…`}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleQuickAdd(); } }}
              />
            </div>
            {/* Existing items matching search */}
            {(quickAddSuggestions.length > 0 || quickAddSearching) && (
              <div className="border rounded max-h-40 overflow-y-auto">
                {quickAddSearching && (
                  <div className="px-3 py-2 text-sm text-gray-500">Searching…</div>
                )}
                {quickAddSuggestions.map((item) => {
                  const displayName = quickAddOpen === "department"
                    ? item.departmentName
                    : quickAddOpen === "designation"
                      ? item.designation
                      : item.contractorName;
                  return (
                    <div
                      key={item.id}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b last:border-b-0"
                      onClick={() => handleQuickAddSelect(item)}
                    >
                      {displayName}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setQuickAddOpen(null); setQuickAddSuggestions([]); }}>Cancel</Button>
              <Button type="button" onClick={handleQuickAdd} disabled={quickAddSaving || !quickAddValue.trim()}>
                {quickAddSaving ? "Saving…" : "Create New"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Field Change History — {historyEmployee?.employeeFirstName} {historyEmployee?.employeeLastName}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 py-2">
            {historyLoading ? (
              <div className="text-center py-8 text-gray-500">Loading history…</div>
            ) : historyData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <History className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p>No field change history found</p>
                <p className="text-sm">Changes will appear here when employee fields are updated</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Old Value</TableHead>
                    <TableHead>New Value</TableHead>
                    <TableHead>Changed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyData.map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{h.fieldName}</TableCell>
                      <TableCell>
                        <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded text-sm">
                          {h.oldLabel || h.oldValue || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-sm">
                          {h.newLabel || h.newValue || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {h.changedAt ? new Date(h.changedAt).toLocaleString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}