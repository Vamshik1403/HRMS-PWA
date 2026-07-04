"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { FormDrawer } from "../components/ui/form-drawer";
import { Badge } from "../components/ui/badge";
import { Plus, Info, Wallet } from "lucide-react";
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


interface SalaryAllowance {
  id: string;
  serviceProvider: string;
  companyName: string;
  branchName: string;
  companyID: number | null;
  branchesID: number | null;
  allowanceName: string;
  displayName: string;
  allowanceType: string;
  basedOn?: "Gross" | "Basic" | "N/A";
  salaryAllowanceType: "Fixed" | "Percentage";
  value: number;
  perMonthLimit: number;
  createdAt: string;
}

type ApiSalaryAllowance = {
  id: number;
  serviceProviderID: number | null;
  companyID: number | null;
  branchesID: number | null;
  salaryAllowanceName: string | null;
  displayName?: string | null;
  allowanceType: string | null;
  salaryAllowanceType: string | null; // "Fixed" | "Percentage" (stored as string)
  salaryAllowanceValue: string | null; // keep as string in DB
  salaryAllowanceMonthLimit: string | null; // keep as string in DB
  basedOn?: string | null;
  serviceProvider?: { id: number; companyName?: string | null } | null;
  company?: { id: number; companyName?: string | null } | null;
  branches?: { id: number; branchName?: string | null } | null;
  createdAt?: string;
};

type SP = { id: number; companyName?: string | null };
type CO = { id: number; companyName?: string | null; serviceProviderID?: number | null };
type BR = { id: number; branchName?: string | null; companyID?: number | null };

// ---- API endpoints ----
const API = {
  allowance: "/backend/salary-allowance",
  serviceProviders: "/backend/service-provider",
  companies: "/backend/company",
  branches: "/backend/branches",
};

const MIN_CHARS = 0;

export function SalaryAllowancesManagement() {
  const [listLoading, setListLoading] = useState(true);
  const [allowances, setAllowances] = useState<SalaryAllowance[]>([]);
  const table = useClientTable("allowanceName");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [branchFilterList, setBranchFilterList] = useState<any[]>([]);
  const [branchFilterLoading, setBranchFilterLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAllowance, setEditingAllowance] = useState<SalaryAllowance | null>(null);
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN" || canDesktopManagerManage(user);
  const isEmployee = user?.role === "EMPLOYEE";
  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);

