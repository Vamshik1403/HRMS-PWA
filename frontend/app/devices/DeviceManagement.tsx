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
import { Plus, Search, Edit, Trash2, ArrowLeft, X, Save, RotateCcw, Filter, ArrowDownUp, ArrowUpDown, Fingerprint } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useRouter } from "next/navigation";
import { FormDrawer } from "../components/ui/form-drawer";
import { NoticeBanner } from "../components/ui/notice-banner";
import { PageHeader } from "../components/app/page-header";
import { FilterBar, FilterSelect } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import type { DataTableColumn } from "../components/app/data-table";
import { EntityRowActions } from "../components/app/entity-row-actions";
import { useClientTable, sortRows } from "../hooks/use-client-table";
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";
import {
  canDesktopManagerManage,
  filterCompanyScopedRecords,
  resolveScopeUserMapping,
} from "../utils/scopeContext";
import { fetchGPSOnUserGesture } from "../utils/empGeolocation";

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
  authTypes?: string[];
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
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
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

export function DeviceManagement() {
  const router = useRouter();
  // Data
  const [devices, setDevices] = useState<DeviceRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN" || user?.role === "SERVICE_PROVIDER" || canDesktopManagerManage(user);
  const canAdd = user?.role === "SUPERADMIN" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN" || canDesktopManagerManage(user);
const canDelete =
  user?.role === "SUPERADMIN" ||
  user?.role === "COMPANY_ADMIN" ||
  user?.role === "ADMIN" ||
  canDesktopManagerManage(user);
  // UI
  const table = useClientTable("deviceName");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [branchFilterList, setBranchFilterList] = useState<Branch[]>([]);
  const [branchFilterLoading, setBranchFilterLoading] = useState(false);
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
    attendanceAuthType: "" as string,
    tokenRegAuthType: "" as string,
    deviceMake: "",
    deviceModel: "",
    deviceSN: "",
    latitude: "",
    longitude: "",
    address: "",
  });

  const [locationLoading, setLocationLoading] = useState(false);

  // ---------------------------
  // Load devices
  // ---------------------------
  const fetchDevices = async () => {
    try {
      setLoading(true);
      const all = await fetchJSONSafe<DeviceRead[]>(API.devices);
  const mapping = await resolveScopeUserMapping(user);
if (mapping) setCurrentUserMapping(mapping);

const ctx = getSidebarContext();

const activeCompanyID =
  ctx?.companyID ??
  mapping?.companyID ??
  user?.companyID ??
  null;

const filteredDevices = (Array.isArray(all) ? all : []).filter((d: any) => {
  if (!activeCompanyID) return true;
  return Number(d.companyID) === Number(activeCompanyID);
});

setDevices(filteredDevices);

    } catch (e: any) {
      console.error("Failed to load devices:", e);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDevices();
      fetchBranchFilterList();
    }
  }, [user]);

  const fetchBranchFilterList = async () => {
    try {
      setBranchFilterLoading(true);

      const all = await fetchJSONSafe<any[]>(API.branches);
      let filtered = Array.isArray(all) ? all : [];

      const mapping = await resolveScopeUserMapping(user);
      const ctx = getSidebarContext();

      if (user?.role === "SUPERADMIN") {
        if (ctx?.companyID) {
          filtered = filtered.filter((b) => Number(b.companyID) === Number(ctx.companyID));
        }
      } else if (user?.role === "SERVICE_PROVIDER") {
        const companyID = ctx?.companyID ?? mapping?.companyID;
        if (companyID) {
          filtered = filtered.filter((b) => Number(b.companyID) === Number(companyID));
        } else if (mapping?.serviceProviderID) {
          filtered = filtered.filter(
            (b) => Number(b.serviceProviderID) === Number(mapping.serviceProviderID)
          );
        }
      } else if (user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN") {
        const companyID = ctx?.companyID ?? mapping?.companyID ?? user?.companyID;
        if (companyID) {
          filtered = filtered.filter((b) => Number(b.companyID) === Number(companyID));
        }
      } else if (user?.role === "BRANCH_ADMIN") {
        const branchesID = mapping?.branchesID ?? user?.branchesID;
        if (branchesID) {
          filtered = filtered.filter((b) => Number(b.id) === Number(branchesID));
          setBranchFilter(String(branchesID));
        }
      }

      setBranchFilterList(filtered);
    } catch (e) {
      console.error("Failed to load branch filter list:", e);
      setBranchFilterList([]);
    } finally {
      setBranchFilterLoading(false);
    }
  };


