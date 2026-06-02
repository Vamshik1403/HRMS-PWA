"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { FormDrawer } from "../components/ui/form-drawer";
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
import { Plus, Search, Edit, Trash2, Info, ArrowLeft } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";


interface SalaryDeduction {
  id: string;
  serviceProvider: string;
  companyName: string;
  branchName: string;
  deductionName: string;
  displayName: string;
  deductionTypeField: string;
  basedOn?: string;
  deductionType: "Fixed" | "Percentage";
  value: number;
  perMonthLimit: number;
  companyID: number | null;
  branchesID: number | null;
  serviceProviderID: number | null;
  createdAt: string;
}

type ApiSalaryDeduction = {
  id: number;
  serviceProviderID: number | null;
  companyID: number | null;
  branchesID: number | null;
  salaryDeductionName: string | null;
  displayName?: string | null;
  deductionTypeField?: string | null;
  basedOn?: string | null;
  salaryDeductionType: string | null; // "Fixed" | "Percentage"
  salaryDeductionValue: string | null; // stored as string
  salaryDeductionMonthLimit: string | null; // stored as string
  serviceProvider?: { id: number; companyName?: string | null } | null;
  company?: { id: number; companyName?: string | null } | null;
  branches?: { id: number; branchName?: string | null } | null;
  createdAt?: string;
};

type SP = { id: number; companyName?: string | null };
type CO = { id: number; companyName?: string | null; serviceProviderID?: number | null };
type BR = { id: number; branchName?: string | null; companyID: number; branchesID: number };

// ---- API endpoints ----
const API = {
  deduction: "/backend/salary-deduction",
  serviceProviders: "/backend/service-provider",
  companies: "/backend/company",
  branches: "/backend/branches",
};

const MIN_CHARS = 0;

export function SalaryDeductionsManagement() {
  const [deductions, setDeductions] = useState<SalaryDeduction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDeduction, setEditingDeduction] = useState<SalaryDeduction | null>(null);
  const user = useCurrentUser();
const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN";
const isEmployee = user?.role === "EMPLOYEE";
const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);




// load manager mapping from /users
useEffect(() => {
  if (user?.role !== "SERVICE_PROVIDER") return;

  (async () => {
    const res = await fetch("/backend/users");
    const list = await res.json();
    const me = list.find((u: any) => u.username === user.username);
    setCurrentUserMapping(me || null);
  })();
}, [user]);

// apply to form automatically
useEffect(() => {
  if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
    setFormData((p) => ({
      ...p,
      serviceProviderID: currentUserMapping.serviceProviderID,
      companyID: currentUserMapping.companyID,
      branchesID: currentUserMapping.branchesID,
    }));
  }
}, [currentUserMapping]);




  // ---- Form state: store IDs + autocomplete strings + fields ----
  const [formData, setFormData] = useState({
    serviceProviderID: null as number | null,
    companyID: null as number | null,
    branchesID: null as number | null,
    spAutocomplete: "",
    coAutocomplete: "",
    brAutocomplete: "",
    deductionName: "",
    displayName: "",
    deductionTypeField: "",
    basedOn: "Gross" as "Gross" | "Basic" | "N/A",
    deductionType: "Fixed" as "Fixed" | "Percentage",
    value: "",
    perMonthLimit: 0,
  });

  // ---- Autocomplete lists/flags + refs for click-outside ----
  const [spList, setSpList] = useState<SP[]>([]);
  const [coList, setCoList] = useState<CO[]>([]);
  const [brList, setBrList] = useState<BR[]>([]);
  const [spLoading, setSpLoading] = useState(false);
  const [coLoading, setCoLoading] = useState(false);
  const [brLoading, setBrLoading] = useState(false);

  const spRef = useRef<HTMLDivElement | null>(null);
  const coRef = useRef<HTMLDivElement | null>(null);
  const brRef = useRef<HTMLDivElement | null>(null);

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


  const resolvedServiceProviderID =
  user?.role === "SERVICE_PROVIDER"
    ? currentUserMapping?.serviceProviderID
    : formData.serviceProviderID;

const resolvedCompanyID =
  user?.role === "SERVICE_PROVIDER"
    ? currentUserMapping?.companyID
    : formData.companyID;


  // ---- Initial load ----
useEffect(() => {
  if (!user) return;
  loadDeductions();
}, [user, currentUserMapping]);

useEffect(() => {
  const handler = () => { if (user) loadDeductions(); };
  window.addEventListener("sidebar-context-changed", handler);
  return () => window.removeEventListener("sidebar-context-changed", handler);
}, [user]);


