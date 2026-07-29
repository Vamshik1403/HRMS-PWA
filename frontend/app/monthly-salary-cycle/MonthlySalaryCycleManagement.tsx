"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hasModuleWriteAccess } from "@/lib/companyAccess";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { FormDrawer } from "../components/ui/form-drawer";
import { Badge } from "../components/ui/badge";
import { Plus, Wallet } from "lucide-react";
import { PageHeader } from "../components/app/page-header";
import { FilterBar, FilterSelect } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import type { DataTableColumn } from "../components/app/data-table";
import { EntityRowActions } from "../components/app/entity-row-actions";
import { useClientTable, sortRows } from "../hooks/use-client-table";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";
import {
  canDesktopManagerManage,
  filterCompanyScopedRecords,
  resolveScopeUserMapping,
} from "../utils/scopeContext";


interface MonthlySalaryCycle {
  id: string; // keep as string for your table keys/UI
  serviceProvider: string;
  companyName: string;
  branchName: string;
  cycleName: string;
  startDayOfMonth: number;
  companyID: number | null;
  branchesID: number | null;
  serviceProviderID: number | null;
  createdAt: string;

}

type ApiSalaryCycle = {
  id: number;
  serviceProviderID: number | null;
  companyID: number | null;
  branchesID: number | null;
  salaryCycleName: string | null;
  monthStartDay: string | null; // "01", "15", etc
  serviceProvider?: { id: number; companyName?: string | null } | null;
  company?: { id: number; companyName?: string | null } | null;
  branches?: { id: number; branchName?: string | null } | null;
  createdAt?: string;
};

type SP = { id: number; companyName?: string | null };
type CO = { id: number; companyName?: string | null ; serviceProviderID?: number | null };
type BR = { id: number; branchName?: string | null; companyID: number | null };

// ---- Config your API base here ----
const API = {
  salaryCycle: "/backend/salary-cycle",
  serviceProviders: "/backend/service-provider",
  companies: "/backend/company",
  branches: "/backend/branches",
};

