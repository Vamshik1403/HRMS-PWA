"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { FormDrawer } from "../components/ui/form-drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Icon } from "@iconify/react";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";


/* ---------------- API endpoints ---------------- */
const API = {
  bonus: "/backend/bonus-setup",
  serviceProviders: "/backend/service-provider",
  companies: "/backend/company",
  branches: "/backend/branches",
};

const MIN_CHARS = 0;

/* ---------------- Types ---------------- */
interface BonusSetupUI {
  id: string;
  serviceProviderID: number | null;
  companyID: number | null;
  branchesID: number | null;
  serviceProvider: string;
  companyName: string;
  branchName: string;
  bonusName: string;
  bonusType: string;
  description: string;
  bonusBasedOn: "Basic" | "Gross";
  percentageOfBonus: number;
  bonusFixed: string;

  createdAt: string;
}

type ApiBonus = {
  id: number;
  serviceProviderID: number | null;
  companyID: number | null;
  branchesID: number | null;
  bonusName: string | null;
  bonusType: string | null;
  bonusDescription: string | null;
  bonusBasedOn: string | null;   // "Basic" | "Gross" (stored as string)
  bonusPercentage: string | null; // stored as string in DB
  bonusFixed: string | null;
  createdAt?: string;
  serviceProvider?: { id: number; companyName?: string | null } | null;
  company?: { id: number; companyName?: string | null } | null;
  branches?: { id: number; branchName?: string | null } | null;
};

type SP = { id: number; companyName?: string | null };
type CO = { id: number; companyName?: string | null; serviceProviderID: number | null };
type BR = { id: number; branchName?: string | null; companyID: number | null; branchesID: number | null };

/* ---------------- Component ---------------- */
export function BonusSetupManagement() {
  const [bonuses, setBonuses] = useState<BonusSetupUI[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBonus, setEditingBonus] = useState<BonusSetupUI | null>(null);

  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN";
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
        console.error("Mapping fetch failed", e);
      }
    })();
  }, [user]);

  // Auto-assign IDs for MANAGER
  useEffect(() => {
    if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
      setFormData((p) => ({
        ...p,
        serviceProviderID: currentUserMapping.serviceProviderID,
        companyID: currentUserMapping.companyID,
        branchesID: currentUserMapping.branchesID,
      }));
    }
  }, [user, currentUserMapping]);

  // FK autocomplete lists
  const [spList, setSpList] = useState<SP[]>([]);
  const [coList, setCoList] = useState<CO[]>([]);
  const [brList, setBrList] = useState<BR[]>([]);
  const [spLoading, setSpLoading] = useState(false);
  const [coLoading, setCoLoading] = useState(false);
  const [brLoading, setBrLoading] = useState(false);
  const spRef = useRef<HTMLDivElement | null>(null);
  const coRef = useRef<HTMLDivElement | null>(null);
  const brRef = useRef<HTMLDivElement | null>(null);

  // Form: keep IDs + visible text
  const [formData, setFormData] = useState({
    serviceProviderID: null as number | null,
    companyID: null as number | null,
    branchesID: null as number | null,
    spAutocomplete: "",
    coAutocomplete: "",
    brAutocomplete: "",
    bonusName: "",
    bonusType: "",
    description: "",
    bonusBasedOn: "Basic" as "Basic" | "Gross",
    percentageOfBonus: 0,
    bonusFixed: "",
  });

  const resolvedServiceProviderID =
  user?.role === "SERVICE_PROVIDER"
    ? currentUserMapping?.serviceProviderID
    : formData.serviceProviderID;

