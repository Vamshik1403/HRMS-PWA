"use client";
import { TableBodySkeleton } from "../components/ui/TableBodySkeleton";

import { hasModuleWriteAccess } from "@/lib/companyAccess";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
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
import { Plus, Edit, Trash2, Eye, X, Save, Filter, RotateCcw, Users, Building } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { FormDrawer } from "../components/ui/form-drawer";
import { NoticeBanner } from "../components/ui/notice-banner";
import { toast } from "sonner";
import { PageHeader } from "../components/app/page-header";
import { FilterBar, FilterSelect } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import type { DataTableColumn } from "../components/app/data-table";
import { EntityRowActions } from "../components/app/entity-row-actions";
import { DetailCard } from "../components/app/detail-card";
import { EntityDetailHero, EntityDetailLayout } from "../components/app/entity-detail-layout";
import { useClientTable, sortRows } from "../hooks/use-client-table";
import { getSidebarContext } from "../utils/sidebarContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  canDesktopManagerManage,
  filterBranchesForUser,
  isCompanyModuleOperator,
  resolveScopedCompanyId,
  resolveScopedServiceProviderId,
  resolveScopeUserMapping,
} from "../utils/scopeContext";

// ---------------------------
// Types aligned to backend
// ---------------------------
type ID = number;

interface DepartmentRead {
  id: ID;
  serviceProviderID?: ID | null;
  companyID?: ID | null;
  branchesID?: ID | null;
  parentDepartmentID?: ID | null;
  departmentName?: string | null;
  createdAt?: string | null;

  // optional nested if API includes them
  serviceProvider?: { id: ID; companyName?: string | null } | null;
  company?: { id: ID; companyName?: string | null } | null;
  branches?: { id: ID; branchName?: string | null } | null;
  parentDepartment?: { id: ID; departmentName?: string | null } | null;
  departmentBranches?: { branchesID: number; branches?: { id: number; branchName?: string | null } | null }[];

  // optional denormalized names some APIs add
  serviceProviderName?: string | null;
  companyName?: string | null;
  branchName?: string | null;
}

interface ServiceProvider { id: ID; companyName: string; }
interface Company { id: ID; companyName: string; }
interface Branch {
  id: ID;
  branchName: string;
  companyID?: ID | null;
  serviceProviderID?: ID | null;
}

