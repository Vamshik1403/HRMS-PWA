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
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";


interface SalaryAllowance {
  id: string;
  serviceProvider: string;
  companyName: string;
  branchName: string;
  allowanceName: string;
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

const MIN_CHARS = 1;

export function SalaryAllowancesManagement() {
  const [allowances, setAllowances] = useState<SalaryAllowance[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAllowance, setEditingAllowance] = useState<SalaryAllowance | null>(null);
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "MANAGER";
  const isEmployee = user?.role === "EMPLOYEE";
  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);

// MANAGER mapping loader
useEffect(() => {
  if (user?.role !== "MANAGER") return;

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
    allowanceType: "",
    basedOn: "N/A" as "Gross" | "Basic" | "N/A",
    salaryAllowanceType: "Fixed" as "Fixed" | "Percentage",
    value: 0,
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
  user?.role === "MANAGER"
    ? currentUserMapping?.serviceProviderID
    : formData.serviceProviderID;

const resolvedCompanyID =
  user?.role === "MANAGER"
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
    if (user) loadAllowances();
  }, [user]);

  const loadAllowances = async () => {
    try {
      const res = await fetch(API.allowance);
      const data: ApiSalaryAllowance[] = await res.json();
      const all = data.map(mapApiToUi);

      // 🟢 SUPERADMIN → all
      if (user?.role === "SUPERADMIN") {
        setAllowances(all);
        return;
      }

      // 🟡 MANAGER → filter via /users
      if (user?.role === "MANAGER") {
        const usersRes = await fetch("/backend/users");
        const users = await usersRes.json();
        const currentUser = users.find((u: any) => u.username === user.username);
        if (currentUser) {
          const filtered = all.filter(
            (a: any) =>
              a.companyID === currentUser.companyID &&
              a.branchesID === currentUser.branchesID
          );
          setAllowances(filtered);
          return;
        }
      }

      // 🔵 EMPLOYEE → filter via /manage-emp/credentials/all
      const credsRes = await fetch("/backend/manage-emp/credentials/all");
      const creds = await credsRes.json();
      const emp = creds.find((c: any) => c.username === user?.username);

      if (emp) {
        const filtered = all.filter(
          (a: any) =>
            a.companyID === emp.companyID &&
            a.branchesID === emp.branchesID
        );
        setAllowances(filtered);
      } else {
        setAllowances([]);
      }
    } catch (e) {
      console.error("Failed to load allowances", e);
      toast.error("Failed to load data.");
      setAllowances([]);
    }
  };


  // Mappers
  function mapApiToUi(x: ApiSalaryAllowance): SalaryAllowance {
    return {
      id: String(x.id),
      serviceProvider: x.serviceProvider?.companyName ?? "-",
      companyName: x.company?.companyName ?? "-",
      branchName: x.branches?.branchName ?? "-",
      allowanceName: x.salaryAllowanceName ?? "-",
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
      allowanceType: allowance.allowanceType,
      basedOn: allowance.basedOn || "N/A",
      salaryAllowanceType: allowance.salaryAllowanceType,
      value: allowance.value,
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
    setFormData({
      serviceProviderID: null,
      companyID: null,
      branchesID: null,
      spAutocomplete: "",
      coAutocomplete: "",
      brAutocomplete: "",
      allowanceName: "",
      allowanceType: "",
      basedOn: "Gross",
      salaryAllowanceType: "Fixed",
      value: 0,
      perMonthLimit: 0,
    });
    setEditingAllowance(null);
    setSpList([]);
    setCoList([]);
    setBrList([]);
  };

  const filteredAllowances = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return allowances.filter(
      (a) =>
        a.allowanceName.toLowerCase().includes(q) ||
        a.allowanceType.toLowerCase().includes(q) ||
        a.serviceProvider.toLowerCase().includes(q) ||
        a.companyName.toLowerCase().includes(q) ||
        a.branchName.toLowerCase().includes(q)
    );
  }, [allowances, searchTerm]);

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage salary allowances and benefits</p>
        </div>
        {canManage && (
              <Button
                onClick={() => { resetForm(); setIsDialogOpen(true); }}
                className="flex-shrink-0 text-sm px-3 py-2"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Salary Allowance
              </Button>
            )}
      </div>

      <FormDrawer open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }} title={editingAllowance ? "Edit Salary Allowance" : "Add New Salary Allowance"} description={editingAllowance ? "Update the salary allowance information below." : "Fill in the details to add a new salary allowance."}>

            <form onSubmit={handleSubmit} className="space-y-6">
              
   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
  {/* SUPERADMIN → full control */}
  {user?.role === "SUPERADMIN" && (
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
  {user?.role === "MANAGER" && currentUserMapping && (
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
    <Label htmlFor="allowanceType">Allowance Type *</Label>
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
                <Label htmlFor="allowanceName">Allowance Name *</Label>
                <Input
                  id="allowanceName"
                  value={formData.allowanceName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, allowanceName: e.target.value }))}
                  placeholder="Enter allowance name"
                  required
                />
              </div>

            {/* Allowance Configuration */}
<div className="space-y-4">
  <h3 className="text-lg font-semibold">Allowance Configuration</h3>
  
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
        }))
      }
      className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
      required
    >
      <option value="Gross">Gross Salary</option>
      <option value="Basic">Basic Salary</option>
      <option value="N/A">Not Applicable</option>
    </select>
  </div>
  
  <div className="space-y-2">
    <Label htmlFor="salaryAllowanceType">Type *</Label>
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
    >
      <option value="Fixed">Fixed Amount</option>
      <option value="Percentage">Percentage</option>
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
            setFormData((prev) => ({ ...prev, value: parseFloat(e.target.value) || 0 }))
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
    {editingAllowance ? "Update Salary Allowance" : "Add Salary Allowance"}
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
                placeholder="Search salary allowances..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredAllowances.length} allowances
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Salary Allowances Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:cash-plus" className="w-5 h-5" />
            Salary Allowances List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 w-full">
          <div className="overflow-x-auto w-full">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Service Provider</TableHead>
                  <TableHead className="w-[120px]">Company Name</TableHead>
                  <TableHead className="w-[120px]">Branch Name</TableHead>
                  <TableHead className="w-[150px]">Allowance Name</TableHead>
                  <TableHead className="w-[120px]">Allowance Type</TableHead>
                  <TableHead className="w-[120px]">Based On</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="w-[100px]">Value</TableHead>
                 
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAllowances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:cash-plus" className="w-12 h-12 text-gray-300" />
                        <p>No salary allowances found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAllowances.map((allowance) => (
                    <TableRow key={allowance.id}>
                      <TableCell className="whitespace-nowrap">{allowance.serviceProvider}</TableCell>
                      <TableCell className="whitespace-nowrap">{allowance.companyName}</TableCell>
                      <TableCell className="whitespace-nowrap">{allowance.branchName}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{allowance.allowanceName}</TableCell>
                      <TableCell className="whitespace-nowrap">{allowance.allowanceType}</TableCell>
                      <TableCell className="whitespace-nowrap">{allowance.basedOn}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={allowance.salaryAllowanceType === "Fixed" ? "default" : "secondary"}>
                          {allowance.salaryAllowanceType}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        {allowance.salaryAllowanceType === "Percentage" ? `${allowance.value}%` : `₹${allowance.value}`}
                      </TableCell>
                     
                      {canManage && (
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(allowance)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(allowance.id)}
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
