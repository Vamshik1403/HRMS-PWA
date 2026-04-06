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
import { Plus, Search, Edit, Trash2, ArrowLeft, X, Save } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useRouter } from "next/navigation";
import { FormDrawer } from "../components/ui/form-drawer";
import { toast } from "sonner";

// ---------------------------
// Types aligned to backend
// ---------------------------
type ID = number;

interface DeviceRead {
  id: ID;
  status: "Active" | "Inactive";

  // Foreign keys
  serviceProviderID?: ID | null;
  companyID?: ID | null;
  branchesID?: ID | null;

  // Scalars
  deviceName: string;
  deviceType?: string;
  deviceMake: string;
  deviceModel: string;
  deviceSN: string;

  // Optional nested (if your API includes them)
  serviceProvider?: { id: ID; companyName?: string | null } | null;
  company?: { id: ID; companyName?: string | null } | null;
  branches?: { id: ID; branchName?: string | null } | null;

  createdAt?: string | null;

  // Fallback name fields (some APIs denormalize)
  serviceProviderName?: string | null;
  companyName?: string | null;
  branchName?: string | null;
}

interface ServiceProvider {
  id: ID;
  companyName: string;
}

interface Company {
  id: ID;
  companyName: string;
}

interface Branch {
  id: ID;
  branchName: string;
}

// ---------------------------
// Config & helpers
// ---------------------------

const API = {
  devices: "/backend/devices",
  serviceProviders: "/backend/service-provider",
  companies: "/backend/company",
  branches: "/backend/branches",
};

const MIN_CHARS = 1;
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

