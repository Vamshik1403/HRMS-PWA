"use client";
import { TableBodySkeleton } from "../components/ui/TableBodySkeleton";

import { hasCompanyAccessFlag, hasModuleWriteAccess, isCompanyOwnerFlag } from "@/lib/companyAccess";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
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
import { Plus, Search, Edit, Trash2, Eye, X, Save, RotateCcw, Filter, BadgeCheck } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { FormDrawer } from "../components/ui/form-drawer";
import { NoticeBanner } from "../components/ui/notice-banner";
import { PageHeader } from "../components/app/page-header";
import { FilterBar, FilterSelect } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import type { DataTableColumn } from "../components/app/data-table";
import { EntityRowActions } from "../components/app/entity-row-actions";
import { DetailCard } from "../components/app/detail-card";
import { EntityDetailHero, EntityDetailLayout } from "../components/app/entity-detail-layout";
import { useClientTable, sortRows } from "../hooks/use-client-table";
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";
import {
  canDesktopManagerManage,
  isCompanyModuleOperator,
  resolveScopedCompanyId,
  resolveScopedServiceProviderId,
  resolveScopeUserMapping,
} from "../utils/scopeContext";
// ---------------------------
// Types aligned to backend
// ---------------------------
type ID = number;

interface DesignationRead {
  id: ID;
  serviceProviderID?: ID | null;
  companyID?: ID | null;
  branchesID?: ID | null;
  departmentID?: ID | null;
  designation?: string | null;
  shiftEligibility?: string | null;
  nightShiftEligibility?: string | null;
  maxHoursPerDay?: string | null;
  weeklyOffPattern?: string | null;
  noticePeriodDaysForResignation?: string | null;
  noticePeriodDaysForTermination?: string | null;
  createdAt?: string | null;

  // optional nested if API includes them
  serviceProvider?: { id: ID; companyName?: string | null } | null;
  company?: { id: ID; companyName?: string | null } | null;
  branches?: { id: ID; branchName?: string | null } | null;
  departments?: { id: ID; departmentName?: string | null } | null;

  // optional denormalized name fallbacks
  serviceProviderName?: string | null;
  companyName?: string | null;
  branchName?: string | null;
  departmentName?: string | null;
}

interface ServiceProvider { id: ID; companyName: string; }
interface Company { 
  id: ID; 
  companyName: string; 
  serviceProviderID?: ID | null; 
}
interface Branch { 
  id: ID; 
  branchName: string; 
  serviceProviderID?: ID | null; 
  companyID?: ID | null; 
}
interface Department { 
  id: ID; 
  departmentName: string; 
  serviceProviderID?: ID | null; 
  companyID?: ID | null; 
  branchesID?: ID | null; 
}

// ---------------------------
/* Config & helpers */
// ---------------------------
const API = {
  designations: "/backend/designations",
  designationsList: "/backend/designations/list",
  serviceProviders: "/backend/service-provider",
  companies: "/backend/company",
  branches: "/backend/branches",
  departments: "/backend/departments",
};

const MIN_CHARS = 0;
const DEBOUNCE_MS = 250;

async function fetchJSONSafe<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const raw = await res.json();
  return (raw?.data ?? raw) as T;
}

// ---------------------------
// Component
// ---------------------------
export function DesignationManagement() {
  // Data
  const [rows, setRows] = useState<DesignationRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);

  const user = useCurrentUser();
  useEffect(() => {
    if (!user || (user.role !== "SERVICE_PROVIDER" && user.role !== "COMPANY_ADMIN" && user.role !== "ADMIN")) return;

    const loadMapping = async () => {
      try {
        const res = await fetch("/backend/users");
        const allUsers = await res.json();
        const found = allUsers.find((u: any) => u.username === user.username);
        if (found) {
          setCurrentUserMapping(found);
        }
      } catch (err) {
        console.error("Failed to load mapping for MANAGER:", err);
      }
    };

    loadMapping();
  }, [user]);

  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN" || user?.role === "BRANCH_ADMIN" || hasModuleWriteAccess("DESIGNATIONS");
  const isEmployee = user?.role === "EMPLOYEE";
  // Company owners authenticate as EMPLOYEE but still need Branch/Department fields.
  const showOrgFields =
    !isEmployee ||
    isCompanyModuleOperator(user) ||
    hasCompanyAccessFlag() ||
    isCompanyOwnerFlag() ||
    hasModuleWriteAccess("DESIGNATIONS");

  // UI
const table = useClientTable("designation");
const [branchFilter, setBranchFilter] = useState("ALL");
const [departmentFilter, setDepartmentFilter] = useState("ALL");

