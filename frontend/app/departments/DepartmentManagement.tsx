"use client";
import { TableBodySkeleton } from "../components/ui/TableBodySkeleton";

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
  canDesktopManagerManage,
  filterCompanyScopedRecords,
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
  departmentName?: string | null;
  createdAt?: string | null;

  // optional nested if API includes them
  serviceProvider?: { id: ID; companyName?: string | null } | null;
  company?: { id: ID; companyName?: string | null } | null;
  branches?: { id: ID; branchName?: string | null } | null;

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
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN" || user?.role === "BRANCH_ADMIN";
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

    departmentName: "",

    spAutocomplete: "",
    coAutocomplete: "",
    brAutocomplete: "",
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

const ctx = getSidebarContext();

const activeCompanyID =
  ctx?.companyID ??
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
      const ctx = getSidebarContext();

const mapping = await resolveScopeUserMapping(user);

const activeCompanyID =
  ctx?.companyID ??
  mapping?.companyID ??
  user?.companyID ??
  null;
  
      let branches = Array.isArray(all) ? all : [];

      if (activeCompanyID) {
        branches = branches.filter(
          (b: any) => Number(b.companyID) === Number(activeCompanyID)
        );
      }

      if (user?.role === "BRANCH_ADMIN") {
        const branchesID = currentUserMapping?.branchesID ?? user?.branchesID;
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
      const ctx = getSidebarContext();

      const activeCompanyID =
        ctx?.companyID ??
        formData.companyID ??
        currentUserMapping?.companyID ??
        user?.companyID ??
        null;

      let filtered = Array.isArray(all) ? all : [];

      if (activeCompanyID) {
        filtered = filtered.filter(
          (b: any) => Number(b.companyID) === Number(activeCompanyID)
        );
      }

      if (user?.role === "BRANCH_ADMIN") {
        const branchesID = currentUserMapping?.branchesID ?? user?.branchesID;

        if (branchesID) {
          filtered = filtered.filter(
            (b: any) => Number(b.id) === Number(branchesID)
          );
        }
      }

      filtered = filtered.filter((b) =>
        (b.branchName ?? "").toLowerCase().includes(query.toLowerCase())
      );

      setBrList(filtered.slice(0, 20));
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
      departmentName: "",
      spAutocomplete: "",
      coAutocomplete: "",
      brAutocomplete: "",
    };

    // Auto-set Service Provider and Company for MANAGER
   const ctx = getSidebarContext();

// Sidebar selected company always gets first priority
if (ctx) {
  baseFormData.serviceProviderID = ctx.serviceProviderID;
  baseFormData.companyID = ctx.companyID;
  baseFormData.spAutocomplete = ctx.serviceProviderName;
  baseFormData.coAutocomplete = ctx.companyName;
} else if (currentUserMapping) {
  baseFormData.serviceProviderID = currentUserMapping.serviceProviderID;
  baseFormData.companyID = currentUserMapping.companyID;
  baseFormData.spAutocomplete = currentUserMapping.serviceProvider?.companyName || "";
  baseFormData.coAutocomplete = currentUserMapping.company?.companyName || "";

  if (user?.role === "BRANCH_ADMIN") {
    baseFormData.branchesID = currentUserMapping.branchesID;
    baseFormData.brAutocomplete = currentUserMapping.branches?.branchName || "";
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

    setFormData({
      serviceProviderID: finalServiceProviderID,
      companyID: finalCompanyID,
      branchesID: r.branchesID ?? r.branches?.id ?? null,
      departmentName: r.departmentName ?? "",
      spAutocomplete: spName,
      coAutocomplete: coName,
      brAutocomplete: r.branches?.branchName 
        ?? r.branchName 
        ?? (r.branchesID != null ? brMap[r.branchesID] ?? "" : ""),
    });
  };

  const handleView = (r: DepartmentRead) => {
    setViewRow(r);
    setIsViewing(true);
    setIsAddingNew(false);
  };

  const handleDelete = async (id: ID) => {
    if (!confirm("Delete this department?")) return;
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

    // For MANAGER, ensure serviceProviderID and companyID are set from user mapping
  const ctx = getSidebarContext();

let finalServiceProviderID =
  ctx?.serviceProviderID ??
  formData.serviceProviderID;

let finalCompanyID =
  ctx?.companyID ??
  formData.companyID;

if (
  (user?.role === "SERVICE_PROVIDER" ||
    user?.role === "COMPANY_ADMIN" ||
    user?.role === "ADMIN") &&
  !ctx &&
  currentUserMapping
) {
  finalServiceProviderID = currentUserMapping.serviceProviderID;
  finalCompanyID = currentUserMapping.companyID;
}

    const payload: any = {
      serviceProviderID: finalServiceProviderID ?? undefined,
      companyID: finalCompanyID ?? undefined,
      branchesID: formData.branchesID ?? undefined,
      departmentName: formData.departmentName || undefined,
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
      cell: (r) => brName(r),
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
  ], [canManage]);

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

              {/* Branch Autocomplete */}
              <div ref={brRef} className="space-y-2 relative">
                <Label>Branch *</Label>
                <Input
                  value={formData.brAutocomplete}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((p) => ({ ...p, brAutocomplete: val, branchesID: null }));
                    runFetchBranches(val);
                  }}
                  onFocus={() => {
                    if (!formData.branchesID && formData.brAutocomplete.length >= MIN_CHARS) {
                      runFetchBranches(formData.brAutocomplete);
                    }
                  }}
                  placeholder="Start typing branch..."
                  autoComplete="off"
                  required
                />
                {brList.length > 0 && (
                  <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                    {brLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                    {brList.map((br) => (
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
                          setBrList([]);
                        }}
                      >
                        {br.branchName}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Department Name */}
              <div className="space-y-2">
                <Label>Department Name *</Label>
                <Input
                  value={formData.departmentName}
                  onChange={(e) => setFormData((p) => ({ ...p, departmentName: e.target.value }))}
                  required
                />
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
                subtitle={<span>{coName(viewRow)} · {brName(viewRow)}</span>}
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
                { label: "Branch", value: brName(viewRow) },
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