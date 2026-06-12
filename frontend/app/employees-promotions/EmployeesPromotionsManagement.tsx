"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
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
import { Plus, Search, Edit, Trash2, Eye, CheckCircle, History, X } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { FormDrawer } from "../components/ui/form-drawer";
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";

/** ========= Types aligned to backend ========= */
type ID = number;

// Core name types used in suggestions
interface SP { id: ID; companyName?: string | null }
interface CO { id: ID; companyName?: string | null; serviceProviderID?: ID | null; branchesID?: ID | null; }
interface BR { id: ID; branchName?: string | null; companyID?: ID | null; branchesID?: ID | null; serviceProviderID?: ID | null; }
interface Dept { id: ID; departmentName?: string | null; companyID?: ID | null; branchesID?: ID | null; serviceProviderID?: ID | null; }
interface Desg { id: ID; designation?: string | null; companyID?: ID | null; branchesID?: ID | null; serviceProviderID?: ID | null; }


// Minimal employee row for suggestions + promotions
interface EmpRow {
  id: ID;
  employeeID?: string | null;
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
  serviceProviderID?: ID | null;
  companyID?: ID | null;
  branchesID?: ID | null;


  // These were previously top-level, but now come via empPromotion. Keep optional.
  employmentType?: string | null;
  employmentStatus?: string | null;
  salaryPayGradeType?: string | null;
  departmentNameID?: ID | null;
  designationID?: ID | null;

  // Optional nested names (if your API ever includes them)
  departments?: { id: ID; departmentName?: string | null } | null;
  designations?: { id: ID; designation?: string | null } | null;

  // 🔽 NEW: latest values live here with nested relations
  empPromotion?: Array<{
    id: ID;
    manageEmployeeID?: ID | null;
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
    // Nested relation objects
    departments?: { id: ID; departmentName?: string | null } | null;
    designations?: { id: ID; designation?: string | null } | null;
    workShift?: { id: ID; workShiftName?: string | null } | null;
    attendancePolicy?: { id: ID; attendancePolicyName?: string | null } | null;
    leavePolicy?: { id: ID; leavePolicyName?: string | null } | null;
    hourlyPayGrade?: { id: ID; hourlyPayGradeName?: string | null } | null;
    monthlyPayGrade?: { id: ID; monthlyPayGradeName?: string | null } | null;
  }> | null;
}


// Current position row (EmpCurrentPosition)
interface CurrentPos {
  id: ID;
  serviceProviderID?: ID | null;
  companyID?: ID | null;
  branchesID?: ID | null;
  manageEmployeeID?: ID | null;
  existingDepartmentID?: ID | null;
  existingDesignationID?: ID | null;
  existingMonthlyPayGradeID?: ID | null;
  existingHourlyPayGradeID?: ID | null;
  existingSalaryCtc?: number | null;
  existingEmploymentType?: number | null;
  effectiveFrom?: string | null; // ISO date
  effectiveTo?: string | null;   // ISO date
  createdAt?: string | null;

  // Optional nested (if backend includes)
  serviceProvider?: { id: ID; companyName?: string | null } | null;
  company?: { id: ID; companyName?: string | null } | null;
  branches?: { id: ID; branchName?: string | null } | null;
  departments?: { id: ID; departmentName?: string | null } | null;
  designations?: { id: ID; designation?: string | null } | null;
}

// Promotion request row (empPromotionuest)
interface empPromotion {
  id: ID;
  manageEmployeeID?: ID | null;
  empID?: string | null;
  newDepartmentID?: ID | null;
  newDesignationID?: ID | null;
  newMonthlyPayGradeID?: ID | null;
  newHourlyPayGradeID?: ID | null;
  newSalaryCtc?: number | null;
  newEmploymentType?: number | null;
  newEmployementStatus?: string | null;
  proposedDepartmentID?: ID | null;
  proposedDesignationID?: ID | null;
  proposedMonthlyPayGradeID?: ID | null;
  proposedHourlyPayGradeID?: ID | null;
  proposedSalaryCtc?: number | null;
  proposedEmploymentType?: number | null;
  description?: string | null;
  promotionDate?: string | null; // ISO date
  status?: string | null; // "Not Applied" | "Applied"
  created_at?: string | null;

  // Optional nested names if included by your API
  departments_empPromotionuest_currentDepartmentIDTodepartments?: { id: ID; departmentName?: string | null } | null;
  designations_empPromotionuest_currentDesignationIDTodesignations?: { id: ID; designation?: string | null } | null;
  departments_empPromotionuest_proposedDepartmentIDTodepartments?: { id: ID; departmentName?: string | null } | null;
  designations_empPromotionuest_proposedDesignationIDTodesignations?: { id: ID; designation?: string | null } | null;
}

/** ========= API endpoints ========= */
/** ========= API endpoints ========= */
const API = {
  serviceProviders: "/backend/service-provider",
  companies: "/backend/company",
  branches: "/backend/branches",
  manageEmp: "/backend/manage-emp",
  managers: "/backend/manage-emp",

  // ✅ fix typo + keep same path
  workShifts: "/backend/work-shift",


  // ✅ add these three if your backend exposes them as below
  attendancePolicies: "/backend/attendance-policy",
  leavePolicies: "/backend/leave-policy",
  empPromotion: "/backend/emp-promotion",


  // ✅ add monthly/hourly grade endpoints (you mentioned these names earlier)
  monthlyGrades: "/backend/monthly-pay-grade",
  hourlyGrades: "/backend/hourly-grade",

  empCurrent: "/backend/emp-current-position",
  departments: "/backend/departments",
  designations: "/backend/designations",
};


const MIN_CHARS = 0;
const DEBOUNCE_MS = 250;

/** ========= helpers ========= */
async function fetchJSONSafe<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const raw = await res.json();
  return (raw?.data ?? raw) as T;
}