// MANAGER mapping loader
useEffect(() => {
  if (user?.role !== "SERVICE_PROVIDER") return;

  (async () => {
    try {
      const res = await fetch("/backend/users");
      const all = await res.json();
      const me = all.find((u: any) => u.username === user.username);
      setCurrentUserMapping(me || null);
    } catch (err) {
      console.error("Failed to load manager mapping", err);
      toast.error("Failed to load data.");
    }
  })();
}, [user]);


  // form state: IDs + autocomplete text + fields
  const [formData, setFormData] = useState({
    serviceProviderID: null as number | null,
    companyID: null as number | null,
    branchesID: null as number | null,
    spAutocomplete: "",
    coAutocomplete: "",
    brAutocomplete: "",
    allowanceName: "",
    displayName: "",
    allowanceType: "",
    basedOn: "N/A" as "Gross" | "Basic" | "N/A",
    salaryAllowanceType: "Fixed" as "Fixed" | "Percentage",
    value: "",
    perMonthLimit: 0,
  });

  // Autocomplete lists/flags + refs
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

  // Initial load
  useEffect(() => {
    if (!user) return;
    loadAllowances();
    loadBranchFilterList();
  }, [user]);

  useEffect(() => {
const handler = () => {
      if (user) {
        loadAllowances();
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

  const loadAllowances = async () => {
    setListLoading(true);
    try {
      const res = await fetch(API.allowance);
      const data: ApiSalaryAllowance[] = await res.json();
      const all = data.map(mapApiToUi);

      const mapping = await resolveScopeUserMapping(user);
      if (mapping) setCurrentUserMapping(mapping);
      setAllowances(await filterCompanyScopedRecords(all, user));

    } catch (e) {
      console.error("Failed to load allowances", e);
      toast.error("Failed to load data.");
      setAllowances([]);
    } finally {
      setListLoading(false);
    }
  };


  // Mappers
  function mapApiToUi(x: ApiSalaryAllowance): SalaryAllowance {
    return {
      id: String(x.id),
      serviceProvider: x.serviceProvider?.companyName ?? "-",
      companyName: x.company?.companyName ?? "-",
      companyID: x.companyID ?? null,
      branchesID: x.branchesID ?? null,
      branchName: x.branches?.branchName ?? "-",
      allowanceName: x.salaryAllowanceName ?? "-",
      displayName: x.displayName ?? "",
      allowanceType: x.allowanceType ?? "-",
      basedOn: ((x.basedOn ?? "Gross") === "Basic" ? "Basic" : 
      (x.basedOn ?? "Gross") === "N/A" ? "N/A" : "Gross") as "Gross" | "Basic" | "N/A",
      salaryAllowanceType: ((x.salaryAllowanceType ?? "Fixed") === "Percentage" ? "Percentage" : "Fixed") as
        | "Fixed"
        | "Percentage",
      value: safeNum(x.salaryAllowanceValue, 0),
      perMonthLimit: safeNum(x.salaryAllowanceMonthLimit, 0),
      createdAt: x.createdAt ? x.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
    };
  }

  function mapUiToPayload(fd: typeof formData) {
    return {
      serviceProviderID: fd.serviceProviderID,
      companyID: fd.companyID,
      branchesID: fd.branchesID,
      salaryAllowanceName: fd.allowanceName,
      displayName: fd.displayName,
      allowanceType: fd.allowanceType,
      basedOn: fd.basedOn,
      salaryAllowanceType: fd.salaryAllowanceType, 
      salaryAllowanceValue: String(fd.value ?? 0),
      salaryAllowanceMonthLimit: String(fd.perMonthLimit ?? 0),
    };
  }

  function safeNum(v: string | null | undefined, d = 0) {
    const n = parseFloat(v ?? "");
    return Number.isFinite(n) ? n : d;
  }

  async function robustGet(url: string, q?: string) {
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

  // debounced autocomplete
  const runFetchSP = debounce(async (val: string) => {
    if (!val || val.length < MIN_CHARS) return setSpList([]);
    setSpLoading(true);
    try {
      const list: SP[] = await robustGet(API.serviceProviders, val);
      const filtered = list.filter((x) => (x.companyName ?? "").toLowerCase().includes(val.toLowerCase()));
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



  // CRUD
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const validationErrors: string[] = [];
    if (!formData.allowanceName?.trim()) validationErrors.push("Allowance Name is required");

    // Unique allowance name per company check
    const targetCompanyID =
      user?.role === "SERVICE_PROVIDER"
        ? currentUserMapping?.companyID
        : formData.companyID;
    if (formData.allowanceName?.trim() && targetCompanyID) {
      const duplicate = allowances.find(
        (a) =>
          a.companyID === targetCompanyID &&
          a.allowanceName.toLowerCase().trim() === formData.allowanceName.toLowerCase().trim() &&
          (!editingAllowance || a.id !== editingAllowance.id)
      );
      if (duplicate) {
        validationErrors.push("Allowance name already exists for this company");
      }
    }

    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg));
      return;
    }

    const payload = mapUiToPayload(formData);

    try {
      if (editingAllowance) {
        const res = await fetch(`${API.allowance}/${editingAllowance.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const updated: ApiSalaryAllowance = await res.json();
        setAllowances((prev) => prev.map((a) => (a.id === String(updated.id) ? mapApiToUi(updated) : a)));
      } else {
        const res = await fetch(API.allowance, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created: ApiSalaryAllowance = await res.json();
        setAllowances((prev) => [mapApiToUi(created), ...prev]);
      }
      resetForm();
      setIsDialogOpen(false);
      toast.success(editingAllowance ? "Updated successfully" : "Created successfully");
    } catch (e) {
      console.error("Save failed", e);
      toast.error("Failed to save. Please try again.");
    }
  };

  const handleEdit = (allowance: SalaryAllowance) => {
    setFormData((p) => ({
      ...p,
      serviceProviderID: null,
      companyID: null,
      branchesID: null,
      spAutocomplete: allowance.serviceProvider || "",
      coAutocomplete: allowance.companyName || "",
      brAutocomplete: allowance.branchName || "",
      allowanceName: allowance.allowanceName,
      displayName: allowance.displayName || "",
      allowanceType: allowance.allowanceType,
      basedOn: allowance.basedOn || "N/A",
      salaryAllowanceType: allowance.salaryAllowanceType,
      value: String(allowance.value),
      perMonthLimit: allowance.perMonthLimit,
    }));
    setEditingAllowance(allowance);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API.allowance}/${id}`, { method: "DELETE" });
      setAllowances((prev) => prev.filter((a) => a.id !== id));
      toast.success("Allowance deleted successfully");
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
      allowanceName: "",
      displayName: "",
      allowanceType: "",
      basedOn: "Gross",
      salaryAllowanceType: "Fixed",
      value: "",
      perMonthLimit: 0,
    });
    setEditingAllowance(null);
    setSpList([]);
    setCoList([]);
    setBrList([]);
  };

  const filteredAllowances = useMemo(() => {
    const q = table.search.trim().toLowerCase();

    let list = allowances.filter((a) => {
      const matchesBranch =
        branchFilter === "ALL" || branchFilter === String(a.branchesID ?? "");

      const matchesSearch =
        !q ||
        a.allowanceName.toLowerCase().includes(q) ||
        a.allowanceType.toLowerCase().includes(q) ||
        a.serviceProvider.toLowerCase().includes(q) ||
        a.companyName.toLowerCase().includes(q) ||
        a.branchName.toLowerCase().includes(q);

      return matchesBranch && matchesSearch;
    });

    return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
      const a = row as SalaryAllowance;
      if (key === "branchName") return a.branchName ?? "";
      if (key === "allowanceName") return a.allowanceName ?? "";
      if (key === "allowanceType") return a.allowanceType ?? "";
      if (key === "basedOn") return a.basedOn ?? "";
      if (key === "salaryAllowanceType") return a.salaryAllowanceType ?? "";
      if (key === "value") return a.value ?? 0;
      return "";
    });
  }, [allowances, table.search, table.sortBy, table.sortDir, branchFilter]);

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

  const allowanceColumns = useMemo((): DataTableColumn<SalaryAllowance>[] => [
    { key: "branchName", header: "Branch", sortable: true, colSpan: 2, cell: (a) => a.branchName || "—" },
    { key: "allowanceName", header: "Allowance Name", sortable: true, colSpan: 2, cell: (a) => <span className="font-medium">{a.allowanceName || "—"}</span> },
    { key: "allowanceType", header: "Allowance Type", sortable: true, colSpan: 2, cell: (a) => a.allowanceType || "—" },
    { key: "basedOn", header: "Based On", sortable: true, colSpan: 2, cell: (a) => a.basedOn || "—" },
    {
      key: "salaryAllowanceType",
      header: "Type",
      sortable: true,
      colSpan: 1,
      cell: (a) => (
        <Badge variant={a.salaryAllowanceType === "Fixed" ? "default" : "secondary"}>
          {a.salaryAllowanceType}
        </Badge>
      ),
    },
    {
      key: "value",
      header: "Value",
      sortable: true,
      colSpan: 1,
      cell: (a) => (a.salaryAllowanceType === "Percentage" ? `${a.value}%` : `₹${a.value}`),
    },
    {
      key: "actions",
      header: "Actions",
      colSpan: 2,
      align: "right",
      cell: (a) => (
        <EntityRowActions
          onEdit={canManage ? () => handleEdit(a) : undefined}
          onDelete={canManage ? () => handleDelete(a.id) : undefined}
        />
      ),
    },
  ], [canManage]);


  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={Wallet}
        title="Allowances"
        description="Manage salary allowances and benefits"
        actions={
          canManage && !isDialogOpen ? (
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />
              Add Allowance
            </Button>
          ) : null
        }
      />

      <FormDrawer open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }} title={editingAllowance ? "Edit Salary Allowance" : "Add New Salary Allowance"} description={editingAllowance ? "Update the salary allowance information below." : "Fill in the details to add a new salary allowance."}>

            <form onSubmit={handleSubmit} className="space-y-6">
              
   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
  {/* SP/Company - auto-filled from sidebar */}
  {false && (
    <>
      {/* Service Provider */}
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

      {/* Company */}
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
    </>
  )}

  {/* MANAGER → hide SP/Company, auto-assign IDs */}
  {user?.role === "SERVICE_PROVIDER" && currentUserMapping && (
    <>
      <input type="hidden" />
      {(() => {
        formData.serviceProviderID = currentUserMapping.serviceProviderID;
        formData.companyID = currentUserMapping.companyID;
      })()}
    </>
  )}

  {/* Branch */}
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
    <div className="flex items-center gap-1">
      <Label htmlFor="allowanceType">Allowance Type *</Label>
      <span className="relative group">
        <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
          {`* HRA - House Rent Allowance
* Travelling Allowance - Travelling allowance for travel between home and office
* Special Allowance - Any additional allowance offers in salary`}
        </span>
      </span>
    </div>
    <select
      id="allowanceType"
      value={formData.allowanceType}
      onChange={(e) =>
        setFormData((prev) => ({
          ...prev,
          allowanceType: e.target.value,
        }))
      }
      className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
      required
    >
      <option value="">Select Allowance type</option>
      <option value="HRA">HRA</option>
      <option value="Conveyance">Conveyance</option>
      <option value="Overtime">Overtime</option>
      <option value="Incentives">Incentives</option>
      <option value="Special Allowance">Special Allowance</option>
    </select>
  </div>


              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="allowanceName">Allowance Name *</Label>
                </div>
                <Input
                  id="allowanceName"
                  value={formData.allowanceName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, allowanceName: e.target.value }))}
                  placeholder="Enter allowance name"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="displayName">Display Name</Label>
                  <span className="relative group">
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                      {`To show in Salary Slip and Reports`}
                    </span>
                  </span>
                </div>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, displayName: e.target.value }))}
                  placeholder="Enter display name"
                />
              </div>

            {/* Allowance Configuration */}