useEffect(() => {
const handler = () => {
  setBranchFilter(user?.role === "BRANCH_ADMIN" ? String(user?.branchesID ?? "ALL") : "ALL");
  setBrList([]);
  setFormData((p) => ({
    ...p,
    branchesID: null,
    brAutocomplete: "",
  }));

  if (user) {
    fetchDevices();
    fetchBranchFilterList();
  }
  };

  const sidebarPageClickHandler = (e: any) => {
    if (e.detail?.path === "/devices") {
      closeDevicePagePanels();

      if (user) {
        fetchDevices();
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
      status: "Active" as "Active" | "Inactive",
      serviceProviderID: null as ID | null,
      companyID: null as ID | null,
      branchesID: null as ID | null,
      spAutocomplete: "",
      coAutocomplete: "",
      brAutocomplete: "",
      deviceName: "",
      deviceType: "",
      attendanceAuthType: "" as string,
      tokenRegAuthType: "" as string,
      deviceMake: "",
      deviceModel: "",
      deviceSN: "",
      latitude: "",
      longitude: "",
      address: "",
    };

    // Auto-set Service Provider, Company, and Branch for MANAGER (no UI display)
    const ctx = getSidebarContext();

// Active sidebar company always gets first priority
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
    setEditingDevice(null);
    setSpList([]);
    setCoList([]);
    setBrList([]);
    setError(null);
  };

  const parseCoord = (v: string) => {
    const n = parseFloat(v.trim());
    return Number.isFinite(n) ? n : null;
  };

  const resolveDeviceAddress = async () => {
    const lat = parseCoord(formData.latitude);
    const lng = parseCoord(formData.longitude);
    if (lat == null || lng == null) {
      toast.error("Enter valid latitude and longitude first");
      return;
    }
    setLocationLoading(true);
    try {
      const res = await fetch(
        `${API.devices}/resolve-address?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lng))}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setFormData((p) => ({ ...p, address: data.address || "" }));
      if (!data.address) toast.message("Could not resolve an address for these coordinates");
      else toast.success("Address resolved");
    } catch (e: any) {
      toast.error(e?.message || "Address lookup failed");
    } finally {
      setLocationLoading(false);
    }
  };

  const useCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const loc = await fetchGPSOnUserGesture();
      setFormData((p) => ({
        ...p,
        latitude: String(loc.latitude),
        longitude: String(loc.longitude),
      }));
      const res = await fetch(
        `${API.devices}/resolve-address?latitude=${encodeURIComponent(String(loc.latitude))}&longitude=${encodeURIComponent(String(loc.longitude))}`,
      );
      if (res.ok) {
        const data = await res.json();
        setFormData((p) => ({
          ...p,
          latitude: String(loc.latitude),
          longitude: String(loc.longitude),
          address: data.address || "",
        }));
      }
      toast.success("Location captured");
    } catch (e: any) {
      toast.error(e?.message || "Could not get location");
    } finally {
      setLocationLoading(false);
    }
  };

  // ---------------------------
  // CRUD submit
  // ---------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const validationErrors: string[] = [];
    if (!formData.deviceName?.trim()) validationErrors.push("Device Name is required");
    if (!formData.deviceSN?.trim()) validationErrors.push("Device Serial Number is required");
    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg));
      return;
    }

    setSaving(true);
    setError(null);

    // For MANAGER, ensure serviceProviderID, companyID, and branchesID are set from user mapping
   const ctx = getSidebarContext();

let finalServiceProviderID =
  ctx?.serviceProviderID ??
  formData.serviceProviderID ??
  currentUserMapping?.serviceProviderID ??
  null;

let finalCompanyID =
  ctx?.companyID ??
  formData.companyID ??
  currentUserMapping?.companyID ??
  user?.companyID ??
  null;

let finalBranchesID = formData.branchesID;

if (user?.role === "BRANCH_ADMIN") {
  finalBranchesID =
    formData.branchesID ??
    currentUserMapping?.branchesID ??
    user?.branchesID ??
    null;
}

    const payload: any = {
      status: formData.status,
      deviceName: formData.deviceName || undefined,
      deviceType: formData.deviceType || "AT",
      deviceMake: formData.deviceMake || undefined,
      deviceModel: formData.deviceModel || undefined,
      deviceSN: formData.deviceSN || undefined,

      serviceProviderID: finalServiceProviderID ?? undefined,
      companyID: finalCompanyID ?? undefined,
      branchesID: finalBranchesID ?? undefined,
    };
    const lat = parseCoord(formData.latitude);
    const lng = parseCoord(formData.longitude);
    if (lat != null && lng != null) {
      payload.latitude = lat;
      payload.longitude = lng;
    } else if (!formData.latitude.trim() && !formData.longitude.trim()) {
      payload.latitude = null;
      payload.longitude = null;
    } else if (formData.latitude.trim() || formData.longitude.trim()) {
      toast.error("Enter both latitude and longitude, or leave both empty");
      setSaving(false);
      return;
    }
    if (formData.attendanceAuthType) {
      payload.authTypes = [`ATT:${formData.attendanceAuthType}`];
    }

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

    if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
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

    // Parse authTypes back into separate fields
    let attendanceAuthType = "";
    let tokenRegAuthType = "";
    if (d.authTypes && d.authTypes.length > 0) {
      for (const at of d.authTypes) {
        if (at.startsWith("ATT:")) attendanceAuthType = at.replace("ATT:", "");
        else if (at.startsWith("TR:")) tokenRegAuthType = at.replace("TR:", "");
      }
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
      attendanceAuthType,
      tokenRegAuthType,
      deviceMake: d.deviceMake ?? "",
      deviceModel: d.deviceModel ?? "",
      deviceSN: d.deviceSN ?? "",
      latitude: d.latitude != null ? String(d.latitude) : "",
      longitude: d.longitude != null ? String(d.longitude) : "",
      address: d.address ?? "",
    });
  };

 const handleDelete = async (device: DeviceRead) => {
  const deviceName = device.deviceName || "this device";

  const confirmed = window.confirm(
    `Are you sure you want to delete "${deviceName}"?\n\nThis action cannot be undone.`
  );

  if (!confirmed) return;

  try {
    const res = await fetch(`${API.devices}/${device.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || "Delete failed");
    }

    await fetchDevices();
    toast.success("Device deleted successfully");
  } catch (e: any) {
    toast.error(e?.message || "Delete failed");
  }
};

const closeDevicePagePanels = () => {
  resetForm();

  setIsAddingNew(false);
  setEditingDevice(null);

  setSpList([]);
  setCoList([]);
  setBrList([]);
};

const handleCancel = () => {
  closeDevicePagePanels();
};


  const filteredDevices = useMemo(() => {
    const t = table.search.trim().toLowerCase();

    let list = devices.filter((d) => {
      const deviceBranchID = String(d.branchesID ?? d.branches?.id ?? "");

      const matchesBranch =
        branchFilter === "ALL" || branchFilter === deviceBranchID;

      const matchesStatus =
        statusFilter === "ALL" || (d.status || "").toUpperCase() === statusFilter;

      const matchesSearch =
        !t ||
        [
          d.deviceName,
          d.deviceType,
          d.deviceMake,
          d.deviceModel,
          d.deviceSN,
          d.status,
          d.company?.companyName,
          d.branches?.branchName,
          d.branchName,
        ]
          .filter(Boolean)
          .some((x) => String(x).toLowerCase().includes(t));

      return matchesBranch && matchesStatus && matchesSearch;
    });

    return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
      const d = row as DeviceRead;
      if (key === "deviceName") return d.deviceName || "";
      if (key === "deviceType") return d.deviceType || "";
      if (key === "deviceMake") return d.deviceMake || "";
      if (key === "deviceModel") return d.deviceModel || "";
      if (key === "deviceSN") return d.deviceSN || "";
      if (key === "branchName") return d.branches?.branchName || d.branchName || "";
      if (key === "status") return d.status || "";
      return "";
    });
  }, [devices, table.search, table.sortBy, table.sortDir, branchFilter, statusFilter]);

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

  const statusFilterOptions = useMemo(() => {
    const statuses = new Set(
      devices.map((d) => (d.status || "").toUpperCase()).filter(Boolean),
    );
    return [
      { value: "ALL", label: "All statuses" },
      ...Array.from(statuses).map((s) => ({ value: s, label: s })),
    ];
  }, [devices]);

  const deviceTypeLabel = (type?: string | null) => {
    if (!type) return "—";
    const typeMap: Record<string, string> = {
      AT: "Attendance",
      TR: "Token Reg",
      TV: "Token Ver",
      "AT+TR": "Att + Token Reg",
    };
    return typeMap[type] || type;
  };

  const deviceColumns = useMemo((): DataTableColumn<DeviceRead>[] => [
    { key: "deviceName", header: "Name", sortable: true, colSpan: 2, cell: (d) => <span className="font-medium">{d.deviceName}</span> },
    {
      key: "deviceType",
      header: "Type",
      sortable: true,
      colSpan: 2,
      cell: (d) => d.deviceType ? (
        <Badge variant="secondary" className="text-xs">{deviceTypeLabel(d.deviceType)}</Badge>
      ) : "—",
    },
    { key: "deviceMake", header: "Make", sortable: true, colSpan: 1, cell: (d) => d.deviceMake || "—" },
    { key: "deviceModel", header: "Model", sortable: true, colSpan: 2, cell: (d) => d.deviceModel || "—" },
    { key: "deviceSN", header: "Serial", sortable: true, colSpan: 2, cell: (d) => d.deviceSN || "—" },
    { key: "branchName", header: "Branch", sortable: true, colSpan: 2, cell: (d) => brName(d) },
    {
      key: "actions",
      header: "Actions",
      colSpan: 1,
      align: "right",
      cell: (d) => (
        <EntityRowActions
          onEdit={canManage ? () => handleEdit(d) : undefined}
onDelete={canDelete ? () => handleDelete(d) : undefined}
        />
      ),
    },
  ], [canManage, canDelete]);

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
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">

      <PageHeader
        icon={Fingerprint}
        title="Attendance Devices"
        description="Biometric, web, mobile, and geo sources used to capture attendance events."
        actions={
          !isAddingNew && canAdd ? (
            <Button onClick={() => { resetForm(); setIsAddingNew(true); }}>
              <Plus className="w-4 h-4 mr-1" />
              Add Device
            </Button>
          ) : null
        }
      />

      {/* Add/Edit Form - Drawer */}
      <FormDrawer
        open={isAddingNew}
        onOpenChange={(v) => { if (!v) handleCancel(); }}
        title={editingDevice ? "Edit Device" : "Add New Device"}
      >
        <div>
          {error && (
            <NoticeBanner variant="error" compact className="mb-4">
              {error}
            </NoticeBanner>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                required
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

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
              <Label>Device Type</Label>
              <select
                value={formData.deviceType || "AT"}
                onChange={(e) => {
                  setFormData((p) => ({
                    ...p,
                    deviceType: "AT",
                    attendanceAuthType: "",
                    tokenRegAuthType: "",
                  }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
              >
                <option value="AT">Attendance</option>
              </select>
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

            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
              <div>
                <Label className="text-sm font-semibold text-gray-800">Device location</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Shown on the dashboard for employees who punch in through this device.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={locationLoading}
                  onClick={useCurrentLocation}
                >
                  Use current location
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={locationLoading}
                  onClick={resolveDeviceAddress}
                >
                  {locationLoading ? "Looking up…" : "Look up address"}
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData((p) => ({ ...p, latitude: e.target.value }))}
                    placeholder="e.g. 16.9944"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData((p) => ({ ...p, longitude: e.target.value }))}
                    placeholder="e.g. 73.3007"
                  />
                </div>
              </div>
              {formData.address ? (
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Resolved address</Label>
                  <p className="text-sm text-gray-800 bg-white border border-gray-200 rounded-md px-3 py-2">
                    {formData.address}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" className="" disabled={saving}>
                <Save className="w-4 h-4 mr-1" />
                {saving ? "Saving..." : editingDevice ? "Update Device" : "Add Device"}
              </Button>
            </div>
          </form>
        </div>
      </FormDrawer>

      {!isAddingNew && (<>
        <FilterBar
          search={{
            value: table.search,
            onChange: table.setSearch,
            placeholder: "Search code, name, serial, IP…",
          }}
          filters={
            <>
              <FilterSelect
                id="devices-branch"
                value={branchFilter}
                onChange={setBranchFilter}
                options={branchFilterOptions}
                width="w-56"
                ariaLabel="Filter by branch"
              />
              <FilterSelect
                id="devices-status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusFilterOptions}
                width="w-44"
                ariaLabel="Filter by status"
              />
            </>
          }
        />

        <EntityListShell
          title="All devices"
          columns={deviceColumns}
          rows={filteredDevices}
          rowKey={(d) => String(d.id)}
          isLoading={loading}
          sortBy={table.sortBy}
          sortDir={table.sortDir}
          onSort={table.setSort}
          emptyIcon={Fingerprint}
          emptyTitle="No devices yet"
          emptyDescription="Add your first attendance device to start capturing punches."
          emptyAction={
            canAdd ? (
              <Button onClick={() => { resetForm(); setIsAddingNew(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Device
              </Button>
            ) : undefined
          }
        />
      </>)}
    </div>
  );
}