/** ========= Component ========= */
export function EmployeesPromotionsManagement() {
  /** ========== table data (show list of promotion requests) ========== */
  const [rows, setRows] = useState<EmpPromotionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN";
  const isEmployee = user?.role === "EMPLOYEE";

  const [currentUserMapping, setCurrentUserMapping] = useState<any | null>(null);

  // Fetch mapping for MANAGER
  useEffect(() => {
    if (user?.role !== "SERVICE_PROVIDER") return;

    (async () => {
      const res = await fetch("/backend/users");
      const list = await res.json();

      const me = list.find((u: any) => u.username === user.username);
      setCurrentUserMapping(me || null);
    })();
  }, [user]);

  // Auto-assign for MANAGER before creating
  useEffect(() => {
    if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
      setFormData((p) => ({
        ...p,
        serviceProviderID: currentUserMapping.serviceProviderID,
        companyID: currentUserMapping.companyID,
      }));
    }
  }, [user, currentUserMapping]);


  // ===== Global Manager Filter Helper =====
  function applyManagerFilter<
    T extends { companyID?: number | null; branchesID?: number | null }
  >(
    arr: T[],
    user: any,
    currentUserMapping: any,
    selectedBranchID?: number | null
  ) {
    // SUPERADMIN → no filter
    if (user?.role === "SUPERADMIN") return arr;

    // MANAGER → company fixed, branch depends on selection
    if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
      return arr.filter(
        (x) =>
          x.companyID === currentUserMapping.companyID &&
          (!selectedBranchID || x.branchesID === selectedBranchID)
      );
    }

    return arr;
  }




  /** dialog state */
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [viewRow, setViewRow] = useState<empPromotion | null>(null);
  const [editingRow, setEditingRow] = useState<{ current?: CurrentPos | null; promo?: empPromotion | null } | null>(null);

  /** ========== autocomplete refs & state ========== */
  const spRef = useRef<HTMLDivElement>(null);
  const coRef = useRef<HTMLDivElement>(null);
  const brRef = useRef<HTMLDivElement>(null);
  const empRef = useRef<HTMLDivElement>(null);
  const deptCurrRef = useRef<HTMLDivElement>(null);
  const desgCurrRef = useRef<HTMLDivElement>(null);
  const deptNewRef = useRef<HTMLDivElement>(null);
  const desgNewRef = useRef<HTMLDivElement>(null);
  const deptPropRef = useRef<HTMLDivElement>(null);
  const desgPropRef = useRef<HTMLDivElement>(null);
  const workShiftRef = useRef<HTMLDivElement>(null);
  const attPolicyRef = useRef<HTMLDivElement>(null);
  const leavePolicyRef = useRef<HTMLDivElement>(null);
  const monthlyPGRef = useRef<HTMLDivElement>(null);
  const hourlyPGRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<HTMLDivElement>(null);





  const [spList, setSpList] = useState<SP[]>([]);
  const [coList, setCoList] = useState<CO[]>([]);
  const [brList, setBrList] = useState<BR[]>([]);
  const [empList, setEmpList] = useState<EmpRow[]>([]);
  const [deptCurrList, setDeptCurrList] = useState<Dept[]>([]);
  const [desgCurrList, setDesgCurrList] = useState<Desg[]>([]);
  const [deptNewList, setDeptNewList] = useState<Dept[]>([]);
  const [desgNewList, setDesgNewList] = useState<Desg[]>([]);
  const [deptPropList, setDeptPropList] = useState<Dept[]>([]);
  const [desgPropList, setDesgPropList] = useState<Desg[]>([]);
  const [managerList, setManagerList] = useState<any[]>([]);


  const [spLoading, setSpLoading] = useState(false);
  const [coLoading, setCoLoading] = useState(false);
  const [brLoading, setBrLoading] = useState(false);
  const [empLoading, setEmpLoading] = useState(false);
  const [deptCurrLoading, setDeptCurrLoading] = useState(false);
  const [desgCurrLoading, setDesgCurrLoading] = useState(false);
  const [deptNewLoading, setDeptNewLoading] = useState(false);
  const [desgNewLoading, setDesgNewLoading] = useState(false);
  const [deptPropLoading, setDeptPropLoading] = useState(false);
  const [desgPropLoading, setDesgPropLoading] = useState(false);
  const [managerLoading, setManagerLoading] = useState(false);


  const spAbortRef = useRef<AbortController | null>(null);
  const coAbortRef = useRef<AbortController | null>(null);
  const brAbortRef = useRef<AbortController | null>(null);
  const empAbortRef = useRef<AbortController | null>(null);
  const deptCurrAbortRef = useRef<AbortController | null>(null);
  const desgCurrAbortRef = useRef<AbortController | null>(null);
  const deptNewAbortRef = useRef<AbortController | null>(null);
  const desgNewAbortRef = useRef<AbortController | null>(null);
  const deptPropAbortRef = useRef<AbortController | null>(null);
  const desgPropAbortRef = useRef<AbortController | null>(null);


  const workShiftAbortRef = useRef<AbortController | null>(null);
  const attPolicyAbortRef = useRef<AbortController | null>(null);
  const leavePolicyAbortRef = useRef<AbortController | null>(null);
  const monthlyPGAbortRef = useRef<AbortController | null>(null);
  const hourlyPGAbortRef = useRef<AbortController | null>(null);
  const managerAbortRef = useRef<AbortController | null>(null);


  const workShiftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attPolicyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leavePolicyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monthlyPGTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hourlyPGTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const managerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  const spTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const empTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deptCurrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desgCurrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deptNewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desgNewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deptPropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desgPropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [workShiftList, setWorkShiftList] = useState<any[]>([]);
  const [workShiftLoading, setWorkShiftLoading] = useState(false);

  const [attPolicyList, setAttPolicyList] = useState<any[]>([]);
  const [attPolicyLoading, setAttPolicyLoading] = useState(false);

  const [leavePolicyList, setLeavePolicyList] = useState<any[]>([]);
  const [leavePolicyLoading, setLeavePolicyLoading] = useState(false);

  const [monthlyPGList, setMonthlyPGList] = useState<any[]>([]);
  const [monthlyPGLoading, setMonthlyPGLoading] = useState(false);

  const [hourlyPGList, setHourlyPGList] = useState<any[]>([]);
  const [hourlyPGLoading, setHourlyPGLoading] = useState(false);

  /** form state */
  type PromotionForm = {
    id: number | undefined;
    manageEmployeeID: number | null;
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

  const [formData, setFormData] = useState<{


    serviceProviderID: ID | null;
    companyID: ID | null;
    branchesID: ID | null;
    spAutocomplete: string;
    coAutocomplete: string;
    brAutocomplete: string;

    workShiftAutocomplete: string;
    attPolicyAutocomplete: string;
    leavePolicyAutocomplete: string;
    monthlyPGAutocomplete: string;
    hourlyPGAutocomplete: string;
    managerAutocomplete: string;



    manageEmployeeID: ID | null;
    empAutocomplete: string;
    empID: string;

    existingDepartmentID: ID | null;
    existingDesignationID: ID | null;
    existingMonthlyPayGradeID: ID | null;
    existingHourlyPayGradeID: ID | null;
    existingSalaryCtc: string;
    existingEmploymentType: string;
    effectiveFrom: string;
    effectiveTo: string;

    deptCurrAutocomplete: string;
    desgCurrAutocomplete: string;

    newDepartmentID: ID | null;
    newDesignationID: ID | null;
    newMonthlyPayGradeID: ID | null;
    newHourlyPayGradeID: ID | null;
    newSalaryCtc: string;
    newEmploymentType: string;

    deptNewAutocomplete: string;
    desgNewAutocomplete: string;

    proposedDepartmentID: ID | null;
    proposedDesignationID: ID | null;
    proposedMonthlyPayGradeID: ID | null;
    proposedHourlyPayGradeID: ID | null;
    proposedSalaryCtc: string;
    proposedEmploymentType: string;

    deptPropAutocomplete: string;
    desgPropAutocomplete: string;

    description: string;
    promotionDate: string;
    status: string;
    promotedSalaryCtc?: string;
    transferTypes: string[];

    currentDeptIdDisplay: string;
    currentManagerIdDisplay: string;
    currentDesgIdDisplay: string;
    currentManagerNameDisplay: string;
    currentDeptNameDisplay: string;
    currentDesgNameDisplay: string;
    currentCompanyNameDisplay: string;
    currentBranchNameDisplay: string;
    currentSalaryPayGradeTypeDisplay: string;
    currentEmploymentTypeDisplay: string;
    currentEmploymentStatusDisplay: string;

    promotion: PromotionForm;
  }>({
    serviceProviderID: null,
    companyID: null,
    branchesID: null,
    spAutocomplete: "",
    coAutocomplete: "",
    brAutocomplete: "",

    workShiftAutocomplete: "",
    attPolicyAutocomplete: "",
    leavePolicyAutocomplete: "",
    monthlyPGAutocomplete: "",
    hourlyPGAutocomplete: "",
    managerAutocomplete: "",


    manageEmployeeID: null,
    empAutocomplete: "",
    empID: "",

    existingDepartmentID: null,
    existingDesignationID: null,
    existingMonthlyPayGradeID: null,
    existingHourlyPayGradeID: null,
    existingSalaryCtc: "",
    existingEmploymentType: "",
    effectiveFrom: "",
    effectiveTo: "",

    deptCurrAutocomplete: "",
    desgCurrAutocomplete: "",

    newDepartmentID: null,
    newDesignationID: null,
    newMonthlyPayGradeID: null,
    newHourlyPayGradeID: null,
    newSalaryCtc: "",
    newEmploymentType: "",
    deptNewAutocomplete: "",
    desgNewAutocomplete: "",

    proposedDepartmentID: null,
    proposedDesignationID: null,
    proposedMonthlyPayGradeID: null,
    proposedHourlyPayGradeID: null,
    proposedSalaryCtc: "",
    proposedEmploymentType: "",
    deptPropAutocomplete: "",
    desgPropAutocomplete: "",

    description: "",
    promotionDate: "",
    status: "Not Applied",
    promotedSalaryCtc: "",
    transferTypes: [] as string[],

    currentDeptIdDisplay: "",
    currentManagerIdDisplay: "",
    currentDesgIdDisplay: "",
    currentManagerNameDisplay: "",
    currentDeptNameDisplay: "",
    currentDesgNameDisplay: "",
    currentCompanyNameDisplay: "",
    currentBranchNameDisplay: "",
    currentSalaryPayGradeTypeDisplay: "",
    currentEmploymentTypeDisplay: "",
    currentEmploymentStatusDisplay: "",



    promotion: {
      id: undefined,
      manageEmployeeID: null,
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
  });

  // New: row shape for GET /emp-promotion
  interface EmpPromotionRow {
    id: ID;
    manageEmployeeID: ID | null;

    departmentNameID: ID | null;
    designationID: ID | null;
    managerID: ID | null;

    employmentType: string | null;   // e.g. "Contract"
    employmentStatus: string | null; // e.g. "Probation"
    probationPeriod: string | null;

    workShiftID: ID | null;
    attendancePolicyID: ID | null;
    leavePolicyID: ID | null;

    salaryPayGradeType: string | null; // "Hourly" | "Monthly" | null
    monthlyPayGradeID: ID | null;
    hourlyPayGradeID: ID | null;

    promotedSalaryCtc?: number | null;

    // nested names (as returned in your sample)
    departments?: { id: ID; departmentName?: string | null } | null;
    designations?: { id: ID; designation?: string | null } | null;
    workShift?: any | null;
    attendancePolicy?: any | null;
    leavePolicy?: any | null;
    hourlyPayGrade?: any | null;
    monthlyPayGrade?: any | null;

    // nested employee for display
    manageEmployee?: {
      id: ID;
      employeeID?: string | null;
      employeeFirstName?: string | null;
      employeeLastName?: string | null;
      employeePhotoUrl?: string | null;
    } | null;
  }


  const resolvedCompanyID =
    user?.role === "SERVICE_PROVIDER"
      ? currentUserMapping?.companyID
      : formData.companyID;

  const resolvedBranchID = formData.branchesID;

  /** ======= load list ======= */
  const [allRows, setAllRows] = useState<EmpPromotionRow[]>([]);
  const fetchRows = async () => {
    try {
      setLoading(true);
      const all = await fetchJSONSafe<EmpPromotionRow[]>(API.empPromotion);
      const list = Array.isArray(all) ? all : (all ?? []);

      // 🟢 SUPERADMIN → filter by sidebar context
      if (user?.role === "SUPERADMIN") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          setRows(list.filter((r: any) => r.companyID === ctx.companyID));
        } else {
          setRows(list);
        }
        return;
      }

      // 🟡 MANAGER → Filter by /users mapping
      if (user?.role === "SERVICE_PROVIDER") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          setRows(list.filter((r: any) => r.companyID === ctx.companyID));
          return;
        }
        const usersRes = await fetch("/backend/users");
        const users = await usersRes.json();
        const currentUser = users.find((u: any) => u.username === user.username);
        if (currentUser?.serviceProviderID) {
          setRows(list.filter((r: any) => r.serviceProviderID === currentUser.serviceProviderID));
          return;
        }
      }

      // � COMPANY_ADMIN / BRANCH_ADMIN → filter by company
      if (user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN") {
        const ctx = getSidebarContext();
        const companyID = ctx?.companyID ?? user?.companyID;
        if (companyID) {
          setRows(list.filter((r: any) => r.companyID === companyID));
        } else {
          setRows([]);
        }
        return;
      }

      // �🔵 EMPLOYEE → Filter by /manage-emp/credentials/all mapping
      const credsRes = await fetch("/backend/manage-emp/credentials/all");
      const creds = await credsRes.json();
      const emp = creds.find((c: any) => c.username === user?.username);

      if (emp) {
        const filtered = list.filter(
          (r: any) =>
            r.companyID === emp.companyID &&
            r.branchesID === emp.branchesID
        );
        setRows(filtered);
      } else {
        setRows([]);
      }
    } catch (err: any) {
      console.error("Failed to load promotions:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchRows();
  }, [user]);

  useEffect(() => {
    const handler = () => { if (user) fetchRows(); };
    window.addEventListener("sidebar-context-changed", handler);
    window.addEventListener("app-data-refresh", handler);
    return () => {
      window.removeEventListener("sidebar-context-changed", handler);
      window.removeEventListener("app-data-refresh", handler);
    };
  }, [user]);


  /** ======= debounced suggestion runners (SP/CO/BR/EMP/DEPT/DESG) ======= */
  const debouncedFetch = <T,>(conf: {
    q: string;
    min?: number;
    timerRef: React.MutableRefObject<any>;
    abortRef: React.MutableRefObject<AbortController | null>;
    setLoading: (b: boolean) => void;
    setList: (v: T[]) => void;
    endpoint: string;
    proj?: (x: any) => T[];
    filter?: (x: T) => boolean;
  }) => {
    const { q, min = MIN_CHARS, timerRef, abortRef, setLoading, setList, endpoint, proj, filter } = conf;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (q.length < min) { setList([] as T[]); return; }
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const raw = await fetchJSONSafe<any[]>(endpoint, ctrl.signal);
        const arr = proj ? proj(raw) : (raw as T[]);
        const out = filter ? arr.filter(filter) : arr;
        setList(out.slice(0, 20));
      } catch (e) {
        if ((e as any)?.name !== "AbortError") console.error("fetch error", endpoint, e);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  const runFetchSP = (q: string) =>
    debouncedFetch<SP>({
      q, timerRef: spTimerRef, abortRef: spAbortRef,
      setLoading: setSpLoading, setList: setSpList,
      endpoint: API.serviceProviders,
      proj: (raw) => raw as SP[],
      filter: (s) => (s.companyName ?? "").toLowerCase().includes(q.toLowerCase()),
    });

 const runFetchCO = (query: string) => {
  if (coTimerRef.current) clearTimeout(coTimerRef.current);

  coTimerRef.current = setTimeout(async () => {
    // ❗ Service Provider must be selected first
    if (!formData.serviceProviderID || query.length < MIN_CHARS) {
      setCoList([]);
      return;
    }

    if (coAbortRef.current) coAbortRef.current.abort();
    const ctrl = new AbortController();
    coAbortRef.current = ctrl;
    setCoLoading(true);

    try {
      let all = await fetchJSONSafe<CO[]>(API.companies, ctrl.signal);

      // 🔒 HARD FILTER: company MUST belong to selected service provider
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
    // company must be known
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
      let all = await fetchJSONSafe<BR[]>(API.branches, ctrl.signal);

      // 🔒 BOTH SUPERADMIN & MANAGER:
      // only branches of resolved company
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


  const runFetchEMP = (q: string) => {
  if (empTimerRef.current) clearTimeout(empTimerRef.current);

  empTimerRef.current = setTimeout(async () => {
    // 🔒 HARD STOP: branch + company must exist
    const companyID =
      user?.role === "SERVICE_PROVIDER"
        ? currentUserMapping?.companyID
        : formData.companyID;

    const branchID =
      user?.role === "SERVICE_PROVIDER"
        ? currentUserMapping?.branchesID
        : formData.branchesID;

    if (!companyID || !branchID || q.length < MIN_CHARS) {
      setEmpList([]);
      return;
    }

    empAbortRef.current?.abort();
    const ctrl = new AbortController();
    empAbortRef.current = ctrl;
    setEmpLoading(true);

    try {
      let all = await fetchJSONSafe<EmpRow[]>(API.manageEmp, ctrl.signal);

      // 🔒 HARD FILTER: company + branch
      all = (all || []).filter(
        e =>
          Number(e.companyID) === Number(companyID) &&
          Number(e.branchesID) === Number(branchID)
      );

      const ql = q.toLowerCase();
      const filtered = all.filter(e => {
        const name = `${e.employeeFirstName ?? ""} ${e.employeeLastName ?? ""}`.toLowerCase();
        const eid = (e.employeeID ?? "").toLowerCase();
        return name.includes(ql) || eid.includes(ql);
      });

      setEmpList(filtered.slice(0, 20));
    } catch (e) {
      if ((e as any).name !== "AbortError") {
        console.error("EMP fetch error:", e);
      }
    } finally {
      setEmpLoading(false);
    }
  }, DEBOUNCE_MS);
};






  const runFetchDeptNew = (q: string) =>
    debouncedFetch<Dept>({
      q,
      timerRef: deptNewTimerRef,
      abortRef: deptNewAbortRef,
      setLoading: setDeptNewLoading,
      setList: setDeptNewList,
      endpoint: API.departments,

      proj: (raw) => {
        if (!resolvedCompanyID || !resolvedBranchID) return [];
        return (raw as Dept[]).filter(
          (d) =>
            d.companyID === resolvedCompanyID &&
            d.branchesID === resolvedBranchID
        );
      },

      filter: (d) =>
        (d.departmentName ?? "")
          .toLowerCase()
          .includes(q.toLowerCase()),
    });




  const runFetchDesgNew = (q: string) =>
    debouncedFetch<Desg>({
      q,
      timerRef: desgNewTimerRef,
      abortRef: desgNewAbortRef,
      setLoading: setDesgNewLoading,
      setList: setDesgNewList,
      endpoint: API.designations,

      proj: (raw) => {
        if (!resolvedCompanyID || !resolvedBranchID) return [];
        return (raw as Desg[]).filter(
          (x) =>
            x.companyID === resolvedCompanyID &&
            x.branchesID === resolvedBranchID
        );
      },

      filter: (d) =>
        (d.designation ?? "")
          .toLowerCase()
          .includes(q.toLowerCase()),
    });


  const runFetchWorkShift = (q: string) =>
    debouncedFetch<any>({
      q,
      timerRef: workShiftTimerRef,
      abortRef: workShiftAbortRef,
      setLoading: setWorkShiftLoading,
      setList: setWorkShiftList,
      endpoint: API.workShifts,

      proj: (raw) => {
        if (!resolvedCompanyID || !resolvedBranchID) return [];
        return (raw as any[]).filter(
          (ws) =>
            ws.companyID === resolvedCompanyID &&
            ws.branchesID === resolvedBranchID
        );
      },

      filter: (x) =>
        (x.workShiftName ?? "")
          .toLowerCase()
          .includes(q.toLowerCase()),
    });



  const runFetchManager = (q: string) => {
    if (managerTimerRef.current) clearTimeout(managerTimerRef.current);

    managerTimerRef.current = setTimeout(async () => {
      // ❗ require company + branch
      if (!resolvedCompanyID || !resolvedBranchID || !q || q.length < MIN_CHARS) {
        setManagerList([]);
        return;
      }

      managerAbortRef.current?.abort();
      const ctrl = new AbortController();
      managerAbortRef.current = ctrl;

      setManagerLoading(true);

      try {
        let all = await fetchJSONSafe<any[]>(API.managers, ctrl.signal);

        // 🔒 HARD ORG SCOPE FILTER (SUPERADMIN + MANAGER)
        all = all.filter(
          (m) =>
            m.companyID === resolvedCompanyID &&
            m.branchesID === resolvedBranchID
        );

        const ql = q.toLowerCase();
        const filtered = all.filter((m) => {
          const first = (m.employeeFirstName ?? "").toLowerCase();
          const last = (m.employeeLastName ?? "").toLowerCase();
          const eid = (m.employeeID ?? "").toLowerCase();
          return (
            first.includes(ql) ||
            last.includes(ql) ||
            eid.includes(ql)
          );
        });

        setManagerList(filtered.slice(0, 20));
      } catch (e) {
        if ((e as any)?.name !== "AbortError") {
          console.error("Manager fetch error:", e);
        }
        setManagerList([]);
      } finally {
        setManagerLoading(false);
      }
    }, DEBOUNCE_MS);
  };



  const runFetchAttPolicy = (q: string) =>
    debouncedFetch<any>({
      q,
      timerRef: attPolicyTimerRef,
      abortRef: attPolicyAbortRef,
      setLoading: setAttPolicyLoading,
      setList: setAttPolicyList,
      endpoint: API.attendancePolicies,

      proj: (raw) => {
        if (!resolvedCompanyID) return [];
        return (raw as any[]).filter(
          (x) => x.companyID === resolvedCompanyID
        );
      },

      filter: (x) =>
        (x.attendancePolicyName ?? "")
          .toLowerCase()
          .includes(q.toLowerCase()),
    });


  const runFetchLeavePolicy = (q: string) =>
    debouncedFetch<any>({
      q,
      timerRef: leavePolicyTimerRef,
      abortRef: leavePolicyAbortRef,
      setLoading: setLeavePolicyLoading,
      setList: setLeavePolicyList,
      endpoint: API.leavePolicies,

      proj: (raw) => {
        if (!resolvedCompanyID) return [];
        return (raw as any[]).filter(
          (x) => x.companyID === resolvedCompanyID
        );
      },

      filter: (x) =>
        (x.leavePolicyName ?? "")
          .toLowerCase()
          .includes(q.toLowerCase()),
    });


  const runFetchMonthlyPG = (q: string) =>
    debouncedFetch<any>({
      q, timerRef: monthlyPGTimerRef, abortRef: monthlyPGAbortRef,
      setLoading: setMonthlyPGLoading, setList: setMonthlyPGList,
      endpoint: API.monthlyGrades,
      proj: (raw) => raw as any[],
      filter: (x) => (x.monthlyPayGradeName ?? "").toLowerCase().includes(q.toLowerCase()),
    });

  const runFetchHourlyPG = (q: string) =>
    debouncedFetch<any>({
      q, timerRef: hourlyPGTimerRef, abortRef: hourlyPGAbortRef,
      setLoading: setHourlyPGLoading, setList: setHourlyPGList,
      endpoint: API.hourlyGrades,
      proj: (raw) => raw as any[],
      filter: (x) => (x.hourlyPayGradeName ?? "").toLowerCase().includes(q.toLowerCase()),
    });




  /** close popovers on outside click */
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      [spRef, coRef, brRef, empRef, deptCurrRef, desgCurrRef, deptNewRef, desgNewRef, deptPropRef, desgPropRef].forEach((ref) => {
        if (ref.current && !ref.current.contains(t)) {
          if (ref === spRef) setSpList([]);
          if (ref === coRef) setCoList([]);
          if (ref === brRef) setBrList([]);
          if (ref === empRef) setEmpList([]);
          if (ref === deptCurrRef) setDeptCurrList([]);
          if (ref === desgCurrRef) setDesgCurrList([]);
          if (ref === deptNewRef) setDeptNewList([]);
          if (ref === desgNewRef) setDesgNewList([]);
          if (ref === deptPropRef) setDeptPropList([]);
          if (ref === desgPropRef) setDesgPropList([]);

          [workShiftRef, attPolicyRef, leavePolicyRef, monthlyPGRef, hourlyPGRef].forEach((ref) => {
            if (ref.current && !ref.current.contains(t)) {
              if (ref === workShiftRef) setWorkShiftList([]);
              if (ref === attPolicyRef) setAttPolicyList([]);
              if (ref === leavePolicyRef) setLeavePolicyList([]);
              if (ref === monthlyPGRef) setMonthlyPGList([]);
              if (ref === hourlyPGRef) setHourlyPGList([]);
              if (managerRef.current && !managerRef.current.contains(t)) setManagerList([]);

            }
          });

        }
      });
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // cleanup timers/aborts
  useEffect(() => {
    return () => {
      [spTimerRef, coTimerRef, brTimerRef, empTimerRef, deptCurrTimerRef, desgCurrTimerRef, deptNewTimerRef, desgNewTimerRef, deptPropTimerRef, desgPropTimerRef].forEach(t => { if (t.current) clearTimeout(t.current); });
      [spAbortRef, coAbortRef, brAbortRef, empAbortRef, deptCurrAbortRef, desgCurrAbortRef, deptNewAbortRef, desgNewAbortRef, deptPropAbortRef, desgPropAbortRef].forEach(a => a.current?.abort());
      // in unmount cleanup
      [workShiftTimerRef, attPolicyTimerRef, leavePolicyTimerRef, monthlyPGTimerRef, hourlyPGTimerRef]
        .forEach(t => { if (t.current) clearTimeout(t.current); });

      [workShiftAbortRef, attPolicyAbortRef, leavePolicyAbortRef, monthlyPGAbortRef, hourlyPGAbortRef]
        .forEach(a => a.current?.abort());

    };
  }, []);


  const filteredRows = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => {
      const empName = `${r.manageEmployee?.employeeFirstName ?? ""} ${r.manageEmployee?.employeeLastName ?? ""}`.toLowerCase();
      const empId = (r.manageEmployee?.employeeID ?? "").toLowerCase();
      const dept = (r.departments?.departmentName ?? "").toLowerCase();
      const desg = (r.designations?.designation ?? "").toLowerCase();
      const etype = (r.employmentType ?? "").toLowerCase();
      const estatus = (r.employmentStatus ?? "").toLowerCase();
      const ptype = (r.salaryPayGradeType ?? "").toLowerCase();
      return [empName, empId, dept, desg, etype, estatus, ptype].some((x) => x.includes(t));
    });
  }, [rows, searchTerm]);
  // History modal state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState<EmpPromotionRow[]>([]);

  const handleHistory = async (row: EmpPromotionRow) => {
    const empId = row.manageEmployeeID;
    let items = (allRows || []).filter((x) => x.manageEmployeeID === empId);

    // Sort from oldest to newest by date if available; otherwise by id
    const getTime = (x: any) => {
      const d = (x?.promotionDate ?? x?.createdAt) as string | undefined;
      const t = d ? Date.parse(d) : NaN;
      return Number.isNaN(t) ? undefined : t;
    };
    items.sort((a: any, b: any) => {
      const ta = getTime(a);
      const tb = getTime(b);
      if (ta != null && tb != null) return ta - tb;
      if (ta != null) return -1;
      if (tb != null) return 1;
      return (a?.id ?? 0) - (b?.id ?? 0);
    });

    setHistoryRows(items);
    setIsHistoryOpen(true);
  };




  /** ======= when employee selected, prefill "Current Position Information" ======= */
  const prefillFromEmployee = async (emp: EmpRow) => {
    // 🔹 Take the latest promotion row (highest id)
    const latest =
      emp.empPromotion && emp.empPromotion.length
        ? [...emp.empPromotion].sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0]
        : null;

    // Build full promotion object (include nulls)
    // If no promotion data, try to get current info from employee record itself
    const promotionObj = latest
      ? {
        id: latest.id,
        manageEmployeeID: latest.manageEmployeeID ?? emp.id ?? null,
        departmentNameID: latest.departmentNameID ?? null,
        designationID: latest.designationID ?? null,
        managerID: latest.managerID ?? null,
        employmentType: latest.employmentType ?? "",
        employmentStatus: latest.employmentStatus ?? "",
        probationPeriod: latest.probationPeriod ?? "",
        workShiftID: latest.workShiftID ?? null,
        attendancePolicyID: latest.attendancePolicyID ?? null,
        leavePolicyID: latest.leavePolicyID ?? null,
        salaryPayGradeType: latest.salaryPayGradeType ?? "",
        monthlyPayGradeID: latest.monthlyPayGradeID ?? null,
        hourlyPayGradeID: latest.hourlyPayGradeID ?? null,
      }
      : {
        id: undefined,
        manageEmployeeID: emp.id ?? null,
        // 🔹 FALLBACK: Try to get current info from employee record itself
        departmentNameID: (emp as any).departmentNameID ?? null,
        designationID: (emp as any).designationID ?? null,
        managerID: (emp as any).managerID ?? null,
        employmentType: (emp as any).employmentType ?? "",
        employmentStatus: (emp as any).employmentStatus ?? "",
        probationPeriod: (emp as any).probationPeriod ?? "",
        workShiftID: (emp as any).workShiftID ?? null,
        attendancePolicyID: (emp as any).attendancePolicyID ?? null,
        leavePolicyID: (emp as any).leavePolicyID ?? null,
        salaryPayGradeType: (emp as any).salaryPayGradeType ?? "",
        monthlyPayGradeID: (emp as any).monthlyPayGradeID ?? null,
        hourlyPayGradeID: (emp as any).hourlyPayGradeID ?? null,
      };


    // Extract nested relation names directly from latest promotion
    // If no promotion data, try to get from employee record's nested relations
    let deptName = latest?.departments?.departmentName ?? (emp as any).departments?.departmentName ?? "";
    let desgName = latest?.designations?.designation ?? (emp as any).designations?.designation ?? "";
    let workShiftName = latest?.workShift?.workShiftName ?? (emp as any).workShift?.workShiftName ?? "";
    let attendancePolicyName = latest?.attendancePolicy?.attendancePolicyName ?? (emp as any).attendancePolicy?.attendancePolicyName ?? "";
    let leavePolicyName = latest?.leavePolicy?.leavePolicyName ?? (emp as any).leavePolicy?.leavePolicyName ?? "";
    let monthlyPGName = latest?.monthlyPayGrade?.monthlyPayGradeName ?? (emp as any).monthlyPayGrade?.monthlyPayGradeName ?? "";
    let hourlyPGName = latest?.hourlyPayGrade?.hourlyPayGradeName ?? (emp as any).hourlyPayGrade?.hourlyPayGradeName ?? "";


    // If we don't have the nested data from promotion, try to fetch individual pieces

    if (!deptName && promotionObj.departmentNameID) {
      try {
        const dept = await fetchJSONSafe<{ departmentName?: string }>(`${API.departments}/${promotionObj.departmentNameID}`);
        deptName = dept?.departmentName ?? "";
      } catch (e) {
        console.warn("Could not fetch department name:", e);
      }
    }

    if (!desgName && promotionObj.designationID) {
      try {
        const desg = await fetchJSONSafe<{ designation?: string }>(`${API.designations}/${promotionObj.designationID}`);
        desgName = desg?.designation ?? "";
      } catch (e) {
        console.warn("Could not fetch designation name:", e);
      }
    }

    if (!workShiftName && promotionObj.workShiftID) {
      try {
        const ws = await fetchJSONSafe<{ workShiftName?: string }>(`${API.workShifts}/${promotionObj.workShiftID}`);
        workShiftName = ws?.workShiftName ?? "";
      } catch (e) {
        console.warn("Could not fetch work shift name:", e);
      }
    }

    if (!attendancePolicyName && promotionObj.attendancePolicyID) {
      try {
        const ap = await fetchJSONSafe<{ attendancePolicyName?: string }>(`${API.attendancePolicies}/${promotionObj.attendancePolicyID}`);
        attendancePolicyName = ap?.attendancePolicyName ?? "";
      } catch (e) {
        console.warn("Could not fetch attendance policy name:", e);
      }
    }

    if (!leavePolicyName && promotionObj.leavePolicyID) {
      try {
        const lp = await fetchJSONSafe<{ leavePolicyName?: string }>(`${API.leavePolicies}/${promotionObj.leavePolicyID}`);
        leavePolicyName = lp?.leavePolicyName ?? "";
      } catch (e) {
        console.warn("Could not fetch leave policy name:", e);
      }
    }

    if (!monthlyPGName && promotionObj.monthlyPayGradeID) {
      try {
        const mpg = await fetchJSONSafe<{ monthlyPayGradeName?: string }>(`${API.monthlyGrades}/${promotionObj.monthlyPayGradeID}`);
        monthlyPGName = mpg?.monthlyPayGradeName ?? "";
      } catch (e) {
        console.warn("Could not fetch monthly pay grade name:", e);
      }
    }

    if (!hourlyPGName && promotionObj.hourlyPayGradeID) {
      try {
        const hpg = await fetchJSONSafe<{ hourlyPayGradeName?: string }>(`${API.hourlyGrades}/${promotionObj.hourlyPayGradeID}`);
        hourlyPGName = hpg?.hourlyPayGradeName ?? "";
      } catch (e) {
        console.warn("Could not fetch hourly pay grade name:", e);
      }
    }

    // Base identity + promotion object
    setFormData((p) => ({
      ...p,
      manageEmployeeID: emp.id,
      empAutocomplete: `${emp.employeeFirstName ?? ""} ${emp.employeeLastName ?? ""} - ${emp.employeeID ?? ""}`.trim(),
      empID: emp.employeeID ?? "",
      serviceProviderID: emp.serviceProviderID ?? p.serviceProviderID,
      companyID: emp.companyID ?? p.companyID,
      branchesID: emp.branchesID ?? p.branchesID,

      // Save full promotion object into formData
      promotion: promotionObj,

      // Current position display fields populated from nested data
      currentDeptIdDisplay: promotionObj.departmentNameID != null ? String(promotionObj.departmentNameID) : "",
      currentDesgIdDisplay: promotionObj.designationID != null ? String(promotionObj.designationID) : "",
      currentManagerIdDisplay: promotionObj.managerID != null ? String(promotionObj.managerID) : "",
      currentDeptNameDisplay: deptName || (promotionObj.departmentNameID || promotionObj.designationID || promotionObj.workShiftID || promotionObj.attendancePolicyID || promotionObj.leavePolicyID ? "Loading..." : "Not assigned"),
      currentDesgNameDisplay: desgName || (promotionObj.departmentNameID || promotionObj.designationID || promotionObj.workShiftID || promotionObj.attendancePolicyID || promotionObj.leavePolicyID ? "Loading..." : "Not assigned"),
      currentCompanyNameDisplay: (emp as any).company?.companyName ?? p.coAutocomplete ?? "",
      currentBranchNameDisplay: (emp as any).branches?.branchName ?? p.brAutocomplete ?? "",
      currentSalaryPayGradeTypeDisplay: promotionObj.salaryPayGradeType || "Not set",
      currentEmploymentTypeDisplay: promotionObj.employmentType || "Not set",
      currentEmploymentStatusDisplay: promotionObj.employmentStatus || "Not set",
      currentProbationPeriodDisplay: promotionObj.probationPeriod,

      // Set autocomplete fields for current position
      deptCurrAutocomplete: deptName,
      desgCurrAutocomplete: desgName,

      // Set autocomplete fields for policies and grades
      workShiftAutocomplete: workShiftName || (promotionObj.workShiftID ? "Loading..." : "Not assigned"),
      attPolicyAutocomplete: attendancePolicyName || (promotionObj.attendancePolicyID ? "Loading..." : "Not assigned"),
      leavePolicyAutocomplete: leavePolicyName || (promotionObj.leavePolicyID ? "Loading..." : "Not assigned"),
      monthlyPGAutocomplete: promotionObj.salaryPayGradeType === "Monthly" ? (monthlyPGName || (promotionObj.monthlyPayGradeID ? "Loading..." : "Not assigned")) : "",
      hourlyPGAutocomplete: promotionObj.salaryPayGradeType === "Hourly" ? (hourlyPGName || (promotionObj.hourlyPayGradeID ? "Loading..." : "Not assigned")) : "",
    }));


    // 🔹 Resolve Manager name separately since it's not nested in promotion
    if (promotionObj.managerID) {
      try {
        const mgrEmp = await fetchJSONSafe<any>(`${API.manageEmp}/${promotionObj.managerID}`);
        const mgrName = mgrEmp
          ? `${mgrEmp.employeeFirstName ?? ""} ${mgrEmp.employeeLastName ?? ""}`.trim()
          : "";

        setFormData((p) => ({
          ...p,
          currentManagerNameDisplay: mgrName,
          managerAutocomplete: mgrName,
        }));
      } catch (e) {
        console.warn("Could not resolve manager name:", e);
      }
    }

    // 🔹 Still try latest emp-current-position for salary/effective dates
    try {
      const curr = await fetchJSONSafe<CurrentPos[]>(
        `${API.empCurrent}?manageEmployeeID=${emp.id}&take=1&skip=0`
      );
      const current = curr?.[0];
      if (current) {
        setFormData((p) => ({
          ...p,
          existingMonthlyPayGradeID: current.existingMonthlyPayGradeID ?? null,
          existingHourlyPayGradeID: current.existingHourlyPayGradeID ?? null,
          existingSalaryCtc:
            current.existingSalaryCtc != null ? String(current.existingSalaryCtc) : p.existingSalaryCtc,
          existingEmploymentType:
            current.existingEmploymentType != null ? String(current.existingEmploymentType) : p.existingEmploymentType,
          effectiveFrom: current.effectiveFrom ?? p.effectiveFrom,
          effectiveTo: current.effectiveTo ?? p.effectiveTo,
        }));
      }
    } catch (e) {
      console.warn("Could not prefill current position:", e);
    }
  };


  /** ======= CRUD submit (create/update both tables) ======= */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      /** ─────────────────────────────────────────────
       *  1) Upsert CURRENT (EmpCurrentPosition)
       *  - Keep your original mapping,
       *  - Send strings as strings (no Number(...) on employment type),
       *  - Only send defined fields.
       *  ────────────────────────────────────────────*/
      const curPayload: any = {
        serviceProviderID: formData.serviceProviderID ?? undefined,
        companyID: formData.companyID ?? undefined,
        branchesID: formData.branchesID ?? undefined,
        manageEmployeeID: formData.manageEmployeeID ?? undefined,

        existingDepartmentID: formData.existingDepartmentID ?? undefined,
        existingDesignationID: formData.existingDesignationID ?? undefined,
        existingMonthlyPayGradeID: formData.existingMonthlyPayGradeID ?? undefined,
        existingHourlyPayGradeID: formData.existingHourlyPayGradeID ?? undefined,

        // If your API expects number for CTC, keep Number(...); otherwise remove this cast.
        existingSalaryCtc:
          formData.existingSalaryCtc !== "" && formData.existingSalaryCtc != null
            ? Number(formData.existingSalaryCtc)
            : undefined,

        // IMPORTANT: send as string (e.g., "Company" / "Contract") if that's what your API expects
        existingEmploymentType:
          formData.existingEmploymentType && String(formData.existingEmploymentType).trim() !== ""
            ? String(formData.existingEmploymentType)
            : undefined,

        effectiveFrom: formData.effectiveFrom || undefined,
        effectiveTo: formData.effectiveTo || undefined,
      };

      if (editingRow?.current?.id) {
        const res = await fetch(`${API.empCurrent}/${editingRow.current.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(curPayload),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch(API.empCurrent, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(curPayload),
        });
        if (!res.ok) throw new Error(await res.text());
      }


      const promotionType = formData.promotion.salaryPayGradeType || null;

      const resolvedDepartmentID =
        formData.promotion.departmentNameID ??
        formData.newDepartmentID ??
        formData.proposedDepartmentID ??
        null;

      const resolvedDesignationID =
        formData.promotion.designationID ??
        formData.newDesignationID ??
        formData.proposedDesignationID ??
        null;

      const resolvedMonthlyPG =
        promotionType === "Monthly"
          ? (formData.promotion.monthlyPayGradeID ??
            formData.newMonthlyPayGradeID ??
            formData.proposedMonthlyPayGradeID ??
            null)
          : null;

      const resolvedHourlyPG =
        promotionType === "Hourly"
          ? (formData.promotion.hourlyPayGradeID ??
            formData.newHourlyPayGradeID ??
            formData.proposedHourlyPayGradeID ??
            null)
          : null;

      const empPromoPayload = {
        manageEmployeeID: formData.manageEmployeeID!, // required

        // Organization fields
        serviceProviderID: formData.serviceProviderID ?? null,
        companyID: formData.companyID ?? null,
        branchesID: formData.branchesID ?? null,

        departmentNameID: resolvedDepartmentID,
        designationID: resolvedDesignationID,
        managerID: formData.promotion.managerID ?? null,

        employmentType: formData.promotion.employmentType || null,   // "Company" | "Contract"
        employmentStatus: formData.promotion.employmentStatus || null,   // "Permanent" | "Probation"
        probationPeriod: formData.promotion.probationPeriod || null,

        workShiftID: formData.promotion.workShiftID ?? null,
        attendancePolicyID: formData.promotion.attendancePolicyID ?? null,
        leavePolicyID: formData.promotion.leavePolicyID ?? null,

        salaryPayGradeType: promotionType, // "Monthly" | "Hourly" | null
        monthlyPayGradeID: resolvedMonthlyPG,
        hourlyPayGradeID: resolvedHourlyPG,

        // Additional fields
        description: formData.description || null,
        promotedSalaryCtc:
          formData.newSalaryCtc && String(formData.newSalaryCtc).trim() !== ""
            ? Number(formData.newSalaryCtc)
            : null,
        promotionDate: formData.promotionDate || null,
        status: formData.status || null,
      };

      if (formData.promotion.id) {
        // update existing EmpPromotion row
        const res = await fetch(`${API.empPromotion}/${formData.promotion.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(empPromoPayload),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        // create new EmpPromotion row
        const res = await fetch(API.empPromotion, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(empPromoPayload),
        });
        if (!res.ok) throw new Error(await res.text());

        // Optional: capture created id so future saves PATCH instead of POST
        // const created = await res.json();
        // setFormData(p => ({ ...p, promotion: { ...p.promotion, id: created?.id } }));
      }

      await fetchRows();
      resetForm();
      setIsAddingNew(false);
      toast.success("Promotion saved successfully");
    } catch (e: any) {
      setError(e?.message || "Save failed");
      toast.error(e?.message || "Failed to save promotion");
    } finally {
      setSaving(false);
    }
  };


  const handleEdit = async (row: EmpPromotionRow) => {
    // Keep your existing "current" + "manage-emp" prefill logic
    let current: CurrentPos | null = null;
    if (row.manageEmployeeID) {
      try {
        const list = await fetchJSONSafe<CurrentPos[]>(
          `${API.empCurrent}?manageEmployeeID=${row.manageEmployeeID}&take=1&skip=0`
        );
        current = list?.[0] ?? null;
      } catch { }
    }

    setEditingRow({ current, promo: row });

    // Reuse prefillFromEmployee to hydrate names + current values
    if (row.manageEmployeeID) {
      const emp = await fetchJSONSafe<EmpRow>(`${API.manageEmp}/${row.manageEmployeeID}`);
      await prefillFromEmployee(emp);
    }

    // Seed the form's "promotion" block from this row
    setFormData((p) => ({
      ...p,
      manageEmployeeID: row.manageEmployeeID ?? null,
      // Populate service provider, company, branch fields
      serviceProviderID: (row as any).serviceProviderID ?? null,
      companyID: (row as any).companyID ?? null,
      branchesID: (row as any).branchesID ?? null,
      spAutocomplete: (row as any).serviceProvider?.companyName ?? "",
      coAutocomplete: (row as any).company?.companyName ?? "",
      brAutocomplete: (row as any).branches?.branchName ?? "",


      empAutocomplete: [
        row.manageEmployee?.employeeFirstName ?? "",
        row.manageEmployee?.employeeLastName ?? "",
        row.manageEmployee?.employeeID ? `- ${row.manageEmployee?.employeeID}` : ""
      ].join(" ").replace(/\s+/g, " ").trim(),

      // Populate promoted department/designation autocompletes
      deptNewAutocomplete: row.departments?.departmentName ?? "",
      desgNewAutocomplete: row.designations?.designation ?? "",

      // Populate description, promotion date, status
      description: (row as any).description ?? "",
      promotionDate: (row as any).promotionDate ? new Date((row as any).promotionDate).toISOString().split('T')[0] : "",
      status: (row as any).status ?? "Not Applied",
      newSalaryCtc: (row as any).promotedSalaryCtc != null ? String((row as any).promotedSalaryCtc) : p.newSalaryCtc,

      promotion: {
        id: row.id,
        manageEmployeeID: row.manageEmployeeID ?? null,
        departmentNameID: row.departmentNameID ?? null,
        designationID: row.designationID ?? null,
        managerID: row.managerID ?? null,
        employmentType: row.employmentType ?? "",
        employmentStatus: row.employmentStatus ?? "",
        probationPeriod: row.probationPeriod ?? "",
        workShiftID: row.workShiftID ?? null,
        attendancePolicyID: row.attendancePolicyID ?? null,
        leavePolicyID: row.leavePolicyID ?? null,
        salaryPayGradeType: row.salaryPayGradeType ?? "",
        monthlyPayGradeID: row.monthlyPayGradeID ?? null,
        hourlyPayGradeID: row.hourlyPayGradeID ?? null,
      },
      // instant display names
      currentDeptNameDisplay: row.departments?.departmentName ?? p.currentDeptNameDisplay,
      currentDesgNameDisplay: row.designations?.designation ?? p.currentDesgNameDisplay,
    }));

    // Clear suggestion lists to prevent highlighting/focus
    setTimeout(() => {
      setSpList([]);
      setCoList([]);
      setBrList([]);
    }, 0);

    setIsAddingNew(true);
  };



  // was: const handleView = (promo: PromotionReq) => {
  const handleView = (promo: EmpPromotionRow) => {
    setViewRow(promo as any); // if your view modal expects old shape, read from nested fields defensively
    setIsViewing(true);
  };


  // was: const handleDelete = async (id: ID) => { fetch(`${API.promotionReq}/${id}`, ... }
  const handleDelete = async (id: ID) => {
    if (!confirm("Delete this promotion?")) return;
    try {
      const res = await fetch(`${API.empPromotion}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Promotion deleted successfully");
    } finally {
      // Refresh list once so the deleted row disappears immediately (no multi-click)
      await fetchRows();
    }
  };


  /** ======= Reset ======= */
  const resetForm = () => {
    const ctx = getSidebarContext();
    setFormData({
      serviceProviderID: ctx?.serviceProviderID ?? null,
      companyID: ctx?.companyID ?? null,
      branchesID: null,
      spAutocomplete: ctx?.serviceProviderName ?? "",
      coAutocomplete: ctx?.companyName ?? "",
      brAutocomplete: "",

      manageEmployeeID: null,
      empAutocomplete: "",
      empID: "",

      existingDepartmentID: null,
      existingDesignationID: null,
      existingMonthlyPayGradeID: null,
      existingHourlyPayGradeID: null,
      existingSalaryCtc: "",
      existingEmploymentType: "",
      effectiveFrom: "",
      effectiveTo: "",

      deptCurrAutocomplete: "",
      desgCurrAutocomplete: "",

      newDepartmentID: null,
      newDesignationID: null,
      newMonthlyPayGradeID: null,
      newHourlyPayGradeID: null,
      newSalaryCtc: "",
      newEmploymentType: "",
      deptNewAutocomplete: "",
      desgNewAutocomplete: "",

      workShiftAutocomplete: "",
      attPolicyAutocomplete: "",
      leavePolicyAutocomplete: "",
      monthlyPGAutocomplete: "",
      hourlyPGAutocomplete: "",
      managerAutocomplete: "",


      proposedDepartmentID: null,
      proposedDesignationID: null,
      proposedMonthlyPayGradeID: null,
      proposedHourlyPayGradeID: null,
      proposedSalaryCtc: "",
      proposedEmploymentType: "",
      deptPropAutocomplete: "",
      desgPropAutocomplete: "",

      description: "",
      promotionDate: "",
      status: "Not Applied",
      transferTypes: [],

      // READ-ONLY current position (from /manage-emp)
      currentDeptIdDisplay: "",
      currentManagerIdDisplay: "",
      currentDesgIdDisplay: "",
      currentManagerNameDisplay: "",
      currentDeptNameDisplay: "",
      currentDesgNameDisplay: "",
      currentCompanyNameDisplay: "",
      currentBranchNameDisplay: "",
      currentSalaryPayGradeTypeDisplay: "",
      currentEmploymentTypeDisplay: "",
      currentEmploymentStatusDisplay: "",
      promotion: {
        id: undefined, manageEmployeeID: null, departmentNameID: null, designationID: null, managerID: null,
        employmentType: "", employmentStatus: "", probationPeriod: "", workShiftID: null, attendancePolicyID: null,
        leavePolicyID: null, salaryPayGradeType: "", monthlyPayGradeID: null, hourlyPayGradeID: null,
      },

    });
    setEditingRow(null);
    setError(null);
    setSpList([]); setCoList([]); setBrList([]); setEmpList([]);
    setDeptCurrList([]); setDesgCurrList([]); setDeptNewList([]); setDesgNewList([]); setDeptPropList([]); setDesgPropList([]);
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4 page-content-enter">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Create, read, update, and delete promotion requests & current positions</p>
        </div>

        {!isAddingNew && !isViewing && canManage && (
          <Button
            onClick={() => { resetForm(); setIsAddingNew(true); }}
            className="flex-shrink-0 text-sm px-3 py-2"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Promotion & Transfers
          </Button>
        )}
      </div>

      {/* Add/Edit FormDrawer */}
      <FormDrawer open={isAddingNew} onOpenChange={(v) => { if (!v) { resetForm(); setIsAddingNew(false); } }}
        title={editingRow ? "Edit Promotion / Current Position" : "Add New Promotion"}
        description={editingRow ? "Update both 'Current Position' and 'Promotion Request' below." : "Fill in details below to create both records."}>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* SP / Company / Branch (autocomplete) */}
              <div className="grid grid-cols-1 gap-4">
                {/* SP */}
                {/* SP / Company / Branch */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">

                  {/* Service Provider - auto-filled from sidebar */}
                  {false && (
                    <div ref={spRef} className="space-y-2 relative">
                      <Label>Service Provider *</Label>
                      <Input
                        value={formData.spAutocomplete}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((p) => ({ ...p, spAutocomplete: val, serviceProviderID: null }));
                          runFetchSP(val);
                        }}
                        onFocus={(e) => {
                          const val = e.target.value;
                          if (val.length >= MIN_CHARS) runFetchSP(val);
                        }}
                        placeholder="Start typing service provider…"
                        autoComplete="off"
                      />

                      {spList.length > 0 && (
                        <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                          {spLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                          {spList.map((s) => (
                            <div
                              key={s.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setFormData((p) => ({ ...p, serviceProviderID: s.id, spAutocomplete: s.companyName ?? "" }));
                                setSpList([]);
                              }}
                            >
                              {s.companyName}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Company - auto-filled from sidebar */}
                  {false && (
                    <div ref={coRef} className="space-y-2 relative">
                      <Label>Company *</Label>
                      <Input
                        value={formData.coAutocomplete}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((p) => ({ ...p, coAutocomplete: val, companyID: null }));
                          runFetchCO(val);
                        }}
                        onFocus={(e) => {
                          const val = e.target.value;
                          if (val.length >= MIN_CHARS) runFetchCO(val);
                        }}
                        placeholder="Start typing company…"
                        autoComplete="off"
                      />
                      {coList.length > 0 && (
                        <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                          {coLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                          {coList.map((c) => (
                            <div
                              key={c.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setFormData((p) => ({ ...p, companyID: c.id, coAutocomplete: c.companyName ?? "" }));
                                setCoList([]);
                              }}
                            >
                              {c.companyName}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* EVERYONE — BRANCH (filtered for MANAGER) */}
                  <div ref={brRef} className="space-y-2">
                    <Label>Branch *</Label>
                    <Input
                      value={formData.brAutocomplete}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((p) => ({ ...p, brAutocomplete: val, branchesID: null }));
                        runFetchBR(val);
                      }}
                      onFocus={(e) => {
                        const val = e.target.value;
                        if (val.length >= MIN_CHARS) runFetchBR(val);
                      }}
                      placeholder="Start typing branch…"
                      autoComplete="off"
                    />

                    {brList.length > 0 && (
                      <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                        {brLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                        {brList.map((b) => (
                          <div
                            key={b.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData((p) => ({
                                ...p,
                                branchesID: b.id,
                                brAutocomplete: b.branchName ?? "",
                              }));

                              // AUTO ASSIGN COMPANY + SP BASED ON BRANCH
                              setFormData((p) => ({
                                ...p,
                                serviceProviderID: (b as any).serviceProviderID ?? p.serviceProviderID,
                                companyID: (b as any).companyID ?? p.companyID,
                              }));

                              setBrList([]);
                            }}
                          >
                            {b.branchName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Employee selection (autocomplete) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div ref={empRef} className="space-y-2 relative">
                  <Label>Employee *</Label>
                  <Input
                    value={formData.empAutocomplete}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((p) => ({ ...p, empAutocomplete: val, manageEmployeeID: null, empID: "" }));
                      runFetchEMP(val);
                    }}
                    onFocus={(e) => {
                      const val = e.target.value;
                      if (val.length >= MIN_CHARS) runFetchEMP(val);
                    }}
                    placeholder="Type name or employee ID…"
                    autoComplete="off"
                    required
                  />
                  {empList.length > 0 && (
                    <div className="absolute z-10 bg-white border rounded w-full shadow max-h-56 overflow-y-auto">
                      {empLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                      {empList.map((m) => {
                        const label = `${m.employeeFirstName ?? ""} ${m.employeeLastName ?? ""}`.trim();
                        const eid = m.employeeID ?? "";
                        return (
                          <div
                            key={m.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={async () => {
                              try {
                                // Fetch full employee data with all nested relations
                                const fullEmp = await fetchJSONSafe<EmpRow>(`${API.manageEmp}/${m.id}`);
                                await prefillFromEmployee(fullEmp);
                              } catch (error) {
                                console.error("Error fetching full employee data:", error);
                                // Fallback to using the partial data
                                await prefillFromEmployee(m);
                              }
                              setEmpList([]);
                            }}
                          >
                            {label} {eid ? `- ${eid}` : ""}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Employee ID</Label>
                  <Input value={formData.empID} readOnly className="bg-gray-50" />
                </div>
              </div>

              {/* CURRENT POSITION (EmpCurrentPosition) */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Current Position Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Current Company</Label>
                    <Input
                      value={formData.currentCompanyNameDisplay}
                      readOnly
                      className="bg-gray-50"
                      placeholder="—"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Current Branch</Label>
                    <Input
                      value={formData.currentBranchNameDisplay}
                      readOnly
                      className="bg-gray-50"
                      placeholder="—"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Current Department </Label>
                    <Input
                      value={formData.currentDeptNameDisplay}
                      readOnly
                      className="bg-gray-50"
                      placeholder="—"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Current designation</Label>
                    <Input
                      value={formData.currentDesgNameDisplay}
                      readOnly
                      className="bg-gray-50"
                      placeholder="—"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Manager</Label>
                    <Input
                      value={formData.currentManagerNameDisplay}
                      readOnly
                      className="bg-gray-50"
                      placeholder="—"
                    />
                  </div>



                  <div className="space-y-2">
                    <Label>Current Paygrade</Label>
                    <Input
                      value={formData.currentSalaryPayGradeTypeDisplay}
                      readOnly
                      className="bg-gray-50"
                      placeholder="—"
                    />
                  </div>


                  <div className="space-y-2">
                    <Label>Employment Type</Label>
                    <Input
                      value={formData.currentEmploymentTypeDisplay}
                      readOnly
                      className="bg-gray-50"
                      placeholder="—"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Employment Status</Label>
                    <Input
                      value={formData.currentEmploymentStatusDisplay}
                      readOnly
                      className="bg-gray-50"
                      placeholder="—"
                    />
                  </div>
                  {formData.promotion.employmentStatus === "Probation" && (
                    <div className="space-y-2">
                      <Label>Probation Period</Label>
                      <Input
                        value={formData.promotion.probationPeriod || ""}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            promotion: { ...p.promotion, probationPeriod: e.target.value },
                          }))
                        }
                        placeholder="e.g. 6 months"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Work Shift</Label>
                    <Input
                      value={formData.workShiftAutocomplete}
                      readOnly
                      className="bg-gray-50"
                      placeholder="—"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Attendance Policy</Label>
                    <Input
                      value={formData.attPolicyAutocomplete}
                      readOnly
                      className="bg-gray-50"
                      placeholder="—"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Leave Policy</Label>
                    <Input
                      value={formData.leavePolicyAutocomplete}
                      readOnly
                      className="bg-gray-50"
                      placeholder="—"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Current Salary (CTC)</Label>
                    <Input
                      value={formData.existingSalaryCtc}
                      onChange={(e) => setFormData((p) => ({ ...p, existingSalaryCtc: e.target.value }))}
                      placeholder=""
                    />
                  </div>
                </div>

              </div>

              {/* PROMOTION REQUEST (new/proposed) */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Promotion Request</h3>

                {/* Transfer Type Selection */}
                <div className="space-y-2">
                  <Label>Transfer Type <span className="text-xs text-gray-400">(select what to change)</span></Label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { value: "company_transfer", label: "Company Transfer" },
                      { value: "branch_transfer", label: "Branch Transfer" },
                      { value: "department_transfer", label: "Department Transfer" },
                      { value: "designation_change", label: "Change of Designation" },
                    ].map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formData.transferTypes.includes(opt.value)}
                          onChange={(e) => {
                            setFormData((p) => ({
                              ...p,
                              transferTypes: e.target.checked
                                ? [...p.transferTypes, opt.value]
                                : p.transferTypes.filter((t: string) => t !== opt.value),
                            }));
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Transfer To Section - shown only when transfer types are selected */}
                {formData.transferTypes.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                  {/* Promoted Company - shown for company transfer */}
                  {formData.transferTypes.includes("company_transfer") && (
                    <div ref={coRef} className="space-y-2 relative">
                      <Label>Transfer To Company</Label>
                      <Input
                        value={formData.coAutocomplete}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((p) => ({ ...p, coAutocomplete: val, companyID: null }));
                          runFetchCO(val);
                        }}
                        onFocus={(e) => {
                          const val = e.target.value;
                          if (val.length >= MIN_CHARS) runFetchCO(val);
                        }}
                        placeholder="Type company…"
                        autoComplete="off"
                      />
                      {coList.length > 0 && (
                        <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                          {coLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                          {coList.map((c) => (
                            <div
                              key={c.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setFormData((p) => ({ ...p, companyID: c.id, coAutocomplete: c.companyName ?? "" }));
                                setCoList([]);
                              }}
                            >
                              {c.companyName}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Promoted Branch - shown for branch or company transfer */}
                  {(formData.transferTypes.includes("branch_transfer") || formData.transferTypes.includes("company_transfer")) && (
                    <div ref={brRef} className="space-y-2 relative">
                      <Label>Transfer To Branch</Label>
                      <Input
                        value={formData.brAutocomplete}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((p) => ({ ...p, brAutocomplete: val, branchesID: null }));
                          runFetchBR(val);
                        }}
                        onFocus={(e) => {
                          const val = e.target.value;
                          if (val.length >= MIN_CHARS) runFetchBR(val);
                        }}
                        placeholder="Type branch…"
                        autoComplete="off"
                      />
                      {brList.length > 0 && (
                        <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                          {brLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                          {brList.map((b) => (
                            <div
                              key={b.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setFormData((p) => ({
                                  ...p,
                                  branchesID: b.id,
                                  brAutocomplete: b.branchName ?? "",
                                  serviceProviderID: (b as any).serviceProviderID ?? p.serviceProviderID,
                                  companyID: (b as any).companyID ?? p.companyID,
                                }));
                                setBrList([]);
                              }}
                            >
                              {b.branchName}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Promoted Department - shown for department transfer */}
                  {formData.transferTypes.includes("department_transfer") && (
                  <div ref={deptNewRef} className="space-y-2 relative">
                    <Label>Transfer To Department</Label>
                    <Input
                      value={formData.deptNewAutocomplete}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((p) => ({
                          ...p,
                          deptNewAutocomplete: val,
                          // ⬇️ IMPORTANT: clear the promotion field while typing
                          promotion: { ...p.promotion, departmentNameID: null },
                        }));
                        runFetchDeptNew(val);
                      }}
                      onFocus={(e) => {
                        const val = e.target.value;
                        if (val.length >= MIN_CHARS) runFetchDeptNew(val);
                      }}
                      placeholder="Type department…"
                      autoComplete="off"
                    />
                    {deptNewList.length > 0 && (
                      <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                        {deptNewLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                        {deptNewList.map((d) => (
                          <div
                            key={d.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData((p) => ({
                                ...p,
                                deptNewAutocomplete: d.departmentName ?? "",
                                // ⬇️ IMPORTANT: write to promotion
                                promotion: { ...p.promotion, departmentNameID: d.id },
                              }));
                              setDeptNewList([]);
                            }}
                          >
                            {d.departmentName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}


                  {/* desg new */}
                  {/* Promoted designation - shown for designation change */}
                  {formData.transferTypes.includes("designation_change") && (
                  <div ref={desgNewRef} className="space-y-2 relative">
                    <Label>Transfer To Designation</Label>
                    <Input
                      value={formData.desgNewAutocomplete}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((p) => ({
                          ...p,
                          desgNewAutocomplete: val,
                          // ⬇️ IMPORTANT: clear the promotion field while typing
                          promotion: { ...p.promotion, designationID: null },
                        }));
                        runFetchDesgNew(val);
                      }}
                      onFocus={(e) => {
                        const val = e.target.value;
                        if (val.length >= MIN_CHARS) runFetchDesgNew(val);
                      }}
                      placeholder="Type designation…"
                      autoComplete="off"
                    />
                    {desgNewList.length > 0 && (
                      <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                        {desgNewLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                        {desgNewList.map((d) => (
                          <div
                            key={d.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData((p) => ({
                                ...p,
                                desgNewAutocomplete: d.designation ?? "",
                                // ⬇️ IMPORTANT: write to promotion
                                promotion: { ...p.promotion, designationID: d.id },
                              }));
                              setDesgNewList([]);
                            }}
                          >
                            {d.designation}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}



                  {/* Promoted Manager */}
                  <div ref={managerRef} className="space-y-2 relative">
                    <Label>Promoted Manager</Label>
                    <Input
                      value={formData.managerAutocomplete}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((p) => ({
                          ...p,
                          managerAutocomplete: val,
                          promotion: { ...p.promotion, managerID: null }, // clear while typing
                        }));
                        runFetchManager(val);
                      }}
                      onFocus={(e) => {
                        const val = e.target.value;
                        if (val.length >= MIN_CHARS) runFetchManager(val);
                      }}
                      placeholder="Type manager name or employee ID…"
                      autoComplete="off"
                    />
                    {managerList.length > 0 && (
                      <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                        {managerLoading && (
                          <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>
                        )}
                        {managerList.map((m) => {
                          const full = `${m.employeeFirstName ?? ""} ${m.employeeLastName ?? ""}`.trim();
                          return (
                            <div
                              key={m.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setFormData((p) => ({
                                  ...p,
                                  managerAutocomplete: full || (m.employeeID ?? String(m.id)),
                                  promotion: { ...p.promotion, managerID: m.id },
                                }));
                                setManagerList([]);
                              }}
                            >
                              <div className="text-sm">{full || "—"}</div>
                              <div className="text-xs text-gray-500">{m.employeeID ?? ""}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>




                  {/* Promoted Paygrade Type */}
                  <div className="space-y-2">
                    <Label>Promoted Paygrade</Label>
                    <Select
                      value={formData.promotion.salaryPayGradeType || ""}
                      onValueChange={(val) =>
                        setFormData((p) => ({
                          ...p,
                          // keep a display copy if you still use it elsewhere
                          currentSalaryPayGradeTypeDisplay: val,

                          // update promotion and clear the opposite side to avoid stale IDs
                          promotion: {
                            ...p.promotion,
                            salaryPayGradeType: val,
                            monthlyPayGradeID: val === "Monthly" ? p.promotion.monthlyPayGradeID : null,
                            // hourlyPayGradeID:  val === "Hourly"  ? p.promotion.hourlyPayGradeID  : null,
                          },

                          // clear the opposite autocomplete label as well
                          monthlyPGAutocomplete: val === "Monthly" ? p.monthlyPGAutocomplete : "",
                          // hourlyPGAutocomplete:  val === "Hourly"  ? p.hourlyPGAutocomplete  : "",
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select paygrade type…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                        {/* <SelectItem value="Hourly">Hourly</SelectItem> */}
                      </SelectContent>
                    </Select>
                  </div>



                  {/* Promoted Employment Type (Company / Contract) */}
                  <div className="space-y-2">
                    <Label>Employment Type</Label>
                    <Select
                      value={formData.promotion.employmentType || ""}
                      onValueChange={(val) =>
                        setFormData((p) => ({
                          ...p,
                          // keep the "current" display untouched; only set the proposed/promotion value
                          promotion: { ...p.promotion, employmentType: val },
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select employment type…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Company">Company</SelectItem>
                        <SelectItem value="Contract">Contract</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>


                  {/* Promoted Employment Status */}
                  <div className="space-y-2">
                    <Label>Employment Status</Label>
                    <Select
                      value={formData.promotion.employmentStatus || ""}
                      onValueChange={(val) =>
                        setFormData((p) => ({
                          ...p,
                          promotion: { ...p.promotion, employmentStatus: val },
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select employment status…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Permanent">Permanent</SelectItem>
                        <SelectItem value="Probation">Probation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>



                  {formData.promotion.employmentStatus === "Probation" && (
                    <div className="space-y-2">
                      <Label>Probation Period</Label>
                      <Input
                        value={formData.promotion.probationPeriod || ""}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            promotion: { ...p.promotion, probationPeriod: e.target.value },
                          }))
                        }
                        placeholder="e.g. 6 months"
                      />
                    </div>
                  )}

                  <div ref={workShiftRef} className="space-y-2 relative">
                    <Label>Work Shift</Label>
                    <Input
                      value={formData.workShiftAutocomplete}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((p) => ({
                          ...p,
                          workShiftAutocomplete: val,
                          promotion: { ...p.promotion, workShiftID: null },
                        }));
                        runFetchWorkShift(val);
                      }}
                      onFocus={(e) => {
                        const val = e.target.value;
                        if (val.length >= MIN_CHARS) runFetchWorkShift(val);
                      }}
                      placeholder="Type work shift…"
                      autoComplete="off"
                    />
                    {workShiftList.length > 0 && (
                      <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                        {workShiftLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                        {workShiftList.map((ws) => (
                          <div
                            key={ws.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData((p) => ({
                                ...p,
                                workShiftAutocomplete: ws.workShiftName ?? String(ws.id),
                                promotion: { ...p.promotion, workShiftID: ws.id },
                              }));
                              setWorkShiftList([]);
                            }}
                          >
                            {ws.workShiftName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>


                  <div ref={attPolicyRef} className="space-y-2 relative">
                    <Label>Attendance Policy</Label>
                    <Input
                      value={formData.attPolicyAutocomplete}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((p) => ({
                          ...p,
                          attPolicyAutocomplete: val,
                          promotion: { ...p.promotion, attendancePolicyID: null },
                        }));
                        runFetchAttPolicy(val);
                      }}
                      onFocus={(e) => {
                        const val = e.target.value;
                        if (val.length >= MIN_CHARS) runFetchAttPolicy(val);
                      }}
                      placeholder="Type attendance policy…"
                      autoComplete="off"
                    />
                    {attPolicyList.length > 0 && (
                      <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                        {attPolicyLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                        {attPolicyList.map((ap) => (
                          <div
                            key={ap.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData((p) => ({
                                ...p,
                                attPolicyAutocomplete: ap.attendancePolicyName ?? String(ap.id),
                                promotion: { ...p.promotion, attendancePolicyID: ap.id },
                              }));
                              setAttPolicyList([]);
                            }}
                          >
                            {ap.attendancePolicyName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div ref={leavePolicyRef} className="space-y-2 relative">
                    <Label>Leave Policy</Label>
                    <Input
                      value={formData.leavePolicyAutocomplete}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((p) => ({
                          ...p,
                          leavePolicyAutocomplete: val,
                          promotion: { ...p.promotion, leavePolicyID: null },
                        }));
                        runFetchLeavePolicy(val);
                      }}
                      onFocus={(e) => {
                        const val = e.target.value;
                        if (val.length >= MIN_CHARS) runFetchLeavePolicy(val);
                      }}
                      placeholder="Type leave policy…"
                      autoComplete="off"
                    />
                    {leavePolicyList.length > 0 && (
                      <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                        {leavePolicyLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                        {leavePolicyList.map((lp) => (
                          <div
                            key={lp.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData((p) => ({
                                ...p,
                                leavePolicyAutocomplete: lp.leavePolicyName ?? String(lp.id),
                                promotion: { ...p.promotion, leavePolicyID: lp.id },
                              }));
                              setLeavePolicyList([]);
                            }}
                          >
                            {lp.leavePolicyName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>


                  {formData.promotion.salaryPayGradeType === "Monthly" && /* Monthly block here */

                    <div ref={monthlyPGRef} className="space-y-2 relative">
                      <Label>Monthly Pay Grade</Label>
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
                        placeholder="Type monthly pay grade…"
                        autoComplete="off"
                      />
                      {monthlyPGList.length > 0 && (
                        <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                          {monthlyPGLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                          {monthlyPGList.map((pg) => (
                            <div
                              key={pg.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setFormData((p) => ({
                                  ...p,
                                  monthlyPGAutocomplete: pg.monthlyPayGradeName ?? String(pg.id),
                                  promotion: { ...p.promotion, monthlyPayGradeID: pg.id },
                                }));
                                setMonthlyPGList([]);
                              }}
                            >
                              {pg.monthlyPayGradeName}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  }

                  {formData.promotion.salaryPayGradeType === "Hourly" && /* Hourly block here */

                    <div ref={hourlyPGRef} className="space-y-2 relative">
                      <Label>Hourly Pay Grade</Label>
                      <Input
                        value={formData.hourlyPGAutocomplete}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((p) => ({
                            ...p,
                            hourlyPGAutocomplete: val,
                            promotion: { ...p.promotion, hourlyPayGradeID: null },
                          }));
                          runFetchHourlyPG(val);
                        }}
                        onFocus={(e) => {
                          const val = e.target.value;
                          if (val.length >= MIN_CHARS) runFetchHourlyPG(val);
                        }}
                        placeholder="Type hourly pay grade…"
                        autoComplete="off"
                      />
                      {hourlyPGList.length > 0 && (
                        <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                          {hourlyPGLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                          {hourlyPGList.map((pg) => (
                            <div
                              key={pg.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setFormData((p) => ({
                                  ...p,
                                  hourlyPGAutocomplete: pg.hourlyPayGradeName ?? String(pg.id),
                                  promotion: { ...p.promotion, hourlyPayGradeID: pg.id },
                                }));
                                setHourlyPGList([]);
                              }}
                            >
                              {pg.hourlyPayGradeName}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  }




                  <div className="space-y-2">
                    <Label>Promoted Salary</Label>
                    <Input
                      value={formData.newSalaryCtc}
                      onChange={(e) => setFormData((p) => ({ ...p, newSalaryCtc: e.target.value }))}
                      placeholder="e.g. 600000"
                    />
                  </div>


                </div>
                )}



                {/* Description / date */}
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                    placeholder="Reason / details of promotion"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Promotion Date</Label>
                    <Input
                      type="date"
                      value={formData.promotionDate}
                      onChange={(e) => setFormData((p) => ({ ...p, promotionDate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => { resetForm(); setIsAddingNew(false); }}>
                  Cancel
                </Button>
                <Button type="submit" className="" disabled={saving}>
                  {saving ? "Saving..." : editingRow ? "Update" : "Create"}
                </Button>
              </div>
            </form>
      </FormDrawer>

      {/* View Details FormDrawer */}
      <FormDrawer open={!!(isViewing && viewRow)} onOpenChange={(v) => { if (!v) { setIsViewing(false); setViewRow(null); } }}
        title="Promotion Request"
        description="Read-only details">
          {viewRow && (
            <div className="space-y-3 text-sm">
              <p><strong>Employee ID:</strong> {viewRow.empID ?? "—"}</p>
              <p><strong>Status:</strong> {viewRow.status ?? "—"}</p>
              <p><strong>New Dept/Desg:</strong> {String(viewRow.newDepartmentID ?? "—")} / {String(viewRow.newDesignationID ?? "—")}</p>
              <p><strong>Proposed Dept/Desg:</strong> {String(viewRow.proposedDepartmentID ?? "—")} / {String(viewRow.proposedDesignationID ?? "—")}</p>
              <p><strong>Promotion Date:</strong> {viewRow.promotionDate ?? "—"}</p>
              <p><strong>Description:</strong> {viewRow.description ?? "—"}</p>
            </div>
          )}
      </FormDrawer>

      {/* Search + Table - only when neither form nor view is open */}
      {!isAddingNew && !isViewing && (
        <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search promotion requests…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredRows.length} items
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:trending-up" className="w-5 h-5" />
            Promotion Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 w-full">
          <div className="overflow-x-auto w-full">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead className="w-[120px]">Employee ID</TableHead>
                  <TableHead className="w-[120px]">New Dept</TableHead>
                  <TableHead className="w-[120px]">New Desg</TableHead>
                  {/* <TableHead className="w-[120px]">Proposed Dept</TableHead>
                  <TableHead className="w-[120px]">Proposed Desg</TableHead> */}
                  <TableHead className="w-[120px]">Promotion Date</TableHead>
                  <TableHead className="w-[100px] text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 && !loading && (
                  <TableRow>
                    {/* 8 columns in header => colSpan=8 */}
                    <TableCell colSpan={8} className="text-center text-sm text-gray-500 py-2">
                      No records
                    </TableCell>
                  </TableRow>
                )}

                {filteredRows.map((r) => {
                  const empId = r.manageEmployee?.employeeID ?? "—";
                  const empName = `${r.manageEmployee?.employeeFirstName ?? ""} ${r.manageEmployee?.employeeLastName ?? ""}`.trim();

                  const newDept = r.departments?.departmentName?.trim() ?? "—";
                  const newDesg = r.designations?.designation?.trim() ?? "—";

                  // Use the same data for proposed fields since they represent the promoted values
                  const proposedDept = r.departments?.departmentName?.trim() ?? "—";
                  const proposedDesg = r.designations?.designation?.trim() ?? "—";

                  // /emp-promotion has no official date; try promotionDate if present, else createdAt, else —
                  const promoDate =
                    (r as any)?.promotionDate
                      ? new Date((r as any).promotionDate).toLocaleDateString()
                      : (r as any)?.createdAt
                        ? new Date((r as any).createdAt).toLocaleDateString()
                        : "—";

                  return (
                    <TableRow key={r.id} className="h-10">
                      {/* Status */}
                      <TableCell className="whitespace-nowrap py-2">
                        {r.employmentStatus ?? "—"}
                      </TableCell>

                      {/* Employee ID */}
                      <TableCell className="whitespace-nowrap py-2">
                        <div className="font-medium">{empId}</div>
                        <div className="text-xs text-gray-500">{empName || "\u00A0"}</div>
                      </TableCell>

                      {/* New Dept */}
                      <TableCell className="whitespace-nowrap py-2">{newDept}</TableCell>

                      {/* New Desg */}
                      <TableCell className="whitespace-nowrap py-2">{newDesg}</TableCell>

                      {/* Proposed Dept (placeholder) */}
                      {/* <TableCell className="whitespace-nowrap">{proposedDept}</TableCell> */}

                      {/* Proposed Desg (placeholder) */}
                      {/* <TableCell className="whitespace-nowrap">{proposedDesg}</TableCell> */}

                      {/* Promotion Date */}
                      <TableCell className="whitespace-nowrap py-2">{promoDate}</TableCell>

                      {/* Actions */}
                      <TableCell className="text-right py-1">
                        <div className="inline-flex items-center gap-1">
                          {/* 👁 Everyone can view */}
                          <Button variant="ghost" size="icon" onClick={() => handleView(r)} title="View">
                            <Eye className="h-4 w-4" />
                          </Button>

                          {/* ✏️ Only SUPERADMIN and MANAGER can edit */}
                          {canManage && (
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(r)} title="Edit">
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}

                          {/* 🕓 Everyone can view history */}
                          <Button variant="ghost" size="icon" onClick={() => handleHistory(r)} title="History">
                            <History className="h-4 w-4" />
                          </Button>

                          {/* 🗑️ Only SUPERADMIN and MANAGER can delete */}
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(r.id)}
                              title="Delete"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>


            </Table>
          </div>
        </CardContent>
      </Card>
      </>
      )}
      {/* History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Promotion History</DialogTitle>
            <DialogDescription>All promotions for this employee</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Promotion Date</TableHead>
                  <TableHead className="w-[160px]">Department</TableHead>
                  <TableHead className="w-[160px]">designation</TableHead>
                  <TableHead className="w-[120px]">Paygrade</TableHead>
                  <TableHead className="w-[140px]">Emp. Type</TableHead>
                  <TableHead className="w-[140px]">Emp. Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500">No history</TableCell>
                  </TableRow>
                ) : (
                  historyRows.map((hr) => {
                    const promoDate = (hr as any)?.promotionDate
                      ? new Date((hr as any).promotionDate).toLocaleDateString()
                      : (hr as any)?.createdAt
                        ? new Date((hr as any).createdAt).toLocaleDateString()
                        : "—";
                    return (
                      <TableRow key={hr.id}>
                        <TableCell className="whitespace-nowrap">{promoDate}</TableCell>
                        <TableCell className="whitespace-nowrap">{hr.departments?.departmentName ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{hr.designations?.designation ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{hr.salaryPayGradeType ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{hr.employmentType ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{hr.employmentStatus ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsHistoryOpen(false)} variant="outline">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}