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

const MIN_CHARS = 1;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function MonthlySalaryCycleManagement() {
  const [cycles, setCycles] = useState<MonthlySalaryCycle[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<MonthlySalaryCycle | null>(null);
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "MANAGER";
  const isEmployee = user?.role === "EMPLOYEE";

  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);

  // Fetch mapping for MANAGER
  useEffect(() => {
    if (user?.role !== "MANAGER") return;

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

  // ---- Load initial list ----
  useEffect(() => {
    if (user) loadSalaryCycles();
  }, [user]);

  const loadSalaryCycles = async () => {
    try {
      const res = await fetch(API.salaryCycle);
      const data: ApiSalaryCycle[] = await res.json();
      const all = data.map(mapApiToUi);

      // 🟢 SUPERADMIN → all
      if (user?.role === "SUPERADMIN") {
        setCycles(all);
        return;
      }

      // 🟡 MANAGER → filter using /users
      if (user?.role === "MANAGER") {
        const usersRes = await fetch("/backend/users");
        const users = await usersRes.json();
        const currentUser = users.find((u: any) => u.username === user.username);
        if (currentUser) {
          const filtered = all.filter(
            (c) =>
              c.companyID === currentUser.companyID &&
              c.branchesID === currentUser.branchesID
          );
          setCycles(filtered);
          return;
        }
      }

      // 🔵 EMPLOYEE → filter using /manage-emp/credentials/all
      const credsRes = await fetch("/backend/manage-emp/credentials/all");
      const creds = await credsRes.json();
      const emp = creds.find((c: any) => c.username === user?.username);
      if (emp) {
        const filtered = all.filter(
          (c) =>
            c.companyID === emp.companyID &&
            c.branchesID === emp.branchesID
        );
        setCycles(filtered);
      } else {
        setCycles([]);
      }
    } catch (e) {
      console.error("Failed to load salary cycles", e);
      toast.error("Failed to load data.");
      setCycles([]);
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
    setFormData({
      serviceProviderID: null,
      companyID: null,
      branchesID: null,
      spAutocomplete: "",
      coAutocomplete: "",
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
    const q = searchTerm.toLowerCase();
    return cycles.filter(cycle =>
      cycle.cycleName.toLowerCase().includes(q) ||
      cycle.serviceProvider.toLowerCase().includes(q) ||
      cycle.companyName.toLowerCase().includes(q) ||
      cycle.branchName.toLowerCase().includes(q)
    );
  }, [cycles, searchTerm]);

  // Generate day options for dropdown
  const dayOptions = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), []);

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage monthly salary cycle configurations</p>
        </div>
        {canManage && (
              <Button
                onClick={() => { resetForm(); setIsDialogOpen(true); }}
                className="bg-gray-900 hover:bg-gray-800 flex-shrink-0 text-sm px-3 py-2"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Salary Cycle
              </Button>
            )}
      </div>

      <FormDrawer open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }} title={editingCycle ? "Edit Monthly Salary Cycle" : "Add New Monthly Salary Cycle"} description={editingCycle ? "Update the monthly salary cycle information below." : "Fill in the details to add a new monthly salary cycle."}>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              {/* Service Provider (Autocomplete) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* SUPERADMIN — Service Provider */}
                {user?.role === "SUPERADMIN" && (
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

                {/* SUPERADMIN — Company */}
                {user?.role === "SUPERADMIN" && (
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
                {user?.role === "MANAGER" && currentUserMapping && (
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <Button type="submit" className="bg-gray-900 hover:bg-gray-800">
                  {editingCycle ? "Update Salary Cycle" : "Add Salary Cycle"}
                </Button>
              </div>
            </form>
      </FormDrawer>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search salary cycles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredCycles.length} cycles
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Salary Cycle Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:cash-multiple" className="w-5 h-5" />
            Monthly Salary Cycle List
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
                  <TableHead className="w-[150px]">Cycle Name</TableHead>
                  <TableHead className="w-[120px]">Start Day</TableHead>
                  <TableHead className="w-[100px]">Created</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCycles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:cash-multiple" className="w-12 h-12 text-gray-300" />
                        <p>No salary cycles found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCycles.map((cycle) => (
                    <TableRow key={cycle.id}>
                      <TableCell className="whitespace-nowrap">{cycle.serviceProvider}</TableCell>
                      <TableCell className="whitespace-nowrap">{cycle.companyName}</TableCell>
                      <TableCell className="whitespace-nowrap">{cycle.branchName}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{cycle.cycleName}</TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        <Badge variant="outline">Day {cycle.startDayOfMonth}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{cycle.createdAt}</TableCell>
                      {canManage && (
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(cycle)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(cycle.id)}
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