const [branchFilterList, setBranchFilterList] = useState<Branch[]>([]);
const [departmentFilterList, setDepartmentFilterList] = useState<Department[]>([]);
const [filterLoading, setFilterLoading] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [editing, setEditing] = useState<DesignationRead | null>(null);
  const [viewRow, setViewRow] = useState<DesignationRead | null>(null);

  // Master lists
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);

  // Filtered lists for display (suggestions based on typing)
  const [suggestedCompanies, setSuggestedCompanies] = useState<Company[]>([]);
  const [suggestedBranches, setSuggestedBranches] = useState<Branch[]>([]);
  const [suggestedDepartments, setSuggestedDepartments] = useState<Department[]>([]);

  // Loading states
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  // Refs for outside click handling
  const spRef = useRef<HTMLDivElement>(null);
  const coRef = useRef<HTMLDivElement>(null);
  const brRef = useRef<HTMLDivElement>(null);
  const deptRef = useRef<HTMLDivElement>(null);

  // lookup maps
  const [spMap, setSpMap] = useState<Record<number, string>>({});
  const [coMap, setCoMap] = useState<Record<number, string>>({});
  const [brMap, setBrMap] = useState<Record<number, string>>({});
  const [deptMap, setDeptMap] = useState<Record<number, string>>({});

  // Form state
  const [formData, setFormData] = useState({
    serviceProviderID: null as ID | null,
    companyID: null as ID | null,
    branchesID: null as ID | null,
    departmentID: null as ID | null,

    designation: "",
    otApplicable: "",
    noticePeriodDaysForResignation: "",
    noticePeriodDaysForTermination: "",

    spAutocomplete: "",
    coAutocomplete: "",
    brAutocomplete: "",
    deptAutocomplete: "",
  });

  // Flag to skip cascade clearing during programmatic resets
  const skipCascadeRef = useRef(false);

  // Timers for debouncing
  const companyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const branchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const masterDataLoadedRef = useRef(false);

  // Load master data only when opening add/edit/view forms (not on list mount).
  useEffect(() => {
    if (!isAddingNew && !isViewing) return;
    if (masterDataLoadedRef.current) return;
    masterDataLoadedRef.current = true;

    const loadAllData = async () => {
      try {
        const [sps, cos, brs, depts] = await Promise.all([
          fetchJSONSafe<ServiceProvider[]>(API.serviceProviders),
          fetchJSONSafe<Company[]>(API.companies),
          fetchJSONSafe<Branch[]>(API.branches),
          fetchJSONSafe<Department[]>(API.departments),
        ]);

        setAllCompanies(cos || []);
        setAllBranches(brs || []);
        setAllDepartments(depts || []);

        setSpMap(Object.fromEntries((sps || []).map(s => [s.id, s.companyName ?? ""])));
        setCoMap(Object.fromEntries((cos || []).map(c => [c.id, c.companyName ?? ""])));
        setBrMap(Object.fromEntries((brs || []).map(b => [b.id, b.branchName ?? ""])));
        setDeptMap(Object.fromEntries((depts || []).map(d => [d.id, d.departmentName ?? ""])));
      } catch (error) {
        console.error("Failed to load master data:", error);
      }
    };

    loadAllData();
  }, [isAddingNew, isViewing]);

  // Clear dependent fields when parent changes (only for add mode, skip during reset)
  useEffect(() => {
    if (skipCascadeRef.current) return;
    if (!editing) {
      if (formData.serviceProviderID) {
        setFormData(prev => ({
          ...prev,
          companyID: null,
          branchesID: null,
          departmentID: null,
          coAutocomplete: "",
          brAutocomplete: "",
          deptAutocomplete: "",
        }));
        setSuggestedCompanies([]);
        setSuggestedBranches([]);
        setSuggestedDepartments([]);
      }
    }
  }, [formData.serviceProviderID, editing]);

  useEffect(() => {
    if (skipCascadeRef.current) return;
    if (!editing) {
      if (formData.companyID) {
        setFormData(prev => ({
          ...prev,
          branchesID: null,
          departmentID: null,
          brAutocomplete: "",
          deptAutocomplete: "",
        }));
        setSuggestedBranches([]);
        setSuggestedDepartments([]);
      }
    }
  }, [formData.companyID, editing]);

  useEffect(() => {
    if (skipCascadeRef.current) return;
    if (!editing) {
      if (formData.branchesID) {
        setFormData(prev => ({
          ...prev,
          departmentID: null,
          deptAutocomplete: "",
        }));
        setSuggestedDepartments([]);
      }
    }
  }, [formData.branchesID, editing]);

  
  const fetchFilterLists = async () => {
  try {
    setFilterLoading(true);

    const [branchesRes, departmentsRes] = await Promise.all([
      fetchJSONSafe<Branch[]>(API.branches),
      fetchJSONSafe<Department[]>(API.departments),
    ]);

    const activeCompanyID =
      resolveScopedCompanyId({
        ...user,
        companyID: user?.companyID ?? currentUserMapping?.companyID,
      }) ??
      user?.companyID ??
      currentUserMapping?.companyID ??
      null;

    let branches = Array.isArray(branchesRes) ? branchesRes : [];
    let departments = Array.isArray(departmentsRes) ? departmentsRes : [];

    if (activeCompanyID) {
      branches = branches.filter(
        (b) => Number(b.companyID) === Number(activeCompanyID)
      );

      departments = departments.filter(
        (d) => Number(d.companyID) === Number(activeCompanyID)
      );
    }

    if (user?.role === "BRANCH_ADMIN") {
      const branchID = currentUserMapping?.branchesID ?? user?.branchesID;

      if (branchID) {
        branches = branches.filter((b) => Number(b.id) === Number(branchID));
        departments = departments.filter(
          (d) => Number(d.branchesID) === Number(branchID)
        );

        setBranchFilter(String(branchID));
      }
    }

    setBranchFilterList(branches);
    setDepartmentFilterList(departments);
  } catch (e) {
    console.error("Failed to load filter lists:", e);
    setBranchFilterList([]);
    setDepartmentFilterList([]);
  } finally {
    setFilterLoading(false);
  }
};

  const fetchRows = async () => {
    try {
      setLoading(true);
      const all = await fetchJSONSafe<DesignationRead[]>(API.designationsList);

const mapping = await resolveScopeUserMapping(user);
if (mapping) setCurrentUserMapping(mapping);

const activeCompanyID =
  resolveScopedCompanyId({
    ...user,
    companyID: mapping?.companyID ?? user?.companyID,
  }) ??
  mapping?.companyID ??
  user?.companyID;

const filteredRows = (all || []).filter((r: any) => {
  if (!activeCompanyID) return true;
  return Number(r.companyID) === Number(activeCompanyID);
});

setRows(filteredRows);

    } catch (e: any) {
      console.error("Failed to load designations:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
  fetchRows();
  fetchFilterLists();
}
  }, [user]);

 useEffect(() => {
  const handler = () => {
    if (user) {
      fetchRows();
      fetchFilterLists();
    }
  };

  const sidebarPageClickHandler = (e: any) => {
    if (e.detail?.path === "/designations") {
      closeDesignationPagePanels();

      if (user) {
        fetchRows();
        fetchFilterLists();
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

  // Close suggestion popovers on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (spRef.current && !spRef.current.contains(e.target as any)) setSpList([]);
      if (coRef.current && !coRef.current.contains(e.target as any)) setSuggestedCompanies([]);
      if (brRef.current && !brRef.current.contains(e.target as any)) setSuggestedBranches([]);
      if (deptRef.current && !deptRef.current.contains(e.target as any)) setSuggestedDepartments([]);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // ---------------------------
  // Form helpers
  // ---------------------------
  const resetForm = () => {
    const ctx = getSidebarContext();
    skipCascadeRef.current = true;

    let serviceProviderID: ID | null = null;
    let companyID: ID | null = null;
    let branchesID: ID | null = null;
    let spAutocomplete = "";
    let coAutocomplete = "";
    let brAutocomplete = "";

    if (isCompanyModuleOperator(user) || user?.role === "EMPLOYEE") {
      serviceProviderID =
        (currentUserMapping?.serviceProviderID as ID | null) ??
        (resolveScopedServiceProviderId(user) as ID | null) ??
        (user?.serviceProviderID as ID | null) ??
        null;
      companyID =
        (currentUserMapping?.companyID as ID | null) ??
        (resolveScopedCompanyId(user) as ID | null) ??
        (user?.companyID as ID | null) ??
        null;
      spAutocomplete =
        currentUserMapping?.serviceProvider?.companyName ||
        (ctx && Number(ctx.companyID) === Number(companyID)
          ? ctx.serviceProviderName
          : "") ||
        "";
      coAutocomplete =
        currentUserMapping?.company?.companyName ||
        (ctx && Number(ctx.companyID) === Number(companyID)
          ? ctx.companyName
          : "") ||
        "";
    } else if (ctx) {
      serviceProviderID = ctx.serviceProviderID ?? null;
      companyID = ctx.companyID ?? null;
      spAutocomplete = ctx.serviceProviderName ?? "";
      coAutocomplete = ctx.companyName ?? "";
    } else if (
      (user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN") &&
      currentUserMapping
    ) {
      serviceProviderID = currentUserMapping.serviceProviderID ?? null;
      companyID = currentUserMapping.companyID ?? null;
      spAutocomplete = currentUserMapping.serviceProvider?.companyName ?? "";
      coAutocomplete = currentUserMapping.company?.companyName ?? "";
    } else if (user?.role === "BRANCH_ADMIN" && currentUserMapping) {
      serviceProviderID = currentUserMapping.serviceProviderID ?? null;
      companyID = currentUserMapping.companyID ?? null;
      branchesID = currentUserMapping.branchesID ?? null;
      spAutocomplete = currentUserMapping.serviceProvider?.companyName ?? "";
      coAutocomplete = currentUserMapping.company?.companyName ?? "";
      brAutocomplete = currentUserMapping.branches?.branchName ?? "";
    }

    setFormData({
      serviceProviderID,
      companyID,
      branchesID,
      departmentID: null,
      designation: "",
      otApplicable: "",
      noticePeriodDaysForResignation: "",
      noticePeriodDaysForTermination: "",
      spAutocomplete,
      coAutocomplete,
      brAutocomplete,
      deptAutocomplete: "",
    });
    setEditing(null);
    setSuggestedCompanies([]);
    setSuggestedBranches([]);
    setSuggestedDepartments([]);
    setError(null);
    setTimeout(() => { skipCascadeRef.current = false; }, 0);
  };

  const handleEdit = (r: DesignationRead) => {
    skipCascadeRef.current = true;
    setEditing(r);
    setIsAddingNew(true);
    setIsViewing(false);
    
    // Set form data with existing values
    const newFormData = {
      serviceProviderID: r.serviceProviderID ?? r.serviceProvider?.id ?? null,
      companyID: r.companyID ?? r.company?.id ?? null,
      branchesID: r.branchesID ?? r.branches?.id ?? null,
      departmentID: r.departmentID ?? null,

      designation: r.designation ?? "",
      otApplicable: (r as any).otApplicable ?? "",
      noticePeriodDaysForResignation: r.noticePeriodDaysForResignation ?? "",
      noticePeriodDaysForTermination: r.noticePeriodDaysForTermination ?? "",

      spAutocomplete: r.serviceProvider?.companyName
        ?? r.serviceProviderName
        ?? (r.serviceProviderID != null ? spMap[r.serviceProviderID] ?? "" : ""),

      coAutocomplete: r.company?.companyName
        ?? r.companyName
        ?? (r.companyID != null ? coMap[r.companyID] ?? "" : ""),

      brAutocomplete: r.branches?.branchName
        ?? r.branchName
        ?? (r.branchesID != null ? brMap[r.branchesID] ?? "" : ""),

      deptAutocomplete: r.departments?.departmentName
        ?? r.departmentName
        ?? (r.departmentID != null ? deptMap[r.departmentID] ?? "" : ""),
    };
    
    setFormData(newFormData);
    setTimeout(() => { skipCascadeRef.current = false; }, 0);
  };

  const handleView = (r: DesignationRead) => {
    setViewRow(r);
    setIsViewing(true);
    setIsAddingNew(false);
  };

  const handleDelete = async (id: ID) => {
    if (!confirm("Delete this designation?")) return;
    try {
      const res = await fetch(`${API.designations}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await fetchRows();
      toast.success("Designation deleted successfully");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  // ---------------------------
  // Submit (Create/Update)
  // ---------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const validationErrors: string[] = [];
    if (!formData.designation?.trim()) validationErrors.push("Designation is required");
    if (!formData.branchesID) validationErrors.push("Please select a Branch");
    if (!formData.departmentID) validationErrors.push("Please select a Department");
    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg));
      return;
    }

    setSaving(true);
    setError(null);

    const payload: any = {
      serviceProviderID:
        formData.serviceProviderID ??
        resolveScopedServiceProviderId(user) ??
        currentUserMapping?.serviceProviderID ??
        user?.serviceProviderID ??
        undefined,

      companyID:
        formData.companyID ??
        resolveScopedCompanyId(user) ??
        currentUserMapping?.companyID ??
        user?.companyID ??
        undefined,

      branchesID: formData.branchesID,
      departmentID: formData.departmentID,
      designation: formData.designation,
      otApplicable: formData.otApplicable || null,
      noticePeriodDaysForResignation: formData.noticePeriodDaysForResignation || null,
      noticePeriodDaysForTermination: formData.noticePeriodDaysForTermination || null,
    };

    try {
      if (editing) {
        const res = await fetch(`${API.designations}/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch(API.designations, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      }

      await fetchRows();
      resetForm();
      setIsAddingNew(false);
      setEditing(null);
      toast.success("Designation saved successfully");
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

 const closeDesignationPagePanels = () => {
    resetForm();

    setIsAddingNew(false);
    setIsViewing(false);
    setEditing(null);
    setViewRow(null);

    setSpList([]);
};

const handleCancel = () => {
    closeDesignationPagePanels();
};

  // Filter SP list based on search
  const [spList, setSpList] = useState<ServiceProvider[]>([]);
  const [spLoading, setSpLoading] = useState(false);

  const fetchServiceProviders = (query: string) => {
    if (spTimerRef.current) clearTimeout(spTimerRef.current);
    spTimerRef.current = setTimeout(async () => {
      if (query.length < MIN_CHARS) {
        setSpList([]);
        return;
      }
      setSpLoading(true);
      try {
        const all = await fetchJSONSafe<ServiceProvider[]>(API.serviceProviders);
        const filtered = (all || []).filter(sp =>
          (sp.companyName ?? "").toLowerCase().includes(query.toLowerCase())
        );
        setSpList(filtered.slice(0, 20));
      } catch (error) {
        console.error("Failed to fetch service providers:", error);
      } finally {
        setSpLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  // Company suggestions based on typing
  const fetchCompanySuggestions = (query: string) => {
    if (companyTimerRef.current) clearTimeout(companyTimerRef.current);
    companyTimerRef.current = setTimeout(() => {
      if (query.length < MIN_CHARS || !formData.serviceProviderID) {
        setSuggestedCompanies([]);
        return;
      }

      setLoadingCompanies(true);
      
      // Filter from master list based on SP and query
      const filtered = allCompanies.filter(company => 
        company.serviceProviderID === formData.serviceProviderID &&
        company.companyName.toLowerCase().includes(query.toLowerCase())
      );
      
      setSuggestedCompanies(filtered.slice(0, 20));
      setLoadingCompanies(false);
    }, DEBOUNCE_MS);
  };

  // Branch suggestions based on typing
  const fetchBranchSuggestions = (query: string) => {
    if (branchTimerRef.current) clearTimeout(branchTimerRef.current);
    branchTimerRef.current = setTimeout(() => {
      const companyID =
        formData.companyID ??
        resolveScopedCompanyId(user) ??
        user?.companyID ??
        null;
      if (query.length < MIN_CHARS || !companyID) {
        setSuggestedBranches([]);
        return;
      }

      setLoadingBranches(true);

      const filtered = allBranches.filter(
        (branch) =>
          Number(branch.companyID) === Number(companyID) &&
          (user?.role !== "BRANCH_ADMIN" ||
            Number(branch.id) === Number(user?.branchesID)) &&
          (branch.branchName ?? "")
            .toLowerCase()
            .includes(query.toLowerCase()),
      );

      setSuggestedBranches(filtered.slice(0, 20));
      setLoadingBranches(false);
    }, DEBOUNCE_MS);
  };

  // Department suggestions based on typing
  const fetchDepartmentSuggestions = (query: string) => {
    if (deptTimerRef.current) clearTimeout(deptTimerRef.current);
    deptTimerRef.current = setTimeout(() => {
      const companyID =
        formData.companyID ??
        resolveScopedCompanyId(user) ??
        user?.companyID ??
        null;
      if (query.length < MIN_CHARS || !companyID || !formData.branchesID) {
        setSuggestedDepartments([]);
        return;
      }

      setLoadingDepartments(true);

      const filtered = allDepartments.filter(
        (dept) =>
          Number(dept.companyID) === Number(companyID) &&
          Number(dept.branchesID) === Number(formData.branchesID) &&
          (dept.departmentName ?? "")
            .toLowerCase()
            .includes(query.toLowerCase()),
      );

      setSuggestedDepartments(filtered.slice(0, 20));
      setLoadingDepartments(false);
    }, DEBOUNCE_MS);
  };

  // ---------------------------
  // Search / filters
  // ---------------------------

const filtered = useMemo(() => {
  const t = table.search.trim().toLowerCase();

  const spNameOf = (r: DesignationRead) =>
    r.serviceProvider?.companyName ??
    r.serviceProviderName ??
    (r.serviceProviderID != null ? spMap[r.serviceProviderID] : "");

  const coNameOf = (r: DesignationRead) =>
    r.company?.companyName ??
    r.companyName ??
    (r.companyID != null ? coMap[r.companyID] : "");

  const brNameOf = (r: DesignationRead) =>
    r.branches?.branchName ??
    r.branchName ??
    (r.branchesID != null ? brMap[r.branchesID] : "");

  const deptNameOf = (r: DesignationRead) =>
    r.departments?.departmentName ??
    r.departmentName ??
    (r.departmentID != null ? deptMap[r.departmentID] : "");

  let list = rows.filter((r) => {
    const matchesBranch =
      branchFilter === "ALL" ||
      branchFilter === String(r.branchesID ?? r.branches?.id ?? "");

    const matchesDepartment =
      departmentFilter === "ALL" ||
      departmentFilter === String(r.departmentID ?? r.departments?.id ?? "");

    const matchesSearch =
      !t ||
      [
        r.designation,
        spNameOf(r),
        coNameOf(r),
        brNameOf(r),
        deptNameOf(r),
      ]
        .filter(Boolean)
        .map((x) => String(x ?? "").toLowerCase())
        .some((f) => f.includes(t));

    return matchesBranch && matchesDepartment && matchesSearch;
  });

  return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
    const r = row as DesignationRead;
    if (key === "designation") return r.designation ?? "";
    if (key === "branch") return brNameOf(r);
    if (key === "department") return deptNameOf(r);
    return "";
  });
}, [
  rows,
  table.search,
  table.sortBy,
  table.sortDir,
  branchFilter,
  departmentFilter,
  spMap,
  coMap,
  brMap,
  deptMap,
]);

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

  const visibleDepartmentFilterList = useMemo(
    () =>
      departmentFilterList.filter((d) =>
        branchFilter === "ALL" || String(d.branchesID) === branchFilter,
      ),
    [departmentFilterList, branchFilter],
  );

  const departmentFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All departments" },
      ...visibleDepartmentFilterList.map((d) => ({
        value: String(d.id),
        label: d.departmentName || `Dept #${d.id}`,
      })),
    ],
    [visibleDepartmentFilterList],
  );

  const designationColumns = useMemo((): DataTableColumn<DesignationRead>[] => [
    {
      key: "designation",
      header: "Name",
      sortable: true,
      colSpan: 4,
      cell: (r) => <span className="font-medium">{r.designation || "—"}</span>,
    },
    {
      key: "branch",
      header: "Branch",
      sortable: true,
      colSpan: 3,
      cell: (r) => brName(r),
    },
    {
      key: "department",
      header: "Department",
      sortable: true,
      colSpan: 3,
      cell: (r) => deptName(r),
    },
    {
      key: "actions",
      header: "Actions",
      colSpan: 2,
      align: "right",
      cell: (r) => (
        <EntityRowActions
          onView={() => handleView(r)}
          onEdit={canManage ? () => handleEdit(r) : undefined}
          onDelete={canManage ? () => handleDelete(r.id) : undefined}
        />
      ),
    },
  ], [canManage]);

  // ---------------------------
  // Name helpers for table
  // ---------------------------
  const spName = (r: DesignationRead) =>
    r.serviceProvider?.companyName
    ?? r.serviceProviderName
    ?? (r.serviceProviderID != null ? (spMap[r.serviceProviderID] ?? "—") : "—");

  const coName = (r: DesignationRead) =>
    r.company?.companyName
    ?? r.companyName
    ?? (r.companyID != null ? (coMap[r.companyID] ?? "—") : "—");

  const brName = (r: DesignationRead) =>
    r.branches?.branchName
    ?? r.branchName
    ?? (r.branchesID != null ? (brMap[r.branchesID] ?? "—") : "—");

  const deptName = (r: DesignationRead) =>
    r.departments?.departmentName
    ?? r.departmentName
    ?? (r.departmentID != null ? (deptMap[r.departmentID] ?? "—") : "—");

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={BadgeCheck}
        title="Designations"
        description="Job titles for your organisation. Level helps build org-charts and feeds future pay-band logic."
        actions={
          !isAddingNew && !isViewing && canManage ? (
            <Button onClick={() => { resetForm(); setIsAddingNew(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Add Designation
            </Button>
          ) : null
        }
      />

      {/* Add/Edit Form - Drawer */}
      <FormDrawer
        open={isAddingNew}
        onOpenChange={(v) => { if (!v) handleCancel(); }}
        title={editing ? "Edit Designation" : "Add New Designation"}
      >
        <div>
            {error && (
              <NoticeBanner variant="error" compact className="mb-4">
                {error}
              </NoticeBanner>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Service Provider - auto-filled from sidebar */}
              {false && (
                <div ref={spRef} className="space-y-2 relative">
                  <Label>Service Provider *</Label>
                  <Input
                    value={formData.spAutocomplete}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((p) => ({ ...p, spAutocomplete: val, serviceProviderID: null }));
                      fetchServiceProviders(val);
                    }}
                    placeholder="Start typing service provider..."
                    autoComplete="off"
                    required
                  />
                  {spList.length > 0 && (
                    <div className="absolute z-10 bg-popover text-popover-foreground border border-border rounded w-full shadow max-h-48 overflow-y-auto">
                      {spLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                      {spList.map((sp) => (
                        <div
                          key={sp.id}
                          className="px-3 py-2 hover:bg-accent cursor-pointer"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setFormData((p) => ({
                              ...p,
                              serviceProviderID: sp.id,
                              spAutocomplete: sp.companyName,
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

              {/* Company - auto-filled from sidebar */}
              {false && (
                <div ref={coRef} className="space-y-2 relative">
                  <Label>Company *</Label>
                  <Input
                    value={formData.coAutocomplete}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((p) => ({ ...p, coAutocomplete: val, companyID: null }));
                      if (!editing) {
                        fetchCompanySuggestions(val);
                      }
                    }}
                    onFocus={() => {
                      if (!editing && formData.serviceProviderID && formData.coAutocomplete.length >= MIN_CHARS) {
                        fetchCompanySuggestions(formData.coAutocomplete);
                      }
                    }}
                    placeholder={formData.serviceProviderID ? "Type to search company..." : "Select service provider first"}
                    autoComplete="off"
                    required
                    disabled={!formData.serviceProviderID}
                  />
                  {suggestedCompanies.length > 0 && !editing && (
                    <div className="absolute z-10 bg-popover text-popover-foreground border border-border rounded w-full shadow max-h-48 overflow-y-auto">
                      {loadingCompanies && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                      {suggestedCompanies.map((co) => (
                        <div
                          key={co.id}
                          className="px-3 py-2 hover:bg-accent cursor-pointer"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setFormData((p) => ({
                              ...p,
                              companyID: co.id,
                              coAutocomplete: co.companyName,
                            }));
                            setSuggestedCompanies([]);
                          }}
                        >
                          {co.companyName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Branch Autocomplete */}
              {showOrgFields && (
                <div ref={brRef} className="space-y-2 relative">
                  <Label>Branch *</Label>
                  <Input
                    value={formData.brAutocomplete}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((p) => ({ ...p, brAutocomplete: val, branchesID: null }));
                      if (!editing) {
                        fetchBranchSuggestions(val);
                      }
                    }}
                    onFocus={() => {
                      if (!editing && (formData.companyID || resolveScopedCompanyId(user)) && formData.brAutocomplete.length >= MIN_CHARS) {
                        fetchBranchSuggestions(formData.brAutocomplete);
                      }
                    }}
                    placeholder={
                      !(formData.companyID || resolveScopedCompanyId(user) || user?.companyID)
                        ? "Company not resolved for this account"
                        : editing ? formData.brAutocomplete || "Branch" :
                      "Type to search branch..."
                    }
                    autoComplete="off"
                    required
                    disabled={!(formData.companyID || resolveScopedCompanyId(user) || user?.companyID)}
                  />
                  {suggestedBranches.length > 0 && !editing && (
                    <div className="absolute z-10 bg-popover text-popover-foreground border border-border rounded w-full shadow max-h-48 overflow-y-auto">
                      {loadingBranches && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                      {suggestedBranches.map((br) => (
                        <div
                          key={br.id}
                          className="px-3 py-2 hover:bg-accent cursor-pointer"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setFormData((p) => ({
                              ...p,
                              branchesID: br.id,
                              brAutocomplete: br.branchName,
                              companyID: p.companyID ?? br.companyID ?? null,
                              serviceProviderID:
                                p.serviceProviderID ?? br.serviceProviderID ?? null,
                            }));
                            setSuggestedBranches([]);
                          }}
                        >
                          {br.branchName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Department Autocomplete */}
              {showOrgFields && (
                <div ref={deptRef} className="space-y-2 relative">
                  <Label>Department *</Label>
                  <Input
                    value={formData.deptAutocomplete}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((p) => ({ ...p, deptAutocomplete: val, departmentID: null }));
                      if (!editing) {
                        fetchDepartmentSuggestions(val);
                      }
                    }}
                    onFocus={() => {
                      if (!editing && formData.branchesID && formData.deptAutocomplete.length >= MIN_CHARS) {
                        fetchDepartmentSuggestions(formData.deptAutocomplete);
                      }
                    }}
                    placeholder={
                      !(formData.companyID || resolveScopedCompanyId(user) || user?.companyID)
                        ? "Company not resolved for this account"
                        : !formData.branchesID ? "Select branch first" :
                      editing ? formData.deptAutocomplete || "Department" :
                      "Type to search department..."
                    }
                    autoComplete="off"
                    required
                    disabled={
                      !(formData.companyID || resolveScopedCompanyId(user) || user?.companyID) ||
                      !formData.branchesID
                    }
                  />
                  {suggestedDepartments.length > 0 && !editing && (
                    <div className="absolute z-10 bg-popover text-popover-foreground border border-border rounded w-full shadow max-h-48 overflow-y-auto">
                      {loadingDepartments && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                      {suggestedDepartments.map((dept) => (
                        <div
                          key={dept.id}
                          className="px-3 py-2 hover:bg-accent cursor-pointer"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setFormData((p) => ({
                              ...p,
                              departmentID: dept.id,
                              deptAutocomplete: dept.departmentName,
                            }));
                            setSuggestedDepartments([]);
                          }}
                        >
                          {dept.departmentName}
                        </div>
                      ))}
                    </div>
                  )}
                 
                </div>
              )}

              {/* Designation Name */}
              <div className="space-y-2">
                <Label>Designation *</Label>
                <Input
                  value={formData.designation}
                  onChange={(e) => setFormData((p) => ({ ...p, designation: e.target.value }))}
                  required
                  placeholder="Enter designation name"
                />
              </div>

              {/* New Fields Section - hidden for ADMIN and COMPANY_ADMIN */}
              {!(user?.role === "ADMIN" || user?.role === "COMPANY_ADMIN") && <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="text-lg font-medium mb-4">Additional Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* OT Applicable */}
                  <div className="space-y-2">
                    <Label>OT Applicable?</Label>
                    <Select
                      value={formData.otApplicable}
                      onValueChange={(value) => setFormData((p) => ({ ...p, otApplicable: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Yes/No" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Notice Period Days for Resignation */}
                  <div className="space-y-2">
                    <Label>Notice Period Days (Resignation)</Label>
                    <Input
                      type="number"
                      value={formData.noticePeriodDaysForResignation}
                      onChange={(e) => setFormData((p) => ({ ...p, noticePeriodDaysForResignation: e.target.value }))}
                      placeholder="Enter days"
                      min="0"
                    />
                  </div>

                  {/* Notice Period Days for Termination */}
                  <div className="space-y-2">
                    <Label>Notice Period Days (Termination)</Label>
                    <Input
                      type="number"
                      value={formData.noticePeriodDaysForTermination}
                      onChange={(e) => setFormData((p) => ({ ...p, noticePeriodDaysForTermination: e.target.value }))}
                      placeholder="Enter days"
                      min="0"
                    />
                  </div>
                </div>
              </div>}

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="submit" className="" disabled={saving}>
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? "Saving..." : editing ? "Update Designation" : "Add Designation"}
                </Button>
              </div>
            </form>
        </div>
      </FormDrawer>

      {/* View Details - Drawer */}
      <FormDrawer
        open={!!(isViewing && viewRow)}
        onOpenChange={(v) => { if (!v) handleCancel(); }}
        title="Designation Details"
        showHeaderCancel
        cancelLabel="Close"
      >
        {viewRow && (
          <EntityDetailLayout
            hero={
              <EntityDetailHero
                title={viewRow.designation || "Designation"}
                subtitle={<span>{deptName(viewRow)} · {brName(viewRow)}</span>}
              />
            }
          >
            <DetailCard
              title="Organisation"
              subtitle="Where this designation applies"
              rows={[
                { label: "Designation", value: viewRow.designation },
                { label: "Service Provider", value: spName(viewRow) },
                { label: "Company", value: coName(viewRow) },
                { label: "Branch", value: brName(viewRow) },
                { label: "Department", value: deptName(viewRow) },
              ]}
            />
            <DetailCard
              title="Policies"
              subtitle="Notice period and overtime settings"
              rows={[
                { label: "OT Applicable", value: (viewRow as any).otApplicable },
                { label: "Notice Period (Resignation)", value: viewRow.noticePeriodDaysForResignation },
                { label: "Notice Period (Termination)", value: viewRow.noticePeriodDaysForTermination },
              ]}
            />
          </EntityDetailLayout>
        )}
      </FormDrawer>

      {!isAddingNew && !isViewing && (<>
        <FilterBar
          search={{
            value: table.search,
            onChange: table.setSearch,
            placeholder: "Search code, name or grade…",
          }}
          filters={
            <>
              <FilterSelect
                id="designations-branch"
                value={branchFilter}
                onChange={(v) => { setBranchFilter(v); setDepartmentFilter("ALL"); }}
                options={branchFilterOptions}
                width="w-56"
                ariaLabel="Filter by branch"
              />
              <FilterSelect
                id="designations-department"
                value={departmentFilter}
                onChange={setDepartmentFilter}
                options={departmentFilterOptions}
                width="w-56"
                ariaLabel="Filter by department"
              />
            </>
          }
        />

        <EntityListShell
          title="All designations"
          columns={designationColumns}
          rows={filtered}
          rowKey={(r) => String(r.id)}
          isLoading={loading}
          sortBy={table.sortBy}
          sortDir={table.sortDir}
          onSort={table.setSort}
          emptyIcon={BadgeCheck}
          emptyTitle="No designations yet"
          emptyDescription="Define the job titles in use across your company."
          emptyAction={
            canManage ? (
              <Button onClick={() => { resetForm(); setIsAddingNew(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Designation
              </Button>
            ) : undefined
          }
        />
      </>)}
    </div>
  );
}