const resolvedCompanyID =
  user?.role === "SERVICE_PROVIDER"
    ? currentUserMapping?.companyID
    : formData.companyID;


  /* -------- click outside to close suggestion popovers -------- */
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (spRef.current && !spRef.current.contains(t)) setSpList([]);
      if (coRef.current && !coRef.current.contains(t)) setCoList([]);
      if (brRef.current && !brRef.current.contains(t)) setBrList([]);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  /* ---------------- initial load ---------------- */
  useEffect(() => {
    if (user) loadBonuses();
  }, [user]);

  useEffect(() => {
    const handler = () => { if (user) loadBonuses(); };
    window.addEventListener("sidebar-context-changed", handler);
    window.addEventListener("app-data-refresh", handler);
    return () => {
      window.removeEventListener("sidebar-context-changed", handler);
      window.removeEventListener("app-data-refresh", handler);
    };
  }, [user]);

  const loadBonuses = async () => {
    try {
      // Build URL with filters for MANAGER role
      let bonusUrl = API.bonus;
      
      if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
        const params = new URLSearchParams();
        if (currentUserMapping.companyID) params.append('companyID', currentUserMapping.companyID.toString());
        if (currentUserMapping.branchesID) params.append('branchesID', currentUserMapping.branchesID.toString());
        if (!currentUserMapping.companyID && currentUserMapping.serviceProviderID) params.append('serviceProviderID', currentUserMapping.serviceProviderID.toString());
        
        const queryString = params.toString();
        if (queryString) {
          bonusUrl += `?${queryString}`;
        }
      }

      const res = await fetch(bonusUrl);
      const data: ApiBonus[] = await res.json();
      
      // Additional client-side filtering for MANAGER role
      let filteredData = data;
      if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
        if (currentUserMapping.companyID && currentUserMapping.branchesID) {
          filteredData = data.filter(bonus => {
            return bonus.companyID === currentUserMapping.companyID && 
                   bonus.branchesID === currentUserMapping.branchesID;
          });
        } else if (currentUserMapping.companyID) {
          filteredData = data.filter(bonus => bonus.companyID === currentUserMapping.companyID);
        } else if (currentUserMapping.serviceProviderID) {
          filteredData = data.filter((bonus: any) => bonus.serviceProviderID === currentUserMapping.serviceProviderID);
        } else {
          filteredData = [];
        }
      }

      const all = filteredData.map(mapApiToUi);

      // SUPERADMIN → filter by sidebar context
      if (user?.role === "SUPERADMIN") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          setBonuses(all.filter((r: any) => r.companyID === ctx.companyID));
        } else {
          setBonuses(all);
        }
        return;
      }

      // MANAGER → filter from /users
      if (user?.role === "SERVICE_PROVIDER") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          setBonuses(all.filter((b: any) => b.companyID === ctx.companyID));
          return;
        }
      }

      // COMPANY_ADMIN / BRANCH_ADMIN → filter by company (+ branch for BRANCH_ADMIN)
      if (user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN") {
        const ctx = getSidebarContext();
        const companyID = ctx?.companyID ?? user?.companyID;
        if (companyID) {
          setBonuses(all.filter((b: any) =>
            b.companyID === companyID &&
            (user?.role !== "BRANCH_ADMIN" || !b.branchesID || Number(b.branchesID) === Number(user?.branchesID))
          ));
        } else {
          setBonuses([]);
        }
        return;
      }

      // EMPLOYEE → filter from /manage-emp/credentials/all
      const credsRes = await fetch("/backend/manage-emp/credentials/all");
      const creds = await credsRes.json();
      const emp = creds.find((c: any) => c.username === user?.username);
      if (emp) {
        const filtered = all.filter(
          (b) =>
            b.companyID === emp.companyID &&
            b.branchesID === emp.branchesID
        );
        setBonuses(filtered);
      } else {
        setBonuses([]);
      }
    } catch (e) {
      console.error("Failed to load bonuses", e);
      setBonuses([]);
    }
  };


  /* ---------------- helpers ---------------- */
  function safeNum(v: string | null | undefined, d = 0) {
    const n = parseFloat(v ?? "");
    return Number.isFinite(n) ? n : d;
  }

  function mapApiToUi(x: ApiBonus): BonusSetupUI {
    return {
      id: String(x.id),
      serviceProviderID: x.serviceProviderID ?? null,
      companyID: x.companyID ?? null,
      branchesID: x.branchesID ?? null,
      serviceProvider: x.serviceProvider?.companyName ?? "-",
      companyName: x.company?.companyName ?? "-",
      branchName: x.branches?.branchName ?? "-",
      bonusName: x.bonusName ?? "-",
      bonusType: x.bonusType ?? "-",
      description: x.bonusDescription ?? "",
      bonusBasedOn: (x.bonusBasedOn === "Gross" ? "Gross" : "Basic") as "Basic" | "Gross",
      percentageOfBonus: safeNum(x.bonusPercentage, 0),
      bonusFixed: x.bonusFixed ?? "",
      createdAt: x.createdAt ? x.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
    };
  }

  function mapUiToPayload(fd: typeof formData) {
    return {
      serviceProviderID: fd.serviceProviderID,
      companyID: fd.companyID,
      branchesID: fd.branchesID,
      bonusName: fd.bonusName,
      bonusType: fd.bonusType,
      bonusDescription: fd.description,
      bonusBasedOn: fd.bonusType === "Percentage" ? fd.bonusBasedOn : null,
      bonusPercentage: fd.bonusType === "Percentage" ? String(fd.percentageOfBonus) : null,
      bonusFixed: fd.bonusType === "Fixed" ? fd.bonusFixed : null,
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

  /* ---------------- debounced FK fetchers ---------------- */
  const runFetchSP = debounce(async (val: string) => {
    if (!val || val.length < MIN_CHARS) return setSpList([]);
    setSpLoading(true);
    try {
      const list: SP[] = await robustGet(API.serviceProviders, val);
      const filtered = list.filter((x) => (x.companyName ?? "").toLowerCase().includes(val.toLowerCase()));
      setSpList(filtered.slice(0, 50));
    } catch (e) {
      console.error("SP fetch error", e);
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
    setBrList([]);
  } finally {
    setBrLoading(false);
  }
}, 250);

  /* ---------------- CRUD ---------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const validationErrors: string[] = [];
    if (!formData.bonusName?.trim()) validationErrors.push("Bonus Name is required");
    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg));
      return;
    }

    const payload = mapUiToPayload(formData);
    try {
      if (editingBonus) {
        const res = await fetch(`${API.bonus}/${editingBonus.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const updated: ApiBonus = await res.json();
        setBonuses((prev) => prev.map((b) => (b.id === String(updated.id) ? mapApiToUi(updated) : b)));
      } else {
        const res = await fetch(API.bonus, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created: ApiBonus = await res.json();
        setBonuses((prev) => [mapApiToUi(created), ...prev]);
      }
      resetForm();
      setIsDialogOpen(false);
      toast.success("Bonus setup saved successfully");
    } catch (e) {
      console.error("Save failed", e);
      toast.error((e as any)?.message || "Failed to save bonus setup");
    }
  };

  const handleEdit = (bonus: BonusSetupUI) => {
    setFormData({
      serviceProviderID: bonus.serviceProviderID,
      companyID: bonus.companyID,
      branchesID: bonus.branchesID,
      spAutocomplete: bonus.serviceProvider || "",
      coAutocomplete: bonus.companyName || "",
      brAutocomplete: bonus.branchName || "",
      bonusName: bonus.bonusName,
      bonusType: bonus.bonusType,
      description: bonus.description,
      bonusBasedOn: bonus.bonusBasedOn,
      percentageOfBonus: bonus.percentageOfBonus,
      bonusFixed: bonus.bonusFixed,
    });
    setEditingBonus(bonus);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API.bonus}/${id}`, { method: "DELETE" });
      setBonuses((prev) => prev.filter((b) => b.id !== id));
      toast.success("Bonus setup deleted successfully");
    } catch (e) {
      console.error("Delete failed", e);
      toast.error((e as any)?.message || "Failed to delete bonus setup");
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
      bonusName: "",
      bonusType: "",
      description: "",
      bonusBasedOn: "Basic",
      percentageOfBonus: 0,
      bonusFixed: "",
    });
    setEditingBonus(null);
    setSpList([]); setCoList([]); setBrList([]);
  };

  const filteredBonuses = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return bonuses.filter(
      (b) =>
        b.bonusName.toLowerCase().includes(q) ||
        b.bonusType.toLowerCase().includes(q) ||
        b.serviceProvider.toLowerCase().includes(q) ||
        b.companyName.toLowerCase().includes(q) ||
        b.branchName.toLowerCase().includes(q),
    );
  }, [bonuses, searchTerm]);

  // Determine which fields to show based on bonus type
  const showFixedBonus = formData.bonusType === "Fixed";
  const showPercentageFields = formData.bonusType === "Percentage";

  /* ---------------- UI ---------------- */
  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      {/* FormDrawer for Add/Edit */}
      <FormDrawer
        open={isDialogOpen}
        onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}
        title={editingBonus ? "Edit Bonus Setup" : "Add New Bonus Setup"}
        description={editingBonus ? "Update the bonus setup information below." : "Fill in the details to add a new bonus setup."}
      >
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information WITH AUTOCOMPLETE */}
              {/* SP/Company auto-filled from sidebar, Branch always visible */}
                <div className="grid grid-cols-1 gap-4">
                  {/* Service Provider - auto-filled from sidebar */}
                  <div ref={spRef} className="space-y-2 relative hidden">
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

                  {/* Company - auto-filled from sidebar */}
                  <div ref={coRef} className="space-y-2 relative hidden">
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
                      onFocus={(e) => {
                        const val = e.target.value;
                        if (val.length >= MIN_CHARS) runFetchBR(val);
                      }}
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

              {/* MANAGER → Only Branch input - disabled, Branch now always visible above */}
              {false && (
                <div className="grid grid-cols-1 gap-4">
                  <div ref={brRef} className="space-y-2 relative">
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
              )}

              {/* Bonus Name */}
              <div className="space-y-2">
                <Label htmlFor="bonusName">Bonus Name *</Label>
                <Input
                  id="bonusName"
                  value={formData.bonusName}
                  onChange={(e) => setFormData((p) => ({ ...p, bonusName: e.target.value }))}
                  placeholder="Enter bonus name"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Enter bonus description"
                  rows={3}
                  required
                />
              </div>

              {/* Bonus Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Bonus Configuration</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Bonus Type */}
                  <div className="space-y-2">
                    <Label htmlFor="bonusType">Bonus Type *</Label>
                    <select
                      id="bonusType"
                      value={formData.bonusType}
                      onChange={(e) => setFormData((p) => ({ ...p, bonusType: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                      required
                    >
                      <option value="">Select bonus type</option>
                      <option value="Fixed">Fixed</option>
                      <option value="Percentage">Percentage</option>
                    </select>
                  </div>

                  {/* Fixed Bonus Value - Only show when Bonus Type is Fixed */}
                  {showFixedBonus && (
                    <div className="space-y-2">
                      <Label htmlFor="bonusFixed">Fixed Bonus Value *</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="bonusFixed"
                          type="text"
                          value={formData.bonusFixed}
                          onChange={(e) => setFormData((p) => ({ ...p, bonusFixed: e.target.value }))}
                          placeholder="0"
                          required={showFixedBonus}
                        />
                        <span className="text-sm text-gray-500">₹</span>
                      </div>
                    </div>
                  )}

                  {/* Bonus Based On - Only show when Bonus Type is Percentage */}
                  {showPercentageFields && (
                    <div className="space-y-2">
                      <Label htmlFor="bonusBasedOn">Bonus Based On *</Label>
                      <select
                        id="bonusBasedOn"
                        value={formData.bonusBasedOn}
                        onChange={(e) => setFormData((p) => ({ ...p, bonusBasedOn: e.target.value as "Basic" | "Gross" }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                        required={showPercentageFields}
                      >
                        <option value="Basic">Basic</option>
                        <option value="Gross">Gross</option>
                      </select>
                      <p className="text-xs text-gray-500">
                        Whether bonus is calculated on Basic salary or Gross salary
                      </p>
                    </div>
                  )}

                  {/* Percentage of Bonus - Only show when Bonus Type is Percentage */}
                  {showPercentageFields && (
                    <div className="space-y-2">
                      <Label htmlFor="percentageOfBonus">Percentage of Bonus *</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="percentageOfBonus"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={formData.percentageOfBonus}
                          onChange={(e) => setFormData((p) => ({ ...p, percentageOfBonus: parseFloat(e.target.value) || 0 }))}
                          placeholder="0"
                          required={showPercentageFields}
                        />
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Percentage of {formData.bonusBasedOn.toLowerCase()} salary for bonus
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingBonus ? "Update Bonus Rule" : "Add Bonus Rule"}
                </Button>
              </div>
            </form>
      </FormDrawer>

      {/* Show list only when form is closed */}
      {!isDialogOpen && (
      <>
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage bonus configurations and calculations</p>
        </div>
        {canManage && (
          <Button
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
            className="flex-shrink-0 text-sm px-3 py-2"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Bonus Rule
          </Button>
        )}
      </div>

      {/* Search & count */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search bonus setups..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredBonuses.length} bonuses
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:trophy" className="w-5 h-5" />
            Bonus Setup List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 w-full">
          <div className="overflow-x-auto w-full">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Branch Name</TableHead>
                  <TableHead className="w-[150px]">Bonus Name</TableHead>
                  <TableHead className="w-[200px]">Description</TableHead>
                  <TableHead className="w-[100px]">Based On</TableHead>
                  <TableHead className="w-[100px]">Percentage</TableHead>
                  <TableHead className="w-[100px]">Created</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBonuses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:trophy" className="w-12 h-12 text-gray-300" />
                        <p>No bonus setups found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBonuses.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="whitespace-nowrap">{b.branchName}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{b.bonusName}</TableCell>
                      <TableCell className="whitespace-nowrap max-w-[200px] truncate" title={b.description}>
                        {b.description}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={b.bonusBasedOn === "Basic" ? "default" : "secondary"}>{b.bonusBasedOn}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center">{b.percentageOfBonus}%</TableCell>
                      <TableCell className="whitespace-nowrap">{b.createdAt}</TableCell>
                      {canManage && (
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(b)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(b.id)}
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
      </>
      )}
    </div>
  );
}

/* ---------------- tiny debounce ---------------- */
function debounce<T extends (...args: any[]) => any>(fn: T, ms = 300) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}