// ---------------------------
// Config & helpers
// ---------------------------
const API = {
  departments: "/backend/departments",
  serviceProviders: "/backend/service-provider",
  companies: "/backend/company",
  branches: "/backend/branches",

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
export function DepartmentManagement() {
  // Data
  const [rows, setRows] = useState<DepartmentRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN" || user?.role === "BRANCH_ADMIN" || hasModuleWriteAccess("DEPARTMENTS");
  const isEmployee = user?.role === "EMPLOYEE";
  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);

  // UI
const table = useClientTable("departmentName");
const [branchFilter, setBranchFilter] = useState("ALL");

const [branchFilterList, setBranchFilterList] = useState<Branch[]>([]);
const [branchFilterLoading, setBranchFilterLoading] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [editing, setEditing] = useState<DepartmentRead | null>(null);
  const [viewRow, setViewRow] = useState<DepartmentRead | null>(null);

  // Suggestions refs/state
  const spRef = useRef<HTMLDivElement>(null);
  const coRef = useRef<HTMLDivElement>(null);
  const brRef = useRef<HTMLDivElement>(null);

  const [spList, setSpList] = useState<ServiceProvider[]>([]);
  const [coList, setCoList] = useState<Company[]>([]);
  const [brList, setBrList] = useState<Branch[]>([]);
  const [spLoading, setSpLoading] = useState(false);
  const [coLoading, setCoLoading] = useState(false);
  const [brLoading, setBrLoading] = useState(false);

  const spAbortRef = useRef<AbortController | null>(null);
  const coAbortRef = useRef<AbortController | null>(null);
  const brAbortRef = useRef<AbortController | null>(null);

  const spTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // lookup maps (fallback names if API doesn't include relations)
  const [spMap, setSpMap] = useState<Record<number, string>>({});
  const [coMap, setCoMap] = useState<Record<number, string>>({});
  const [brMap, setBrMap] = useState<Record<number, string>>({});

  // Form state
  const [formData, setFormData] = useState({
    serviceProviderID: null as ID | null,
    companyID: null as ID | null,
    branchesID: null as ID | null,
    parentDepartmentID: null as ID | null,
    branchIDs: [] as number[],

    departmentName: "",

    spAutocomplete: "",
    coAutocomplete: "",
    brAutocomplete: "",
    parentAutocomplete: "",
  });

  // ---------------------------
  // Load data + lookups
  // ---------------------------
  const fetchRows = async () => {
    try {
      setLoading(true);
      const all = await fetchJSONSafe<DepartmentRead[]>(API.departments);

      const mapping = await resolveScopeUserMapping(user);
      if (mapping) setCurrentUserMapping(mapping);

      const activeCompanyID =
        resolveScopedCompanyId({ ...user, companyID: mapping?.companyID ?? user?.companyID }) ??
        mapping?.companyID ??
        user?.companyID;

      const filteredRows = (all || []).filter((r: any) => {
        if (!activeCompanyID) return true;
        return Number(r.companyID) === Number(activeCompanyID);
      });

      setRows(filteredRows);
    } catch (e: any) {
      console.error("Failed to load departments:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  async function fetchLookups() {
    const [sps, cos, brs] = await Promise.all([
      fetchJSONSafe<ServiceProvider[]>(API.serviceProviders),
      fetchJSONSafe<Company[]>(API.companies),
      fetchJSONSafe<Branch[]>(API.branches),
    ]);
    setSpMap(Object.fromEntries((sps || []).map(s => [s.id, s.companyName ?? ""])));
    setCoMap(Object.fromEntries((cos || []).map(c => [c.id, c.companyName ?? ""])));
    setBrMap(Object.fromEntries((brs || []).map(b => [b.id, b.branchName ?? ""])));
  }

    const fetchBranchFilterList = async () => {
    try {
      setBranchFilterLoading(true);

      const all = await fetchJSONSafe<Branch[]>(API.branches);
      const mapping = await resolveScopeUserMapping(user);
      let branches = await filterBranchesForUser(Array.isArray(all) ? all : [], {
        ...user,
        companyID: mapping?.companyID ?? user?.companyID,
        serviceProviderID: mapping?.serviceProviderID ?? user?.serviceProviderID,
        branchesID: mapping?.branchesID ?? user?.branchesID,
      });

      if (user?.role === "BRANCH_ADMIN") {
        const branchesID = mapping?.branchesID ?? user?.branchesID;
        if (branchesID) {
          branches = branches.filter(
            (b: any) => Number(b.id) === Number(branchesID)
          );
          setBranchFilter(String(branchesID));
        }
      }

      setBranchFilterList(branches);
    } catch (e) {
      console.error("Failed to load branch filter list:", e);
      setBranchFilterList([]);
    } finally {
      setBranchFilterLoading(false);
    }
  };

useEffect(() => {
  fetchRows();
  fetchLookups();
  fetchBranchFilterList();

const reload = () => {
  setBranchFilter(user?.role === "BRANCH_ADMIN" ? String(user?.branchesID ?? "ALL") : "ALL");
  setBrList([]);
  setFormData((p) => ({
    ...p,
    branchesID: null,
    brAutocomplete: "",
  }));
  fetchRows();
  fetchBranchFilterList();
};

  window.addEventListener("sidebar-context-changed", reload);
  window.addEventListener("app-data-refresh", reload);

  return () => {
    window.removeEventListener("sidebar-context-changed", reload);
    window.removeEventListener("app-data-refresh", reload);
  };
}, []);

 useEffect(() => {
  const handler = () => {
    if (user) {
      fetchRows();
      fetchBranchFilterList();
    }
  };

  const sidebarPageClickHandler = (e: any) => {
    if (e.detail?.path === "/departments") {
      closeDepartmentPagePanels();

      if (user) {
        fetchRows();
        fetchBranchFilterList();
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

  // ---------------------------
  // Debounced suggestions
  // ---------------------------
  const runFetchServiceProviders = (query: string) => {
    if (spTimerRef.current) clearTimeout(spTimerRef.current);
    spTimerRef.current = setTimeout(async () => {
      if (query.length < MIN_CHARS) {
        setSpList([]);
        return;
      }
      if (spAbortRef.current) spAbortRef.current.abort();
      const ctrl = new AbortController();
      spAbortRef.current = ctrl;
      setSpLoading(true);
      try {
        const all = await fetchJSONSafe<ServiceProvider[]>(API.serviceProviders, ctrl.signal);
        const filtered = (all || []).filter(sp =>
          (sp.companyName ?? "").toLowerCase().includes(query.toLowerCase())
        );
        setSpList(filtered.slice(0, 20));
      } catch (e) {
        if ((e as any).name !== "AbortError") console.error("SP fetch error:", e);
      } finally {
        setSpLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  const runFetchCompanies = (query: string) => {
    if (coTimerRef.current) clearTimeout(coTimerRef.current);
    coTimerRef.current = setTimeout(async () => {
      if (query.length < MIN_CHARS) {
        setCoList([]);
        return;
      }
      if (coAbortRef.current) coAbortRef.current.abort();
      const ctrl = new AbortController();
      coAbortRef.current = ctrl;
      setCoLoading(true);
      try {
        const all = await fetchJSONSafe<Company[]>(API.companies, ctrl.signal);
        const filtered = (all || []).filter(c =>
          (c.companyName ?? "").toLowerCase().includes(query.toLowerCase())
        );
        setCoList(filtered.slice(0, 20));
      } catch (e) {
        if ((e as any).name !== "AbortError") console.error("Company fetch error:", e);
      } finally {
        setCoLoading(false);
      }
    }, DEBOUNCE_MS);
  };

 const runFetchBranches = (query: string) => {
  if (brTimerRef.current) clearTimeout(brTimerRef.current);

  brTimerRef.current = setTimeout(async () => {
    if (query.length < MIN_CHARS) {
      setBrList([]);
      return;
    }

    if (brAbortRef.current) brAbortRef.current.abort();

    const ctrl = new AbortController();
    brAbortRef.current = ctrl;
    setBrLoading(true);

    try {
      const all = await fetchJSONSafe<Branch[]>(API.branches, ctrl.signal);
      let filtered = await filterBranchesForUser(Array.isArray(all) ? all : [], user);

      // Prefer form company, then operator credentials — not stale sidebar alone.
      const activeCompanyID =
        formData.companyID ??
        currentUserMapping?.companyID ??
        resolveScopedCompanyId(user) ??
        user?.companyID ??
        null;

      if (activeCompanyID) {
        filtered = filtered.filter(
          (b: any) => Number(b.companyID) === Number(activeCompanyID)
        );
      }

      filtered = filtered.filter((b) =>
        (b.branchName ?? "").toLowerCase().includes(query.toLowerCase())
      );

      setBrList(filtered.slice(0, 20).filter((b, _i, arr) => {
        const id = Number(b.id);
        return Number.isFinite(id) && arr.findIndex((x) => Number(x.id) === id) === _i;
      }));
    } catch (e) {
      if ((e as any).name !== "AbortError") {
        console.error("Branches fetch error:", e);
      }
    } finally {
      setBrLoading(false);
    }
  }, DEBOUNCE_MS);
};

  // Close suggestion popovers on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (spRef.current && !spRef.current.contains(e.target as any)) setSpList([]);
      if (coRef.current && !coRef.current.contains(e.target as any)) setCoList([]);
      if (brRef.current && !brRef.current.contains(e.target as any)) setBrList([]);
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
      spAbortRef.current?.abort();
      coAbortRef.current?.abort();
      brAbortRef.current?.abort();
    };
  }, []);

  // ---------------------------
  // Form helpers
  // ---------------------------
  const resetForm = () => {
    const baseFormData = {
      serviceProviderID: null as ID | null,
      companyID: null as ID | null,
      branchesID: null as ID | null,
      parentDepartmentID: null as ID | null,
      branchIDs: [] as number[],
      departmentName: "",
      spAutocomplete: "",
      coAutocomplete: "",
      brAutocomplete: "",
      parentAutocomplete: "",
    };

    const ctx = getSidebarContext();
    const scopedCompanyID = resolveScopedCompanyId(user);
    const scopedSpID = resolveScopedServiceProviderId(user);

    if (isCompanyModuleOperator(user) || user?.role === "EMPLOYEE") {
      baseFormData.serviceProviderID =
        (currentUserMapping?.serviceProviderID as ID | null) ??
        (scopedSpID as ID | null) ??
        (user?.serviceProviderID as ID | null) ??
        null;
      baseFormData.companyID =
        (currentUserMapping?.companyID as ID | null) ??
        (scopedCompanyID as ID | null) ??
        (user?.companyID as ID | null) ??
        null;
      baseFormData.spAutocomplete =
        currentUserMapping?.serviceProvider?.companyName ||
        (ctx && Number(ctx.companyID) === Number(baseFormData.companyID)
          ? ctx.serviceProviderName
          : "") ||
        "";
      baseFormData.coAutocomplete =
        currentUserMapping?.company?.companyName ||
        (ctx && Number(ctx.companyID) === Number(baseFormData.companyID)
          ? ctx.companyName
          : "") ||
        "";
    } else if (ctx) {
      baseFormData.serviceProviderID = ctx.serviceProviderID;
      baseFormData.companyID = ctx.companyID;
      baseFormData.spAutocomplete = ctx.serviceProviderName;
      baseFormData.coAutocomplete = ctx.companyName;
    } else if (currentUserMapping) {
      baseFormData.serviceProviderID = currentUserMapping.serviceProviderID;
      baseFormData.companyID = currentUserMapping.companyID;
      baseFormData.spAutocomplete =
        currentUserMapping.serviceProvider?.companyName || "";
      baseFormData.coAutocomplete =
        currentUserMapping.company?.companyName || "";

      if (user?.role === "BRANCH_ADMIN") {
        baseFormData.branchesID = currentUserMapping.branchesID;
        baseFormData.brAutocomplete =
          currentUserMapping.branches?.branchName || "";
        if (currentUserMapping.branchesID != null) {
          baseFormData.branchIDs = [Number(currentUserMapping.branchesID)];
        }
      }
    }

    setFormData(baseFormData);
    setEditing(null);
    setSpList([]);
    setCoList([]);
    setBrList([]);
    setError(null);
  };

  const handleEdit = (r: DepartmentRead) => {
    setEditing(r);
    setIsAddingNew(true);
    setIsViewing(false);

    // For MANAGER, use their mapped IDs instead of the department's IDs
    let finalServiceProviderID = r.serviceProviderID ?? r.serviceProvider?.id ?? null;
    let finalCompanyID = r.companyID ?? r.company?.id ?? null;
    let spName = "";
    let coName = "";

 const ctx = getSidebarContext();

if (ctx) {
  finalServiceProviderID = ctx.serviceProviderID;
  finalCompanyID = ctx.companyID;
  spName = ctx.serviceProviderName || "";
  coName = ctx.companyName || "";
} else if ((user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN") && currentUserMapping) {
  finalServiceProviderID = currentUserMapping.serviceProviderID;
  finalCompanyID = currentUserMapping.companyID;
  spName = currentUserMapping.serviceProvider?.companyName ?? "";
  coName = currentUserMapping.company?.companyName ?? "";
} else {
      // For SUPERADMIN, use the department's original data
      spName = r.serviceProvider?.companyName 
        ?? r.serviceProviderName 
        ?? (r.serviceProviderID != null ? spMap[r.serviceProviderID] ?? "" : "");
      coName = r.company?.companyName 
        ?? r.companyName 
        ?? (r.companyID != null ? coMap[r.companyID] ?? "" : "");
    }

    const branchIDs =
      r.departmentBranches && r.departmentBranches.length > 0
        ? r.departmentBranches.map((b) => Number(b.branchesID)).filter((id) => !Number.isNaN(id))
        : r.branchesID != null
          ? [Number(r.branchesID)]
          : [];

    const brNames = branchIDs
      .map((id) => {
        const fromRel = r.departmentBranches?.find((b) => Number(b.branchesID) === id)?.branches?.branchName;
        return fromRel ?? brMap[id] ?? (r.branchesID === id ? (r.branches?.branchName ?? r.branchName ?? "") : "");
      })
      .filter(Boolean);

    setFormData({
      serviceProviderID: finalServiceProviderID,
      companyID: finalCompanyID,
      branchesID: branchIDs[0] ?? r.branchesID ?? r.branches?.id ?? null,
      parentDepartmentID: r.parentDepartmentID ?? r.parentDepartment?.id ?? null,
      branchIDs,
      departmentName: r.departmentName ?? "",
      spAutocomplete: spName,
      coAutocomplete: coName,
      brAutocomplete: brNames.join(", ")
        || r.branches?.branchName
        || r.branchName
        || (r.branchesID != null ? brMap[r.branchesID] ?? "" : ""),
      parentAutocomplete: r.parentDepartment?.departmentName ?? "",
    });
  };

  const handleView = (r: DepartmentRead) => {
    setViewRow(r);
    setIsViewing(true);
    setIsAddingNew(false);
  };

  const handleDelete = async (id: ID) => {
    try {
      const res = await fetch(`${API.departments}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await fetchRows();
      toast.success("Department deleted successfully");
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
    if (!formData.departmentName?.trim()) validationErrors.push("Department Name is required");
    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg));
      return;
    }

    setSaving(true);
    setError(null);

    const ctx = getSidebarContext();

    let finalServiceProviderID =
      formData.serviceProviderID ??
      resolveScopedServiceProviderId(user) ??
      currentUserMapping?.serviceProviderID ??
      user?.serviceProviderID ??
      ctx?.serviceProviderID ??
      null;

    let finalCompanyID =
      formData.companyID ??
      resolveScopedCompanyId(user) ??
      currentUserMapping?.companyID ??
      user?.companyID ??
      ctx?.companyID ??
      null;

    if (!finalCompanyID) {
      toast.error("Company is not selected");
      setSaving(false);
      return;
    }

    const payload: any = {
      serviceProviderID: finalServiceProviderID ?? undefined,
      companyID: finalCompanyID ?? undefined,
      departmentName: formData.departmentName || undefined,
      parentDepartmentID: formData.parentDepartmentID || null,
      branchIDs: formData.branchIDs,
      branchesID: formData.branchIDs[0] ?? formData.branchesID ?? undefined,
    };

    try {
      if (editing) {
        const res = await fetch(`${API.departments}/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch(API.departments, {
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
      toast.success("Department saved successfully");
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const closeDepartmentPagePanels = () => {
  resetForm();
  setIsAddingNew(false);
  setIsViewing(false);
  setEditing(null);
  setViewRow(null);
  setSpList([]);
  setCoList([]);
  setBrList([]);
};

const handleCancel = () => {
  closeDepartmentPagePanels();
};

  // ---------------------------
  // Search / filters
  // ---------------------------

    const filtered = useMemo(() => {
    const t = table.search.trim().toLowerCase();

    const spNameOf = (r: DepartmentRead) =>
      r.serviceProvider?.companyName ??
      r.serviceProviderName ??
      (r.serviceProviderID != null ? spMap[r.serviceProviderID] : "");

    const coNameOf = (r: DepartmentRead) =>
      r.company?.companyName ??
      r.companyName ??
      (r.companyID != null ? coMap[r.companyID] : "");

    const brNameOf = (r: DepartmentRead) =>
      r.branches?.branchName ??
      r.branchName ??
      (r.branchesID != null ? brMap[r.branchesID] : "");

    let list = rows.filter((r) => {
      const departmentBranchID = String(r.branchesID ?? r.branches?.id ?? "");

      const matchesBranch =
        branchFilter === "ALL" || branchFilter === departmentBranchID;

      const matchesSearch =
        !t ||
        [
          r.departmentName,
          spNameOf(r),
          coNameOf(r),
          brNameOf(r),
        ]
          .filter(Boolean)
          .map((x) => String(x ?? "").toLowerCase())
          .some((f) => f.includes(t));

      return matchesBranch && matchesSearch;
    });

    return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
      const r = row as DepartmentRead;
      if (key === "departmentName") return r.departmentName ?? "";
      if (key === "branch") {
        return (
          r.branches?.branchName ??
          r.branchName ??
          (r.branchesID != null ? brMap[r.branchesID] : "") ??
          ""
        );
      }
      return "";
    });
  }, [rows, table.search, table.sortBy, table.sortDir, branchFilter, spMap, coMap, brMap]);

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

  // ---------------------------
  // Name helpers for table
  // ---------------------------
  const spName = (r: DepartmentRead) =>
    r.serviceProvider?.companyName
    ?? r.serviceProviderName
    ?? (r.serviceProviderID != null ? (spMap[r.serviceProviderID] ?? "—") : "—");

  const coName = (r: DepartmentRead) =>
    r.company?.companyName
    ?? r.companyName
    ?? (r.companyID != null ? (coMap[r.companyID] ?? "—") : "—");

  const brName = (r: DepartmentRead) =>
    r.branches?.branchName
    ?? r.branchName
    ?? (r.branchesID != null ? (brMap[r.branchesID] ?? "—") : "—");

  const parentDeptName = (r: DepartmentRead) =>
    r.parentDepartment?.departmentName
    ?? (r.parentDepartmentID != null
      ? (rows.find((d) => d.id === r.parentDepartmentID)?.departmentName ?? "—")
      : "—");

  const branchesDisplay = (r: DepartmentRead) => {
    const multi = (r.departmentBranches || [])
      .map((b) => b.branches?.branchName || brMap[b.branchesID] || null)
      .filter(Boolean) as string[];
    if (multi.length > 0) return multi.join(", ");
    return brName(r);
  };

  const parentDepartmentOptions = useMemo(() => {
    const companyID =
      formData.companyID ??
      resolveScopedCompanyId(user) ??
      currentUserMapping?.companyID ??
      user?.companyID ??
      null;
    return rows.filter((d) => {
      if (editing && d.id === editing.id) return false;
      if (companyID != null && Number(d.companyID) !== Number(companyID)) return false;
      return true;
    });
  }, [rows, formData.companyID, editing, user, currentUserMapping]);

  const toggleBranchID = (id: number) => {
    setFormData((p) => {
      const exists = p.branchIDs.includes(id);
      const branchIDs = exists ? p.branchIDs.filter((x) => x !== id) : [...p.branchIDs, id];
      const names = branchIDs
        .map((bid) => branchFilterList.find((b) => b.id === bid)?.branchName || brMap[bid] || String(bid))
        .filter(Boolean);
      return {
        ...p,
        branchIDs,
        branchesID: branchIDs[0] ?? null,
        brAutocomplete: names.join(", "),
      };
    });
  };

  const departmentColumns = useMemo((): DataTableColumn<DepartmentRead>[] => [
    {
      key: "departmentName",
      header: "Name",
      sortable: true,
      colSpan: 5,
      cell: (r) => <span className="font-medium">{r.departmentName || "—"}</span>,
    },
    {
      key: "branch",
      header: "Branch",
      sortable: true,
      colSpan: 4,
      cell: (r) => branchesDisplay(r),
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
        />
      ),
    },
  ], [canManage, brMap, rows]);

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={Building}
        title="Departments"
        description="Functional teams across the organisation. Can be branch-scoped or company-wide."
        actions={
          !isAddingNew && !isViewing && canManage ? (
            <Button onClick={() => { resetForm(); setIsAddingNew(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Add Department
            </Button>
          ) : null
        }
      />

      {/* Add/Edit Form - Drawer */}
      <FormDrawer
        open={isAddingNew}
        onOpenChange={(v) => { if (!v) handleCancel(); }}
        title={editing ? "Edit Department" : "Add New Department"}
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
                      runFetchServiceProviders(val);
                    }}
                    onFocus={() => {
                      if (!formData.serviceProviderID && formData.spAutocomplete.length >= MIN_CHARS) {
                        runFetchServiceProviders(formData.spAutocomplete);
                      }
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
                      runFetchCompanies(val);
                    }}
                    onFocus={() => {
                      if (!formData.companyID && formData.coAutocomplete.length >= MIN_CHARS) {
                        runFetchCompanies(formData.coAutocomplete);
                      }
                    }}
                    placeholder="Start typing company..."
                    autoComplete="off"
                    required
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
                              coAutocomplete: co.companyName,
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

              {/* Department Name */}
              <div className="space-y-2">
                <Label>Department Name *</Label>
                <Input
                  value={formData.departmentName}
                  onChange={(e) => setFormData((p) => ({ ...p, departmentName: e.target.value }))}
                  required
                />
              </div>

              {/* Branches multi-select */}
              <div className="space-y-2">
                <Label>Branches (optional — multi-select)</Label>
                {branchFilterLoading ? (
                  <div className="text-sm text-gray-500">Loading branches…</div>
                ) : branchFilterList.length === 0 ? (
                  <div className="text-sm text-gray-500">No branches available for this company.</div>
                ) : (
                  <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                    {branchFilterList.map((b) => {
                      const checked = formData.branchIDs.includes(b.id);
                      return (
                        <label
                          key={b.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm"
                        >
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={checked}
                            onChange={() => toggleBranchID(b.id)}
                          />
                          <span>{b.branchName || `Branch #${b.id}`}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {formData.branchIDs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {formData.branchIDs.map((id) => {
                      const name =
                        branchFilterList.find((b) => b.id === id)?.branchName ||
                        brMap[id] ||
                        `Branch #${id}`;
                      return (
                        <Badge key={id} variant="secondary" className="gap-1 pr-1">
                          {name}
                          <button
                            type="button"
                            className="ml-1 rounded hover:bg-black/10 p-0.5"
                            onClick={() => toggleBranchID(id)}
                            aria-label={`Remove ${name}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Parent Department */}
              <div className="space-y-2">
                <Label>Parent Department</Label>
                <Select
                  value={formData.parentDepartmentID != null ? String(formData.parentDepartmentID) : "none"}
                  onValueChange={(value) => {
                    if (value === "none") {
                      setFormData((p) => ({
                        ...p,
                        parentDepartmentID: null,
                        parentAutocomplete: "",
                      }));
                      return;
                    }
                    const id = Number(value);
                    const match = parentDepartmentOptions.find((d) => d.id === id);
                    setFormData((p) => ({
                      ...p,
                      parentDepartmentID: id,
                      parentAutocomplete: match?.departmentName ?? "",
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No Parent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Parent</SelectItem>
                    {parentDepartmentOptions.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.departmentName || `Department #${d.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="submit" className="" disabled={saving}>
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? "Saving..." : editing ? "Update Department" : "Add Department"}
                </Button>
              </div>
            </form>
        </div>
      </FormDrawer>

      {/* View Details - Drawer */}
      <FormDrawer
        open={!!(isViewing && viewRow)}
        onOpenChange={(v) => { if (!v) handleCancel(); }}
        title="Department Details"
        showHeaderCancel
        cancelLabel="Close"
      >
        {viewRow && (
          <EntityDetailLayout
            hero={
              <EntityDetailHero
                title={viewRow.departmentName || "Department"}
                subtitle={<span>{coName(viewRow)} · {branchesDisplay(viewRow)}</span>}
              />
            }
            columns={1}
          >
            <DetailCard
              title="Overview"
              subtitle="Department organisation mapping"
              rows={[
                { label: "Department", value: viewRow.departmentName },
                { label: "Company", value: coName(viewRow) },
                { label: "Parent Department", value: parentDeptName(viewRow) },
                { label: "Branches", value: branchesDisplay(viewRow) },
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
            placeholder: "Search code or name…",
          }}
          filters={
            <FilterSelect
              id="departments-branch"
              value={branchFilter}
              onChange={setBranchFilter}
              options={branchFilterOptions}
              width="w-56"
              ariaLabel="Filter by branch"
            />
          }
        />

        <EntityListShell
          title="All departments"
          columns={departmentColumns}
          rows={filtered}
          rowKey={(r) => String(r.id)}
          isLoading={loading}
          sortBy={table.sortBy}
          sortDir={table.sortDir}
          onSort={table.setSort}
          emptyIcon={Users}
          emptyTitle="No departments yet"
          emptyDescription="Create your first department to group people functionally."
          emptyAction={
            canManage ? (
              <Button onClick={() => { resetForm(); setIsAddingNew(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Department
              </Button>
            ) : undefined
          }
        />
      </>)}
    </div>
  );
}