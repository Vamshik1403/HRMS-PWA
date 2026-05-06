"use client";

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
import { Plus, Search, Edit, Trash2, Eye, X, Save } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { FormDrawer } from "../components/ui/form-drawer";
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";

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
interface Branch { id: ID; branchName: string; }

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
  const [searchTerm, setSearchTerm] = useState("");
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

      // 🟢 SUPERADMIN → filter by sidebar context
      if (user?.role === "SUPERADMIN") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          setRows(all.filter((r: any) => r.companyID === ctx.companyID));
        } else {
          setRows(all);
        }
        return;
      }

      // 🟡 MANAGER & EMPLOYEE → Get user mapping first
      const usersRes = await fetch("/backend/users");
      const users = await usersRes.json();
      const currentUser = users.find((u: any) => u.username === user?.username);

      if (currentUser) {
        // Store the user mapping for form auto-fill
        setCurrentUserMapping(currentUser);

        if (user?.role === "SERVICE_PROVIDER") {
          const ctx = getSidebarContext();
          if (ctx?.companyID) {
            setRows(all.filter((r: any) => r.companyID === ctx.companyID));
          } else if (currentUser.serviceProviderID) {
            setRows(all.filter((r: any) => r.serviceProviderID === currentUser.serviceProviderID));
          } else {
            setRows([]);
          }
        } else if (user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN") {
          const filtered = all.filter(
            (r: any) => r.companyID === currentUser.companyID
          );
          setRows(filtered);
        } else if (user?.role === "BRANCH_ADMIN") {
          const filtered = all.filter(
            (r: any) =>
              r.companyID === currentUser.companyID &&
              r.branchesID === currentUser.branchesID
          );
          setRows(filtered);
        } else if (user?.role === "EMPLOYEE") {
          // For EMPLOYEE, filter by both companyID and branchesID
          const filtered = all.filter(
            (r: any) =>
              r.companyID === currentUser.companyID &&
              r.branchesID === currentUser.branchesID
          );
          setRows(filtered);
        }
      } else {
        console.warn("User not found in /users mapping.");
        setRows([]);
      }
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

  useEffect(() => {
    if (user) {
      fetchRows();
      fetchLookups();
    }
  }, [user]);

  useEffect(() => {
    const handler = () => { if (user) fetchRows(); };
    window.addEventListener("sidebar-context-changed", handler);
    return () => window.removeEventListener("sidebar-context-changed", handler);
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

        // 🟡 Filter by companyID
        let filtered = all || [];
        if ((user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN") && currentUserMapping?.companyID) {
          filtered = filtered.filter(
            (b: any) => b.companyID === currentUserMapping.companyID
          );        } else if (user?.role === "BRANCH_ADMIN") {
          const companyID = currentUserMapping?.companyID ?? user?.companyID;
          if (companyID) filtered = filtered.filter((b: any) => b.companyID === companyID);
          const branchesID = currentUserMapping?.branchesID ?? user?.branchesID;
          if (branchesID) filtered = filtered.filter((b: any) => Number(b.id) === Number(branchesID));        } else if (formData.companyID) {
          filtered = filtered.filter(
            (b: any) => b.companyID === formData.companyID
          );
        }

        // 🟢 Then apply search filtering
        filtered = filtered.filter((b) =>
          (b.branchName ?? "").toLowerCase().includes(query.toLowerCase())
        );

        setBrList(filtered.slice(0, 20));
      } catch (e) {
        if ((e as any).name !== "AbortError")
          console.error("Branches fetch error:", e);
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
    if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
      baseFormData.serviceProviderID = currentUserMapping.serviceProviderID;
      baseFormData.companyID = currentUserMapping.companyID;
      baseFormData.spAutocomplete = currentUserMapping.serviceProvider?.companyName || "";
      baseFormData.coAutocomplete = currentUserMapping.company?.companyName || "";
    } else if ((user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN") && currentUserMapping) {
      baseFormData.serviceProviderID = currentUserMapping.serviceProviderID;
      baseFormData.companyID = currentUserMapping.companyID;
      baseFormData.spAutocomplete = currentUserMapping.serviceProvider?.companyName || "";
      baseFormData.coAutocomplete = currentUserMapping.company?.companyName || "";
    } else if (user?.role === "BRANCH_ADMIN" && currentUserMapping) {
      baseFormData.serviceProviderID = currentUserMapping.serviceProviderID;
      baseFormData.companyID = currentUserMapping.companyID;
      baseFormData.branchesID = currentUserMapping.branchesID;
      baseFormData.spAutocomplete = currentUserMapping.serviceProvider?.companyName || "";
      baseFormData.coAutocomplete = currentUserMapping.company?.companyName || "";
      baseFormData.brAutocomplete = currentUserMapping.branches?.branchName || "";
    } else if (user?.role === "SUPERADMIN") {
      const ctx = getSidebarContext();
      if (ctx) {
        baseFormData.serviceProviderID = ctx.serviceProviderID;
        baseFormData.companyID = ctx.companyID;
        baseFormData.spAutocomplete = ctx.serviceProviderName;
        baseFormData.coAutocomplete = ctx.companyName;
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

    if ((user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN") && currentUserMapping) {
      // Use user's mapped IDs
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
    let finalServiceProviderID = formData.serviceProviderID;
    let finalCompanyID = formData.companyID;

    if ((user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN") && currentUserMapping) {
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

  const handleCancel = () => {
    resetForm();
    setIsAddingNew(false);
    setIsViewing(false);
    setViewRow(null);
  };

  // ---------------------------
  // Search
  // ---------------------------
  const filtered = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return rows;
    const spNameOf = (r: DepartmentRead) =>
      r.serviceProvider?.companyName ?? r.serviceProviderName ?? (r.serviceProviderID != null ? spMap[r.serviceProviderID] : "");
    const coNameOf = (r: DepartmentRead) =>
      r.company?.companyName ?? r.companyName ?? (r.companyID != null ? coMap[r.companyID] : "");
    const brNameOf = (r: DepartmentRead) =>
      r.branches?.branchName ?? r.branchName ?? (r.branchesID != null ? brMap[r.branchesID] : "");
    return rows.filter((r) =>
      [
        r.departmentName,
        spNameOf(r),
        coNameOf(r),
        brNameOf(r),
      ]
        .filter(Boolean)
        .map((x) => (x ?? "").toLowerCase())
        .some((f) => f.includes(t))
    );
  }, [rows, searchTerm, spMap, coMap, brMap]);

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
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage department records</p>
        </div>

        <div className="flex items-center gap-3">
          {!isAddingNew && !isViewing && canManage && (
            <Button
              onClick={() => { resetForm(); setIsAddingNew(true); }}
              className="text-sm px-3 py-2"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Department
            </Button>
          )}
          {(isAddingNew || isViewing) && (
            <Button
              variant="outline"
              onClick={handleCancel}
              className="text-sm"
            >
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Add/Edit Form - Drawer */}
      <FormDrawer
        open={isAddingNew}
        onOpenChange={(v) => { if (!v) handleCancel(); }}
        title={editing ? "Edit Department" : "Add New Department"}
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
      >
        {viewRow && (
        <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg"><strong>Department:</strong> {viewRow.departmentName || "—"}</div>
              <div className="p-3 bg-gray-50 rounded-lg"><strong>Service Provider:</strong> {spName(viewRow)}</div>
              <div className="p-3 bg-gray-50 rounded-lg"><strong>Company:</strong> {coName(viewRow)}</div>
              <div className="p-3 bg-gray-50 rounded-lg"><strong>Branch:</strong> {brName(viewRow)}</div>
            </div>
        </div>
        )}
      </FormDrawer>

      {!isAddingNew && !isViewing && (<>
          <Card>
            <CardContent className="p-6 flex items-center space-x-4">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search departments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
              <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
                {filtered.length} departments
              </Badge>
            </CardContent>
          </Card>

          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon icon="mdi:account-group" className="w-5 h-5" /> Department List
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 w-full overflow-x-auto">
              {loading ? (
                <div className="p-6 text-sm text-gray-500">Loading…</div>
              ) : (
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <Icon icon="mdi:account-search" className="w-12 h-12 text-gray-300" />
                            <p>No departments found</p>
                            <p className="text-sm">Try adjusting your search criteria</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap">{r.departmentName || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{brName(r)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {/* 👁 Everyone can view */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleView(r)}
                                className="h-7 w-7 p-0"
                                title="View"
                              >
                                <Eye className="w-3 h-3" />
                              </Button>

                              {/* ✏️ SUPERADMIN and MANAGER can edit */}
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

                              {/* 🗑️ Only SUPERADMIN and MANAGER can delete */}
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
              )}
            </CardContent>
          </Card>
      </>)}
    </div>
  );
}