const loadDeductions = async () => {
  try {
    const res = await fetch(API.deduction);
    const data: ApiSalaryDeduction[] = await res.json();
    const all = data.map(mapApiToUi);

    // 🟢 SUPERADMIN → filter by sidebar context
    if (user?.role === "SUPERADMIN") {
      const ctx = getSidebarContext();
      if (ctx?.companyID) {
        setDeductions(all.filter((r: any) => r.companyID === ctx.companyID));
      } else {
        setDeductions(all);
      }
      return;
    }

    // 🟡 MANAGER — filter via /users
    if (user?.role === "SERVICE_PROVIDER") {
      const ctx = getSidebarContext();
      if (ctx?.companyID) {
        setDeductions(all.filter((d: any) => d.companyID === ctx.companyID));
        return;
      }
    }

    // 🔴 COMPANY_ADMIN / BRANCH_ADMIN → filter by company (+ branch for BRANCH_ADMIN)
    if (user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN") {
      const ctx = getSidebarContext();
      const companyID = ctx?.companyID ?? user?.companyID;
      if (companyID) {
        setDeductions(all.filter((d: any) =>
          d.companyID === companyID &&
          (user?.role !== "BRANCH_ADMIN" || !d.branchesID || Number(d.branchesID) === Number(user?.branchesID))
        ));
      } else {
        setDeductions([]);
      }
      return;
    }

    // �🔵 EMPLOYEE — filter via /manage-emp/credentials/all
    const credsRes = await fetch("/backend/manage-emp/credentials/all");
    const creds = await credsRes.json();
    const emp = creds.find((c: any) => c.username === user?.username);

    if (emp) {
      const filtered = all.filter(
        (d) =>
          d.companyID === emp.companyID &&
          d.branchesID === emp.branchesID
      );
      setDeductions(filtered);
    } else {
      setDeductions([]);
    }
  } catch (e) {
    console.error("Failed to load salary deductions", e);
    toast.error("Failed to load data.");
    setDeductions([]);
  }
};


  // ---- Helpers ----
  function safeNum(v: string | null | undefined, d = 0) {
    const n = parseFloat(v ?? "");
    return Number.isFinite(n) ? n : d;
  }

  function mapApiToUi(x: ApiSalaryDeduction): SalaryDeduction {
    return {
      id: String(x.id),
      serviceProvider: x.serviceProvider?.companyName ?? "-",
      companyName: x.company?.companyName ?? "-",
      branchName: x.branches?.branchName ?? "-",
      deductionName: x.salaryDeductionName ?? "-",
      displayName: x.displayName ?? "",
      deductionTypeField: x.deductionTypeField ?? "",
      deductionType:
        ((x.salaryDeductionType ?? "Fixed") === "Percentage" ? "Percentage" : "Fixed") as
          | "Fixed"
          | "Percentage",
      value: safeNum(x.salaryDeductionValue, 0),
      perMonthLimit: safeNum(x.salaryDeductionMonthLimit, 0),
      companyID: x.companyID,
      branchesID: x.branchesID,
      serviceProviderID: x.serviceProviderID,
      createdAt: x.createdAt ? x.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
    };
  }

  function mapUiToPayload(fd: typeof formData) {
    return {
      serviceProviderID: fd.serviceProviderID,
      companyID: fd.companyID,
      branchesID: fd.branchesID,
      salaryDeductionName: fd.deductionName,
      displayName: fd.displayName,
      deductionTypeField: fd.deductionTypeField,
      basedOn: fd.basedOn,
      salaryDeductionType: fd.deductionType, 
      salaryDeductionValue: String(fd.value ?? 0),
      salaryDeductionMonthLimit: String(fd.perMonthLimit ?? 0),
    };
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

  // ---- Debounced FK fetchers ----
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




  // ---- CRUD ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const validationErrors: string[] = [];
    if (!formData.deductionName?.trim()) validationErrors.push("Deduction Name is required");
    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg));
      return;
    }

    const payload = mapUiToPayload(formData);

    try {
      if (editingDeduction) {
        const res = await fetch(`${API.deduction}/${editingDeduction.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const updated: ApiSalaryDeduction = await res.json();
        setDeductions((prev) => prev.map((d) => (d.id === String(updated.id) ? mapApiToUi(updated) : d)));
      } else {
        const res = await fetch(API.deduction, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created: ApiSalaryDeduction = await res.json();
        setDeductions((prev) => [mapApiToUi(created), ...prev]);
      }
      resetForm();
      setIsDialogOpen(false);
      toast.success(editingDeduction ? "Updated successfully" : "Created successfully");
    } catch (e) {
      console.error("Save failed", e);
      toast.error("Failed to save. Please try again.");
    }
  };

  const handleEdit = (deduction: SalaryDeduction) => {
    setFormData((p) => ({
      ...p,
      serviceProviderID: null,
      companyID: null,
      branchesID: null,
      spAutocomplete: deduction.serviceProvider || "",
      coAutocomplete: deduction.companyName || "",
      brAutocomplete: deduction.branchName || "",
      deductionName: deduction.deductionName,
      displayName: deduction.displayName || "",
      deductionTypeField: deduction.deductionTypeField || "",
      deductionType: deduction.deductionType,
      value: String(deduction.value),
      perMonthLimit: deduction.perMonthLimit,
    }));
    setEditingDeduction(deduction);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API.deduction}/${id}`, { method: "DELETE" });
      setDeductions((prev) => prev.filter((d) => d.id !== id));
      toast.success("Deduction deleted successfully");
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
      deductionName: "",
      displayName: "",
      deductionTypeField: "",
      basedOn: "Gross",
      deductionType: "Fixed",
      value: "",
      perMonthLimit: 0,
    });
    setEditingDeduction(null);
    setSpList([]);
    setCoList([]);
    setBrList([]);
  };

  const filteredDeductions = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return deductions.filter(
      (d) =>
        d.deductionName.toLowerCase().includes(q) ||
        d.serviceProvider.toLowerCase().includes(q) ||
        d.companyName.toLowerCase().includes(q) ||
        d.branchName.toLowerCase().includes(q)
    );
  }, [deductions, searchTerm]);

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage salary deductions and withholdings</p>
        </div>
        {canManage && !isDialogOpen && (
          <Button
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
            className="flex-shrink-0 text-sm px-3 py-2"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Deduction
          </Button>
        )}
      </div>

      <FormDrawer open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }} title={editingDeduction ? "Edit Salary Deduction" : "Add New Salary Deduction"} description={editingDeduction ? "Update the salary deduction information below." : "Fill in the details to add a new salary deduction."}>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
                {/* Service Provider Autocomplete */}
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
      <Label htmlFor="deductionTypeField">Deduction Type *</Label>
      <span className="relative group">
        <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
          {`PF / ESI / PT / TDS`}
        </span>
      </span>
    </div>
    <select
      id="deductionTypeField"
      value={formData.deductionTypeField}
      onChange={(e) =>
        setFormData((prev) => ({
          ...prev,
          deductionTypeField: e.target.value,
        }))
      }
      className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
      required
    >
      <option value="">Select Deduction type</option>
      <option value="PF">PF</option>
      <option value="ESI">ESI</option>
      <option value="PT">PT</option>
      <option value="TDS">TDS</option>
      <option value="Loan Recovery">Loan Recovery</option>
      <option value="Other Deduction">Other Deduction</option>
    </select>
  </div>


              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="deductionName">Deduction Name *</Label>
                  <span className="relative group">
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                      {`Make Unique Name - Duplicate not allowed under same company`}
                    </span>
                  </span>
                </div>
                <Input
                  id="deductionName"
                  value={formData.deductionName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, deductionName: e.target.value }))}
                  placeholder="Enter deduction name"
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

              {/* Deduction Configuration */}
              <div className="space-y-4">
                <div className="flex items-center gap-1">
                  <h3 className="text-lg font-semibold">Deduction Configuration</h3>
                  <span className="relative group">
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                      {`Deduction Value Configuration`}
                    </span>
                  </span>
                </div>

                {/* Based On Dropdown */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="basedOn">Based On *</Label>
                      <span className="relative group">
                        <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                          {`* Basic Salary\n* Gross Salary\n* Fixed Value`}
                        </span>
                      </span>
                    </div>
                    <select
                      id="basedOn"
                      value={formData.basedOn}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          basedOn: e.target.value as "Gross" | "Basic" | "N/A",
                          deductionType: e.target.value === "N/A" ? "Fixed" : prev.deductionType,
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
                    <Label htmlFor="deductionType">Deduction Type *</Label>
                    <span className="relative group">
                      <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                        {`Show 'Percentage' for Basic Salary or Gross Salary\nShow 'Fixed Amount' for Fixed Value`}
                      </span>
                    </span>
                  </div>
                  <select
                    id="deductionType"
                    value={formData.deductionType}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, deductionType: e.target.value as "Fixed" | "Percentage" }))
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
                        {formData.deductionType === "Percentage" ? "%" : "₹"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {formData.deductionType === "Percentage"
                        ? "Percentage of base salary"
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
                  {editingDeduction ? "Update Deduction" : "Add Deduction"}
                </Button>
              </div>
            </form>
      </FormDrawer>

      {!isDialogOpen && (<>
      {/* Search and Filters */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search salary deductions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredDeductions.length} deductions
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Salary Deductions Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:cash-minus" className="w-5 h-5" />
            Salary Deductions List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 w-full">
          <div className="overflow-x-auto w-full">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Branch Name</TableHead>
                  <TableHead className="w-[150px]">Deduction Name</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="w-[100px]">Value</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeductions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:cash-minus" className="w-12 h-12 text-gray-300" />
                        <p>No salary deductions found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDeductions.map((deduction) => (
                    <TableRow key={deduction.id}>
                      <TableCell className="whitespace-nowrap">{deduction.branchName}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{deduction.deductionName}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={deduction.deductionType === "Fixed" ? "default" : "secondary"}>
                          {deduction.deductionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        {deduction.deductionType === "Percentage" ? `${deduction.value}%` : `₹${deduction.value}`}
                      </TableCell>
                    
                      {canManage && (
  <TableCell className="text-right whitespace-nowrap">
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleEdit(deduction)}
        className="h-7 w-7 p-0"
      >
        <Edit className="w-3 h-3" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleDelete(deduction.id)}
        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  </TableCell>
)}

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

/** simple debounce */
function debounce<T extends (...args: any[]) => any>(fn: T, ms = 300) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