<div className="space-y-4">
  <div className="flex items-center gap-1">
    <h3 className="text-lg font-semibold">Allowance Configuration</h3>
    <span className="relative group">
      <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
        {`Allowance Value Configuration`}
      </span>
    </span>
  </div>
  
  {/* Based On Dropdown */}
  <div className="space-y-2">
    <Label htmlFor="basedOn">Based On *</Label>
    <select
      id="basedOn"
      value={formData.basedOn}
      onChange={(e) =>
        setFormData((prev) => ({
          ...prev,
          basedOn: e.target.value as "Gross" | "Basic" | "N/A",
          salaryAllowanceType: e.target.value === "N/A" ? "Fixed" : prev.salaryAllowanceType,
        }))
      }
      className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
      required
    >
      <option value="Gross">Gross Salary</option>
      <option value="Basic">Basic Salary</option>
      <option value="N/A">Fixed Amount</option>
    </select>
  </div>
  
  <div className="space-y-2">
    <div className="flex items-center gap-1">
      <Label htmlFor="salaryAllowanceType">Type *</Label>
      <span className="relative group">
        <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
          {`Show 'Percentage for Basic Salary or Gross Salary,  Show "Fixed Amount' for Fixed Value`}
        </span>
      </span>
    </div>
    <select
      id="salaryAllowanceType"
      value={formData.salaryAllowanceType}
      onChange={(e) =>
        setFormData((prev) => ({
          ...prev,
          salaryAllowanceType: e.target.value as "Fixed" | "Percentage",
        }))
      }
      className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
      required
      disabled={formData.basedOn === "N/A"}
    >
      <option value="Fixed">Fixed Amount</option>
      {formData.basedOn !== "N/A" && <option value="Percentage">Percentage</option>}
    </select>
  </div>
  
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label htmlFor="value">Value *</Label>
      <div className="flex items-center gap-2">
        <Input
          id="value"
          type="text"
       
          value={formData.value}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, value: e.target.value }))
          }
          placeholder="0"
          required
        />
        <span className="text-sm text-gray-500">
          {formData.salaryAllowanceType === "Percentage" ? "%" : "₹"}
        </span>
      </div>
      <p className="text-xs text-gray-500">
        {formData.salaryAllowanceType === "Percentage"
          ? `Percentage of ${formData.basedOn === "N/A" ? "salary" : formData.basedOn.toLowerCase()}`
          : "Fixed amount in currency"}
      </p>
    </div>
  </div>
</div>

<div className="flex justify-end gap-3 pt-4">
  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
    Cancel
  </Button>
  <Button type="submit" className="">
    {editingAllowance ? "Update Allowance" : "Add Allowance"}
  </Button>
</div>
            </form>
      </FormDrawer>

      {!isDialogOpen && (<>
        <FilterBar
          search={{
            value: table.search,
            onChange: table.setSearch,
            placeholder: "Search salary allowances…",
          }}
          filters={
            <FilterSelect
              id="salary-allowance-branch"
              value={branchFilter}
              onChange={setBranchFilter}
              options={branchFilterOptions}
              width="w-56"
              ariaLabel="Filter by branch"
            />
          }
        />

        <EntityListShell
          title="All allowances"
          columns={allowanceColumns}
          rows={filteredAllowances}
          rowKey={(a) => String(a.id)}
          isLoading={listLoading}
          sortBy={table.sortBy}
          sortDir={table.sortDir}
          onSort={table.setSort}
          emptyIcon={Wallet}
          emptyTitle="No allowances yet"
          emptyDescription="Define your first salary allowance to configure payroll benefits."
          emptyAction={
            canManage ? (
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Allowance
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