export function DeviceManagement() {
  const router = useRouter();
  // Data
  const [devices, setDevices] = useState<DeviceRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "MANAGER";
  
  // UI
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceRead | null>(null);
  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);

  // Suggestions state/refs
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

  // Form State
  const [formData, setFormData] = useState({
    status: "Active" as "Active" | "Inactive",

    serviceProviderID: null as ID | null,
    companyID: null as ID | null,
    branchesID: null as ID | null,

    spAutocomplete: "",
    coAutocomplete: "",
    brAutocomplete: "",

    deviceName: "",
    deviceType: "",
    deviceMake: "",
    deviceModel: "",
    deviceSN: "",
  });

  // ---------------------------
  // Load devices
  // ---------------------------
  const fetchDevices = async () => {
    try {
      setLoading(true);
      const all = await fetchJSONSafe<DeviceRead[]>(API.devices);

      // 🟢 SUPERADMIN → All devices
      if (user?.role === "SUPERADMIN") {
        setDevices(all);
        return;
      }

      // 🟡 MANAGER & EMPLOYEE → Get user mapping first
      const usersRes = await fetch("/backend/users");
      const users = await usersRes.json();
      const currentUser = users.find((u: any) => u.username === user?.username);

      if (currentUser) {
        // Store the user mapping for form auto-fill
        setCurrentUserMapping(currentUser);

        if (user?.role === "MANAGER") {
          const filtered = all.filter(
            (d: any) =>
              d.companyID === currentUser.companyID &&
              d.branchesID === currentUser.branchesID
          );
          setDevices(filtered);
        } else if (user?.role === "EMPLOYEE") {
          const filtered = all.filter(
            (d: any) =>
              d.companyID === currentUser.companyID &&
              d.branchesID === currentUser.branchesID
          );
          setDevices(filtered);
        }
      } else {
        console.warn("User not found in /users mapping.");
        setDevices([]);
      }
    } catch (e: any) {
      console.error("Failed to load devices:", e);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchDevices();
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

        // 🟡 If MANAGER, filter by companyID
        let filtered = all || [];
        if (user?.role === "MANAGER" && currentUserMapping?.companyID) {
          filtered = filtered.filter(
            (b: any) => b.companyID === currentUserMapping.companyID
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
      status: "Active" as "Active" | "Inactive",
      serviceProviderID: null as ID | null,
      companyID: null as ID | null,
      branchesID: null as ID | null,
      spAutocomplete: "",
      coAutocomplete: "",
      brAutocomplete: "",
      deviceName: "",
      deviceType: "",
      deviceMake: "",
      deviceModel: "",
      deviceSN: "",
    };

    // Auto-set Service Provider, Company, and Branch for MANAGER (no UI display)
    if (user?.role === "MANAGER" && currentUserMapping) {
      baseFormData.serviceProviderID = currentUserMapping.serviceProviderID;
      baseFormData.companyID = currentUserMapping.companyID;
      baseFormData.branchesID = currentUserMapping.branchesID;
    }

    setFormData(baseFormData);
    setEditingDevice(null);
    setSpList([]);
    setCoList([]);
    setBrList([]);
    setError(null);
  };

  // ---------------------------
  // CRUD submit
  // ---------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // For MANAGER, ensure serviceProviderID, companyID, and branchesID are set from user mapping
    let finalServiceProviderID = formData.serviceProviderID;
    let finalCompanyID = formData.companyID;
    let finalBranchesID = formData.branchesID;

    if (user?.role === "MANAGER" && currentUserMapping) {
      finalServiceProviderID = currentUserMapping.serviceProviderID;
      finalCompanyID = currentUserMapping.companyID;
      finalBranchesID = currentUserMapping.branchesID;
    }

    const payload: any = {
      status: formData.status,
      deviceName: formData.deviceName || undefined,
      deviceType: formData.deviceType || undefined,
      deviceMake: formData.deviceMake || undefined,
      deviceModel: formData.deviceModel || undefined,
      deviceSN: formData.deviceSN || undefined,

      serviceProviderID: finalServiceProviderID ?? undefined,
      companyID: finalCompanyID ?? undefined,
      branchesID: finalBranchesID ?? undefined,
    };

    try {
      if (editingDevice) {
        const res = await fetch(`${API.devices}/${editingDevice.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch(API.devices, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      }

      await fetchDevices();
      resetForm();
      setIsAddingNew(false);
      setEditingDevice(null);
      toast.success("Device saved successfully");
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (d: DeviceRead) => {
    setEditingDevice(d);
    setIsAddingNew(true);

    // For MANAGER, use their mapped IDs instead of the device's IDs
    let finalServiceProviderID = d.serviceProviderID ?? d.serviceProvider?.id ?? null;
    let finalCompanyID = d.companyID ?? d.company?.id ?? null;
    let finalBranchesID = d.branchesID ?? d.branches?.id ?? null;
    let spName = "";
    let coName = "";
    let brName = "";

    if (user?.role === "MANAGER" && currentUserMapping) {
      // Use MANAGER's mapped IDs
      finalServiceProviderID = currentUserMapping.serviceProviderID;
      finalCompanyID = currentUserMapping.companyID;
      finalBranchesID = currentUserMapping.branchesID;
      spName = currentUserMapping.serviceProvider?.companyName ?? "";
      coName = currentUserMapping.company?.companyName ?? "";
      brName = currentUserMapping.branches?.branchName ?? "";
    } else {
      // For SUPERADMIN, use the device's original data
      spName = d.serviceProvider?.companyName ?? d.serviceProviderName ?? "";
      coName = d.company?.companyName ?? d.companyName ?? "";
      brName = d.branches?.branchName ?? d.branchName ?? "";
    }

    setFormData({
      status: d.status,
      serviceProviderID: finalServiceProviderID,
      companyID: finalCompanyID,
      branchesID: finalBranchesID,
      spAutocomplete: spName,
      coAutocomplete: coName,
      brAutocomplete: brName,
      deviceName: d.deviceName ?? "",
      deviceType: d.deviceType ?? "",
      deviceMake: d.deviceMake ?? "",
      deviceModel: d.deviceModel ?? "",
      deviceSN: d.deviceSN ?? "",
    });
  };

  const handleDelete = async (id: ID) => {
    if (!confirm("Delete this device?")) return;
    try {
      const res = await fetch(`${API.devices}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await fetchDevices();
      toast.success("Device deleted successfully");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  const handleCancel = () => {
    resetForm();
    setIsAddingNew(false);
    setEditingDevice(null);
  };



  // ---------------------------
  // Search
  // ---------------------------
  const filteredDevices = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return devices;
    const nameOf = (d: DeviceRead) =>
      d.serviceProvider?.companyName ??
      d.serviceProviderName ??
      "";
    const coNameOf = (d: DeviceRead) => d.company?.companyName ?? d.companyName ?? "";
    const brNameOf = (d: DeviceRead) => d.branches?.branchName ?? d.branchName ?? "";
    return devices.filter((d) =>
      [
        d.deviceName,
        d.deviceType,
        d.deviceMake,
        d.deviceModel,
        d.deviceSN,
        nameOf(d),
        coNameOf(d),
        brNameOf(d),
      ]
        .filter(Boolean)
        .map((x) => (x ?? "").toLowerCase())
        .some((f) => f.includes(t))
    );
  }, [devices, searchTerm]);

  // ---------------------------
  // Helpers for rendering names in table
  // ---------------------------
  const spName = (d: DeviceRead) =>
    d.serviceProvider?.companyName ?? d.serviceProviderName ?? "—";
  const coName = (d: DeviceRead) =>
    d.company?.companyName ?? d.companyName ?? "—";
  const brName = (d: DeviceRead) =>
    d.branches?.branchName ?? d.branchName ?? "—";

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">

      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage your devices</p>
        </div>

        <div className="flex items-center gap-3">
          {!isAddingNew && canManage && (
            <Button
              onClick={() => { resetForm(); setIsAddingNew(true); }}
              className="bg-gray-900 hover:bg-gray-800 flex-shrink-0 text-sm px-3 py-2"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Device
            </Button>
          )}
          {isAddingNew && (
            <Button
              variant="outline"
              onClick={handleCancel}
              className="text-sm"
            >
              <X className="w-4 h-4 mr-1" /> BACK
            </Button>
          )}
        </div>
      </div>

      {/* Add/Edit Form - Drawer */}
      <FormDrawer
        open={isAddingNew}
        onOpenChange={(v) => { if (!v) handleCancel(); }}
        title={editingDevice ? "Edit Device" : "Add New Device"}
      >
        <div>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Status */}
              <div className="space-y-2">
                <Label>Status *</Label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      status: e.target.value as "Active" | "Inactive",
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* Service Provider Autocomplete - Completely hidden for MANAGER */}
              {user?.role !== "MANAGER" && (
                <div ref={spRef} className="space-y-2 relative">
                  <Label>Service Provider *</Label>
                  <Input
                    value={formData.spAutocomplete}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((p) => ({ ...p, spAutocomplete: val, serviceProviderID: null }));
                      runFetchServiceProviders(val);
                    }}
                    onFocus={(e) => {
                      const val = e.target.value;
                      if (val.length >= MIN_CHARS) runFetchServiceProviders(val);
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

              {/* Company Autocomplete - Completely hidden for MANAGER */}
              {user?.role !== "MANAGER" && (
                <div ref={coRef} className="space-y-2 relative">
                  <Label>Company *</Label>
                  <Input
                    value={formData.coAutocomplete}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((p) => ({ ...p, coAutocomplete: val, companyID: null }));
                      runFetchCompanies(val);
                    }}
                    onFocus={(e) => {
                      const val = e.target.value;
                      if (val.length >= MIN_CHARS) runFetchCompanies(val);
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
                  onFocus={(e) => {
                    const val = e.target.value;
                    if (val.length >= MIN_CHARS) runFetchBranches(val);
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

              {/* Device fields */}
              <div className="space-y-2">
                <Label>Device Name *</Label>
                <Input
                  value={formData.deviceName}
                  onChange={(e) => setFormData((p) => ({ ...p, deviceName: e.target.value }))}
                  placeholder="Enter device name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Device Type</Label>
               <select
                  value={formData.deviceType}
                  onChange={(e) => setFormData((p) => ({ ...p, deviceType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select device type</option>
                  <option value="AT">Attendance</option>
                  <option value="TR">Token Registration</option>
                  <option value="TV">Token Verifier</option>
                
                </select>
              </div>

              <div className="space-y-2">
                <Label>Device Make *</Label>
                <Input
                  value={formData.deviceMake}
                  onChange={(e) => setFormData((p) => ({ ...p, deviceMake: e.target.value }))}
                  placeholder="Enter device make"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Device Model *</Label>
                <Input
                  value={formData.deviceModel}
                  onChange={(e) => setFormData((p) => ({ ...p, deviceModel: e.target.value }))}
                  placeholder="Enter device model"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Device SN *</Label>
                <Input
                  value={formData.deviceSN}
                  onChange={(e) => setFormData((p) => ({ ...p, deviceSN: e.target.value }))}
                  placeholder="Enter device serial number"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-gray-900 hover:bg-gray-800" disabled={saving}>
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? "Saving..." : editingDevice ? "Update Device" : "Add Device"}
                </Button>
              </div>
            </form>
        </div>
      </FormDrawer>

      {/* Search and Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4 w-full">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search devices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
              <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
                {filteredDevices.length} devices
              </Badge>
            </div>
          </CardContent>
        </Card>

      {/* Device Table */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon icon="mdi:devices" className="w-5 h-5" />
              Device List
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
                    <TableHead className="w-[120px]">Device Name</TableHead>
                    <TableHead className="w-[100px]">Device Make</TableHead>
                    <TableHead className="w-[100px]">Device Model</TableHead>
                    <TableHead className="w-[120px]">Device SN</TableHead>
                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredDevices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <Icon icon="mdi:devices" className="w-12 h-12 text-gray-300" />
                          <p>No devices found</p>
                          <p className="text-sm">Try adjusting your search criteria</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDevices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell className="whitespace-nowrap">{spName(device)}</TableCell>
                        <TableCell className="whitespace-nowrap">{coName(device)}</TableCell>
                        <TableCell className="whitespace-nowrap">{brName(device)}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{device.deviceName}</TableCell>
                        <TableCell className="whitespace-nowrap">{device.deviceMake}</TableCell>
                        <TableCell className="whitespace-nowrap">{device.deviceModel}</TableCell>
                        <TableCell className="whitespace-nowrap">{device.deviceSN}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {/* ✏️ SUPERADMIN & MANAGER can edit */}
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(device)}
                                className="h-7 w-7 p-0"
                                title="Edit"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                            )}

                            {/* 🗑️ SUPERADMIN & MANAGER can delete */}
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(device.id)}
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
    </div>
  );
}