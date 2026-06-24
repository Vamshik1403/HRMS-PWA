"use client";
import { TableBodySkeleton } from "../components/ui/TableBodySkeleton";

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
import { Plus, Search, Edit, Trash2, Eye, X, Save, RotateCcw, Filter } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { FormDrawer } from "../components/ui/form-drawer";
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";
import {
  canDesktopManagerManage,
  filterCompanyScopedRecords,
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

  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN" || user?.role === "BRANCH_ADMIN";
  const isEmployee = user?.role === "EMPLOYEE";

  // UI
const [searchTerm, setSearchTerm] = useState("");

const [branchFilterList, setBranchFilterList] = useState<Branch[]>([]);
const [departmentFilterList, setDepartmentFilterList] = useState<Department[]>([]);
const [selectedFilterBranchIds, setSelectedFilterBranchIds] = useState<string[]>([]);
const [selectedFilterDepartmentIds, setSelectedFilterDepartmentIds] = useState<string[]>([]);
const [showFilterModal, setShowFilterModal] = useState(false);
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

    const ctx = getSidebarContext();

    const activeCompanyID =
      ctx?.companyID ??
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

        setSelectedFilterBranchIds([String(branchID)]);
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
      setRows(await filterCompanyScopedRecords(all, user));

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
    window.addEventListener("sidebar-context-changed", handler);
    window.addEventListener("app-data-refresh", handler);
    return () => {
      window.removeEventListener("sidebar-context-changed", handler);
      window.removeEventListener("app-data-refresh", handler);
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

    let serviceProviderID: ID | null = ctx?.serviceProviderID ?? null;
    let companyID: ID | null = ctx?.companyID ?? null;
    let branchesID: ID | null = null;
    let spAutocomplete = ctx?.serviceProviderName ?? "";
    let coAutocomplete = ctx?.companyName ?? "";
    let brAutocomplete = "";

    if ((user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN") && currentUserMapping) {
      serviceProviderID = currentUserMapping.serviceProviderID ?? null;
      companyID = currentUserMapping.companyID ?? null;
      branchesID = null;
      spAutocomplete = currentUserMapping.serviceProvider?.companyName ?? "";
      coAutocomplete = currentUserMapping.company?.companyName ?? "";
      brAutocomplete = "";
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
        user?.role === "SUPERADMIN"
          ? formData.serviceProviderID
          : currentUserMapping?.serviceProviderID,

      companyID:
        user?.role === "SUPERADMIN"
          ? formData.companyID
          : currentUserMapping?.companyID,

      branchesID: formData.branchesID,
      departmentID: formData.departmentID,
      designation: formData.designation,
      
      // Updated fields
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

  const handleCancel = () => {
    resetForm();
    setIsAddingNew(false);
    setIsViewing(false);
    setViewRow(null);
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
      if (query.length < MIN_CHARS || !formData.serviceProviderID || !formData.companyID) {
        setSuggestedBranches([]);
        return;
      }

      setLoadingBranches(true);
      
      // Filter from master list based on SP, Company and query
      const filtered = allBranches.filter(branch => 
        branch.serviceProviderID === formData.serviceProviderID &&
        branch.companyID === formData.companyID &&
        (user?.role !== "BRANCH_ADMIN" || Number(branch.id) === Number(user?.branchesID)) &&
        branch.branchName.toLowerCase().includes(query.toLowerCase())
      );
      
      setSuggestedBranches(filtered.slice(0, 20));
      setLoadingBranches(false);
    }, DEBOUNCE_MS);
  };

  // Department suggestions based on typing
  const fetchDepartmentSuggestions = (query: string) => {
    if (deptTimerRef.current) clearTimeout(deptTimerRef.current);
    deptTimerRef.current = setTimeout(() => {
      if (query.length < MIN_CHARS || !formData.serviceProviderID || !formData.companyID || !formData.branchesID) {
        setSuggestedDepartments([]);
        return;
      }

      setLoadingDepartments(true);
      
      // Filter from master list based on SP, Company, Branch and query
      const filtered = allDepartments.filter(dept => 
        dept.serviceProviderID === formData.serviceProviderID &&
        dept.companyID === formData.companyID &&
        dept.branchesID === formData.branchesID &&
        dept.departmentName.toLowerCase().includes(query.toLowerCase())
      );
      
      console.log("Filtered departments:", filtered); // Debug log
      setSuggestedDepartments(filtered.slice(0, 20));
      setLoadingDepartments(false);
    }, DEBOUNCE_MS);
  };

  // ---------------------------
  // Search
  // ---------------------------

  const toggleFilterBranch = (branchId: string) => {
  setSelectedFilterBranchIds((prev) => {
    const next = prev.includes(branchId)
      ? prev.filter((id) => id !== branchId)
      : [...prev, branchId];

    // remove selected departments that do not belong to selected branch list
    if (next.length > 0) {
      setSelectedFilterDepartmentIds((deptPrev) =>
        deptPrev.filter((deptId) => {
          const dept = departmentFilterList.find(
            (d) => String(d.id) === String(deptId)
          );
          return dept && next.includes(String(dept.branchesID));
        })
      );
    }

    return next;
  });
};

const toggleFilterDepartment = (departmentId: string) => {
  setSelectedFilterDepartmentIds((prev) =>
    prev.includes(departmentId)
      ? prev.filter((id) => id !== departmentId)
      : [...prev, departmentId]
  );
};

const selectAllFilterBranches = () => {
  setSelectedFilterBranchIds(branchFilterList.map((b) => String(b.id)));
};

const selectAllFilterDepartments = () => {
  const allowedDepartments = departmentFilterList.filter((d) => {
    return (
      selectedFilterBranchIds.length === 0 ||
      selectedFilterBranchIds.includes(String(d.branchesID))
    );
  });

  setSelectedFilterDepartmentIds(allowedDepartments.map((d) => String(d.id)));
};

const clearAllFilters = () => {
  if (user?.role === "BRANCH_ADMIN") {
    const branchID = currentUserMapping?.branchesID ?? user?.branchesID;
    setSelectedFilterBranchIds(branchID ? [String(branchID)] : []);
    setSelectedFilterDepartmentIds([]);
    return;
  }

  setSelectedFilterBranchIds([]);
  setSelectedFilterDepartmentIds([]);
};

const visibleDepartmentFilterList = departmentFilterList.filter((d) => {
  return (
    selectedFilterBranchIds.length === 0 ||
    selectedFilterBranchIds.includes(String(d.branchesID))
  );
});


const filtered = useMemo(() => {
  const t = searchTerm.trim().toLowerCase();

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

  return rows.filter((r) => {
    const matchesBranch =
      selectedFilterBranchIds.length === 0 ||
      selectedFilterBranchIds.includes(String(r.branchesID ?? r.branches?.id ?? ""));

    const matchesDepartment =
      selectedFilterDepartmentIds.length === 0 ||
      selectedFilterDepartmentIds.includes(String(r.departmentID ?? r.departments?.id ?? ""));

    const matchesSearch =
      !t ||
      [
        r.designation,
        spNameOf(r),
        coNameOf(r),
        brNameOf(r),
        deptNameOf(r),
        r.shiftEligibility,
        r.nightShiftEligibility,
        r.maxHoursPerDay,
        r.weeklyOffPattern,
        r.noticePeriodDaysForResignation,
        r.noticePeriodDaysForTermination,
      ]
        .filter(Boolean)
        .map((x) => String(x ?? "").toLowerCase())
        .some((f) => f.includes(t));

    return matchesBranch && matchesDepartment && matchesSearch;
  });
}, [
  rows,
  searchTerm,
  spMap,
  coMap,
  brMap,
  deptMap,
  selectedFilterBranchIds,
  selectedFilterDepartmentIds,
]);

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
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage designation records</p>
        </div>

        <div className="flex items-center gap-3">
          {!isAddingNew && !isViewing && canManage && (
            <Button
              onClick={() => { resetForm(); setIsAddingNew(true); }}
              className="text-sm px-3 py-2"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Designation
            </Button>
          )}
        </div>
      </div>

      {/* Add/Edit Form - Drawer */}
      <FormDrawer
        open={isAddingNew}
        onOpenChange={(v) => { if (!v) handleCancel(); }}
        title={editing ? "Edit Designation" : "Add New Designation"}
      >
        <div>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm mb-4">
                {error}
              </div>
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
                    <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                      {loadingCompanies && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                      {suggestedCompanies.map((co) => (
                        <div
                          key={co.id}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
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
              {user?.role !== "EMPLOYEE" && (
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
                      if (!editing && formData.companyID && formData.brAutocomplete.length >= MIN_CHARS) {
                        fetchBranchSuggestions(formData.brAutocomplete);
                      }
                    }}
                    placeholder={
                      !formData.serviceProviderID ? "Select service provider first" :
                      !formData.companyID ? "Select company first" :
                      editing ? formData.brAutocomplete || "Branch" :
                      "Type to search branch..."
                    }
                    autoComplete="off"
                    required
                    disabled={!formData.serviceProviderID || !formData.companyID}
                  />
                  {suggestedBranches.length > 0 && !editing && (
                    <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                      {loadingBranches && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                      {suggestedBranches.map((br) => (
                        <div
                          key={br.id}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setFormData((p) => ({
                              ...p,
                              branchesID: br.id,
                              brAutocomplete: br.branchName,
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
              {user?.role !== "EMPLOYEE" && (
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
                      !formData.serviceProviderID ? "Select service provider first" :
                      !formData.companyID ? "Select company first" :
                      !formData.branchesID ? "Select branch first" :
                      editing ? formData.deptAutocomplete || "Department" :
                      "Type to search department..."
                    }
                    autoComplete="off"
                    required
                    disabled={!formData.serviceProviderID || !formData.companyID || !formData.branchesID}
                  />
                  {suggestedDepartments.length > 0 && !editing && (
                    <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                      {loadingDepartments && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                      {suggestedDepartments.map((dept) => (
                        <div
                          key={dept.id}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
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
      >
        {viewRow && (
        <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg"><strong>Designation:</strong> {viewRow.designation || "—"}</div>
              <div className="p-3 bg-gray-50 rounded-lg"><strong>Service Provider:</strong> {spName(viewRow)}</div>
              <div className="p-3 bg-gray-50 rounded-lg"><strong>Company:</strong> {coName(viewRow)}</div>
              <div className="p-3 bg-gray-50 rounded-lg"><strong>Branch:</strong> {brName(viewRow)}</div>
              <div className="p-3 bg-gray-50 rounded-lg"><strong>Department:</strong> {deptName(viewRow)}</div>
              <div className="p-3 bg-gray-50 rounded-lg"><strong>OT Applicable:</strong> {(viewRow as any).otApplicable || "—"}</div>
              <div className="p-3 bg-gray-50 rounded-lg"><strong>Notice Period (Resignation):</strong> {viewRow.noticePeriodDaysForResignation || "—"}</div>
              <div className="p-3 bg-gray-50 rounded-lg"><strong>Notice Period (Termination):</strong> {viewRow.noticePeriodDaysForTermination || "—"}</div>
            </div>
        </div>
        )}
      </FormDrawer>

      {!isAddingNew && !isViewing && (<>
         <Card>
  <CardContent className="p-6">
    <div className="flex items-center gap-3 w-full">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowFilterModal(true)}
        className="flex-shrink-0"
        title="Filter by Branch / Department"
      >
        <Filter className="w-4 h-4 mr-1" />
        Filter
        {(selectedFilterBranchIds.length + selectedFilterDepartmentIds.length) > 0 && (
          <Badge variant="secondary" className="ml-2">
            {selectedFilterBranchIds.length + selectedFilterDepartmentIds.length}
          </Badge>
        )}
      </Button>

      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search designations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full"
        />
      </div>

      <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
        {filtered.length} designations
      </Badge>
    </div>
  </CardContent>
</Card>

{showFilterModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl border">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Filter className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Filter Designations
            </h3>
            <p className="text-xs text-gray-500">
              Select branch and department filters
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowFilterModal(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">
            {selectedFilterBranchIds.length} branches, {selectedFilterDepartmentIds.length} departments selected
          </Badge>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearAllFilters}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Clear
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Branches</Label>

            {user?.role !== "BRANCH_ADMIN" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAllFilterBranches}
                disabled={filterLoading || branchFilterList.length === 0}
              >
                Select All Branches
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {branchFilterList.length === 0 ? (
              <p className="text-sm text-gray-500 col-span-full py-4 text-center">
                {filterLoading ? "Loading branches..." : "No branches found"}
              </p>
            ) : (
              branchFilterList.map((b) => (
                <label
                  key={b.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedFilterBranchIds.includes(String(b.id))}
                    disabled={user?.role === "BRANCH_ADMIN"}
                    onChange={() => toggleFilterBranch(String(b.id))}
                  />
                  <span className="truncate">{b.branchName}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Departments</Label>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectAllFilterDepartments}
              disabled={filterLoading || visibleDepartmentFilterList.length === 0}
            >
              Select All Departments
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visibleDepartmentFilterList.length === 0 ? (
              <p className="text-sm text-gray-500 col-span-full py-4 text-center">
                {filterLoading ? "Loading departments..." : "No departments found"}
              </p>
            ) : (
              visibleDepartmentFilterList.map((d) => (
                <label
                  key={d.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedFilterDepartmentIds.includes(String(d.id))}
                    onChange={() => toggleFilterDepartment(String(d.id))}
                  />
                  <span className="truncate">{d.departmentName}</span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t px-5 py-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowFilterModal(false)}
        >
          Cancel
        </Button>

        <Button
          type="button"
          onClick={() => setShowFilterModal(false)}
        >
          Apply Filter
        </Button>
      </div>
    </div>
  </div>
)}
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon icon="mdi:id-card" className="w-5 h-5" /> Designation List
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Designation</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Department</TableHead>
                        
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableBodySkeleton cols={4} />
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                            <div className="flex flex-col items-center gap-2">
                              <Icon icon="mdi:account-search" className="w-12 h-12 text-gray-300" />
                              <p>No designations found</p>
                              <p className="text-sm">Try adjusting your search criteria</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="whitespace-nowrap">{r.designation || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap">{brName(r)}</TableCell>
                            <TableCell className="whitespace-nowrap">{deptName(r)}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleView(r)}
                                  className="h-7 w-7 p-0"
                                  title="View"
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>

                                {canManage && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(r)}
                                    className="h-7 w-7 p-0"
                                    title="Edit"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                )}

                                {canManage && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(r.id)}
                                    className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
            </CardContent>
          </Card>
      </>)}
    </div>
  );
}