const MIN_CHARS = 0;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function MonthlySalaryCycleManagement() {
  const [listLoading, setListLoading] = useState(true);
  const [cycles, setCycles] = useState<MonthlySalaryCycle[]>([]);
  const table = useClientTable("cycleName");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [branchFilterList, setBranchFilterList] = useState<any[]>([]);
const [branchFilterLoading, setBranchFilterLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<MonthlySalaryCycle | null>(null);
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN" || canDesktopManagerManage(user) || hasModuleWriteAccess("PAYROLL");
  const isEmployee = user?.role === "EMPLOYEE";

  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);

  // Fetch mapping for MANAGER
  useEffect(() => {
    if (user?.role !== "SERVICE_PROVIDER") return;

    (async () => {
      try {
        const res = await fetch("/backend/users");
        const list = await res.json();
        const me = list.find((u: any) => u.username === user.username);
        setCurrentUserMapping(me || null);
      } catch (e) {
        console.error("Failed to load manager mapping", e);
        toast.error("Failed to load data.");
      }
    })();
  }, [user]);


  // ---- Form state (IDs + autocomplete strings) ----
  const [formData, setFormData] = useState({
    serviceProviderID: null as number | null,
    companyID: null as number | null,
    branchesID: null as number | null,
    spAutocomplete: "",
    coAutocomplete: "",
    brAutocomplete: "",
    cycleName: "",
    startDayOfMonth: 1,
  });

  // ---- Autocomplete lists/flags & refs for click-outside ----
  const [spList, setSpList] = useState<SP[]>([]);
  const [coList, setCoList] = useState<CO[]>([]);
  const [brList, setBrList] = useState<BR[]>([]);
  const [spLoading, setSpLoading] = useState(false);
  const [coLoading, setCoLoading] = useState(false);
  const [brLoading, setBrLoading] = useState(false);

  const spRef = useRef<HTMLDivElement | null>(null);
  const coRef = useRef<HTMLDivElement | null>(null);
  const brRef = useRef<HTMLDivElement | null>(null);



  const resolvedServiceProviderID =
  user?.role === "SERVICE_PROVIDER"
    ? currentUserMapping?.serviceProviderID
    : formData.serviceProviderID;

const resolvedCompanyID =
  user?.role === "SERVICE_PROVIDER"
    ? currentUserMapping?.companyID
    : formData.companyID;


  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (spRef.current && !spRef.current.contains(t)) setSpList([]);
      if (coRef.current && !coRef.current.contains(t)) setCoList([]);
      if (brRef.current && !brRef.current.contains(t)) setBrList([]);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // ---- Load initial list ----
  useEffect(() => {
  if (user) {
  loadSalaryCycles();
  loadBranchFilterList();
}
  },
   [user]);

  useEffect(() => {
const handler = () => {
  if (user) {
    loadSalaryCycles();
    loadBranchFilterList();
  }
};
    window.addEventListener("sidebar-context-changed", handler);
    window.addEventListener("app-data-refresh", handler);
    return () => {
      window.removeEventListener("sidebar-context-changed", handler);
      window.removeEventListener("app-data-refresh", handler);
    };
  }, [user]);

  const loadBranchFilterList = async () => {
  try {
    setBranchFilterLoading(true);

    const res = await fetch(API.branches, { cache: "no-store" });
    const data = await res.json();

    const ctx = getSidebarContext();

    const activeCompanyID =
      ctx?.companyID ??
      user?.companyID ??
      currentUserMapping?.companyID ??
      formData.companyID ??
      null;

    let branches = Array.isArray(data) ? data : [];

    if (user?.role !== "SUPERADMIN" && activeCompanyID) {
      branches = branches.filter(
        (b: any) => Number(b.companyID) === Number(activeCompanyID)
      );
    }

    if (user?.role === "SUPERADMIN" && ctx?.companyID) {
      branches = branches.filter(
        (b: any) => Number(b.companyID) === Number(ctx.companyID)
      );
    }

    if (user?.role === "BRANCH_ADMIN") {
      const branchID = currentUserMapping?.branchesID ?? user?.branchesID;

      if (branchID) {
        branches = branches.filter((b: any) => Number(b.id) === Number(branchID));
        setBranchFilter(String(branchID));
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

  const loadSalaryCycles = async () => {
    setListLoading(true);
    try {
      const res = await fetch(API.salaryCycle);
      const data: ApiSalaryCycle[] = await res.json();
      const all = data.map(mapApiToUi);

      const mapping = await resolveScopeUserMapping(user);
      if (mapping) setCurrentUserMapping(mapping);
      setCycles(await filterCompanyScopedRecords(all, user));

    } catch (e) {
      console.error("Failed to load salary cycles", e);
      toast.error("Failed to load data.");
      setCycles([]);
    } finally {
      setListLoading(false);
    }
  };


  // ---- Helpers ----
  function mapApiToUi(x: ApiSalaryCycle): MonthlySalaryCycle {
    return {
      id: String(x.id),
      serviceProvider: x.serviceProvider?.companyName ?? "-",
      companyName: x.company?.companyName ?? "-",
      branchName: x.branches?.branchName ?? "-",
      cycleName: x.salaryCycleName ?? "-",
      startDayOfMonth: parseInt(x.monthStartDay ?? "1", 10),
      companyID: x.companyID,
      branchesID: x.branchesID,
      serviceProviderID: x.serviceProviderID,
      createdAt: x.createdAt ? x.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
    };
  }

  async function robustGet(url: string, q?: string) {
    // Try with ?q first; if it fails, retry plain GET
    try {
      const res = await fetch(q ? `${url}?q=${encodeURIComponent(q)}` : url);
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    } catch {
      const res2 = await fetch(url);
      if (!res2.ok) throw new Error(String(res2.status));
      return res2.json();
    }
  }

  // ---- Autocomplete fetchers (debounced by 250ms) ----
  const runFetchSP = debounce(async (val: string) => {
    if (!val || val.length < MIN_CHARS) return setSpList([]);
    setSpLoading(true);
    try {
      const list: SP[] = await robustGet(API.serviceProviders, val);
      const filtered = list.filter(x =>
        (x.companyName ?? "").toLowerCase().includes(val.toLowerCase())
      );
      setSpList(filtered.slice(0, 50));
    } catch (e) {
      console.error("SP fetch error", e);
      toast.error("Failed to load data.");
      setSpList([]);
    } finally {
      setSpLoading(false);
    }
  }, 250);

const runFetchCO = debounce(async (val: string) => {
  if (!val || val.length < MIN_CHARS) return setCoList([]);

  // ❗ must know Service Provider
  if (!resolvedServiceProviderID) {
    setCoList([]);
    return;
  }

  setCoLoading(true);
  try {
    const list: CO[] = await robustGet(API.companies, val);

    const filtered = list.filter(
      (c) =>
        c.serviceProviderID === resolvedServiceProviderID &&
        (c.companyName ?? "").toLowerCase().includes(val.toLowerCase())
    );

    setCoList(filtered.slice(0, 50));
  } catch (e) {
    console.error("CO fetch error", e);
    toast.error("Failed to load data.");
    setCoList([]);
  } finally {
    setCoLoading(false);
  }
}, 250);


const runFetchBR = debounce(async (val: string) => {
  if (!val || val.length < MIN_CHARS) return setBrList([]);

  // ❗ must know Company
  if (!resolvedCompanyID) {
    setBrList([]);
    return;
  }

  setBrLoading(true);
  try {
    const list: BR[] = await robustGet(API.branches, val);

    const filtered = list.filter(
      (b) =>
        b.companyID === resolvedCompanyID &&
        (user?.role !== "BRANCH_ADMIN" || Number(b.id) === Number(user?.branchesID)) &&
        (b.branchName ?? "").toLowerCase().includes(val.toLowerCase())
    );

    setBrList(filtered.slice(0, 50));
  } catch (e) {
    console.error("BR fetch error:", e);
    toast.error("Failed to load data.");
    setBrList([]);
  } finally {
    setBrLoading(false);
  }
}, 250);


  // ---- CRUD handlers ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      serviceProviderID: formData.serviceProviderID,
      companyID: formData.companyID,
      branchesID: formData.branchesID,
      salaryCycleName: formData.cycleName,
      monthStartDay: pad2(formData.startDayOfMonth),
    };

    try {
      if (editingCycle) {
        const res = await fetch(`${API.salaryCycle}/${editingCycle.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const updated: ApiSalaryCycle = await res.json();
        setCycles(prev =>
          prev.map(c => (c.id === String(updated.id) ? mapApiToUi(updated) : c))
        );
      } else {
        const res = await fetch(API.salaryCycle, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created: ApiSalaryCycle = await res.json();
        setCycles(prev => [mapApiToUi(created), ...prev]);
      }
      resetForm();
      setIsDialogOpen(false);
      toast.success(editingCycle ? "Updated successfully" : "Created successfully");
    } catch (e) {
      console.error("Save failed", e);
      toast.error("Failed to save. Please try again.");
    }
  };

  const handleEdit = (cycle: MonthlySalaryCycle) => {
    setFormData(p => ({
      ...p,
      // When editing, we only have display strings. User will re-pick if needed.
      serviceProviderID: null,
      companyID: null,
      branchesID: null,
      spAutocomplete: cycle.serviceProvider || "",
      coAutocomplete: cycle.companyName || "",
      brAutocomplete: cycle.branchName || "",
      cycleName: cycle.cycleName,
      startDayOfMonth: cycle.startDayOfMonth || 1,
    }));
    setEditingCycle(cycle);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API.salaryCycle}/${id}`, { method: "DELETE" });
      setCycles(prev => prev.filter(c => c.id !== id));
      toast.success("Salary cycle deleted successfully");
    } catch (e) {
      console.error("Delete failed", e);
      toast.error("Failed to delete. Please try again.");
    }
  };

  const resetForm = () => {
    const ctx = getSidebarContext();
    setFormData({
      serviceProviderID: ctx?.serviceProviderID ?? null,
      companyID: ctx?.companyID ?? null,
      branchesID: null,
      spAutocomplete: ctx?.serviceProviderName ?? "",
      coAutocomplete: ctx?.companyName ?? "",
      brAutocomplete: "",
      cycleName: "",
      startDayOfMonth: 1,
    });
    setEditingCycle(null);
    setSpList([]);
    setCoList([]);
    setBrList([]);
  };

  const filteredCycles = useMemo(() => {
    const q = table.search.trim().toLowerCase();

    let list = cycles.filter((cycle) => {
      const matchesBranch =
        branchFilter === "ALL" || branchFilter === String(cycle.branchesID ?? "");

      const matchesSearch =
        !q ||
        [cycle.cycleName, cycle.serviceProvider, cycle.companyName, cycle.branchName]
          .some((f) => String(f ?? "").toLowerCase().includes(q));

      return matchesBranch && matchesSearch;
    });

    return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
      const c = row as MonthlySalaryCycle;
      if (key === "cycleName") return c.cycleName ?? "";
      if (key === "branchName") return c.branchName ?? "";
      if (key === "startDayOfMonth") return c.startDayOfMonth ?? 0;
      if (key === "createdAt") return c.createdAt ?? "";
      return "";
    });
  }, [cycles, table.search, table.sortBy, table.sortDir, branchFilter]);

  const branchFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All branches" },
      ...branchFilterList.map((b: any) => ({
        value: String(b.id),
        label: b.branchName || `Branch #${b.id}`,
      })),
    ],
    [branchFilterList],
  );

  const cycleColumns = useMemo((): DataTableColumn<MonthlySalaryCycle>[] => [
    { key: "branchName", header: "Branch", sortable: true, colSpan: 3, cell: (c) => c.branchName || "—" },
    { key: "cycleName", header: "Cycle", sortable: true, colSpan: 3, cell: (c) => <span className="font-medium">{c.cycleName || "—"}</span> },
    {
      key: "startDayOfMonth",
      header: "Start Day",
      sortable: true,
      colSpan: 2,
      cell: (c) => <Badge variant="outline">Day {c.startDayOfMonth}</Badge>,
    },
    { key: "createdAt", header: "Created", sortable: true, colSpan: 2, cell: (c) => c.createdAt || "—" },
    {
      key: "actions",
      header: "Actions",
      colSpan: 2,
      align: "right",
      cell: (c) => (
        <EntityRowActions
          onEdit={canManage ? () => handleEdit(c) : undefined}
          onDelete={canManage ? () => handleDelete(c.id) : undefined}
        />
      ),
    },
  ], [canManage]);

  // Generate day options for dropdown
  const dayOptions = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), []);

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={Wallet}
        title="Salary Cycle"
        description="Manage monthly salary cycle configurations"
        actions={
          canManage && !isDialogOpen ? (
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />
              Add Salary Cycle
            </Button>
          ) : null
        }
      />

      <FormDrawer open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }} title={editingCycle ? "Edit Monthly Salary Cycle" : "Add New Monthly Salary Cycle"} description={editingCycle ? "Update the monthly salary cycle information below." : "Fill in the details to add a new monthly salary cycle."}>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              {/* Service Provider (Autocomplete) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                {/* MANAGER — hidden auto-fill */}
                {user?.role === "SERVICE_PROVIDER" && currentUserMapping && (
                  <>
                    <input type="hidden" value={currentUserMapping.serviceProviderID} />
                    <input type="hidden" value={currentUserMapping.companyID} />

                    {(() => {
                      // auto-fill IDs
                      formData.serviceProviderID = currentUserMapping.serviceProviderID;
                      formData.companyID = currentUserMapping.companyID;
                    })()}
                  </>
                )}

                {/* Branch (visible for both) */}
                <div ref={brRef} className="space-y-2 relative">
                  <Label>Branch *</Label>
                  <Input
                    value={formData.brAutocomplete}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((p) => ({ ...p, brAutocomplete: val, branchesID: null }));
                      runFetchBR(val);
                    }}
                    onFocus={() => formData.brAutocomplete && runFetchBR(formData.brAutocomplete)}
                    placeholder="Start typing branch…"
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
                              brAutocomplete: br.branchName ?? "",
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

              </div>

              <div className="space-y-2">
                <Label htmlFor="cycleName">Cycle Name *</Label>
                <Input
                  id="cycleName"
                  value={formData.cycleName}
                  onChange={(e) => setFormData(prev => ({ ...prev, cycleName: e.target.value }))}
                  placeholder="Enter cycle name"
                  required
                />
              </div>

              {/* Start Day Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Cycle Configuration</h3>
                <div className="space-y-2">
                  <Label htmlFor="startDayOfMonth">Start Day of Month *</Label>
                  <select
                    id="startDayOfMonth"
                    value={formData.startDayOfMonth}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDayOfMonth: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                    required
                  >
                    {dayOptions.map(day => (
                      <option key={day} value={day}>
                        Day {day}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-500">
                    Select the day of the month when the salary cycle starts
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="">
                  {editingCycle ? "Update Salary Cycle" : "Add Salary Cycle"}
                </Button>
              </div>
            </form>
      </FormDrawer>

      {!isDialogOpen && (<>
        <FilterBar
          search={{
            value: table.search,
            onChange: table.setSearch,
            placeholder: "Search code or name…",
          }}
          filters={
            <FilterSelect
              id="salary-cycle-branch"
              value={branchFilter}
              onChange={setBranchFilter}
              options={branchFilterOptions}
              width="w-56"
              ariaLabel="Filter by branch"
            />
          }
        />

        <EntityListShell
          title="All salary cycles"
          columns={cycleColumns}
          rows={filteredCycles}
          rowKey={(c) => String(c.id)}
          isLoading={listLoading}
          sortBy={table.sortBy}
          sortDir={table.sortDir}
          onSort={table.setSort}
          emptyIcon={Wallet}
          emptyTitle="No salary cycles yet"
          emptyDescription="Define your first salary cycle to anchor payroll runs."
          emptyAction={
            canManage ? (
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Salary Cycle
              </Button>
            ) : undefined
          }
        />
      </>)}
    </div>
  );
}

/** simple debounce */
function debounce<T extends (...args: any[]) => any>(fn: T, ms = 300) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
