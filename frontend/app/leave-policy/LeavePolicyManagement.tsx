"use client"

import { useState, useEffect } from "react"
import { TableBodySkeleton } from "../components/ui/TableBodySkeleton"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { FormDrawer } from "../components/ui/form-drawer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Icon } from "@iconify/react"
import { Plus, Search, Edit, Trash2, ArrowLeft, Filter, RotateCcw, X } from "lucide-react"
import { SearchSuggestInput } from "../components/SearchSuggestInput"
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";
import {
  canDesktopManagerManage,
  filterCompanyScopedRecords,
  resolveScopeUserMapping,
} from "../utils/scopeContext";

interface Holiday {
  id: string
  name: string
  date: string
  type: string
}

interface SelectedItem {
  display: string
  value: number
  item: any
}

interface LeavePolicy {
  id: number
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  serviceProvider?: string
  companyName?: string
  branchName?: string
  leavePolicyName?: string
  sickLeaveCount?: string
  casualLeaveCount?: string
  maternityLeaveCount?: string
  paternityLeaveCount?: string
  earnLeaveWorkingMonths?: string
  earnLeaveCount?: number
  isPrivilegedLeaveApplicable?: boolean
  privilegedLeaveRatio?: string
  weekOffConsideredInPL?: boolean
  holidayConsideredInPL?: boolean
  paidLeaveConsideredInPL?: boolean
  plCarryForwardLimit?: number
  lapseEncashmentDate?: string
  applicableHolidays: Holiday[]
  createdAt?: string
}

// Holidays list fetched from Manage Holiday API (only holidayName is used)
const BACKEND_URL = "/backend"

const PL_EXPIRY_STORAGE_YEAR = 2000
const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
]

function plExpiryFromParts(month: number, day: number): string | null {
  if (!month || !day) return null
  return `${PL_EXPIRY_STORAGE_YEAR}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function plExpiryToParts(iso?: string | null): { month: number; day: number } {
  if (!iso) return { month: 0, day: 0 }
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return { month: 0, day: 0 }
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

export function LeavePolicyManagement() {
  const [policies, setPolicies] = useState<LeavePolicy[]>([])
  const [listLoading, setListLoading] = useState(true)
const [searchTerm, setSearchTerm] = useState("")

const [selectedFilterBranchIds, setSelectedFilterBranchIds] = useState<string[]>([])
const [showBranchFilterModal, setShowBranchFilterModal] = useState(false)
const [branchFilterList, setBranchFilterList] = useState<any[]>([])
const [branchFilterLoading, setBranchFilterLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicy | null>(null)
  const [formData, setFormData] = useState({
    serviceProviderID: 0,
    companyID: 0,
    branchesID: 0,
    serviceProvider: "",
    companyName: "",
    branchName: "",
    leavePolicyName: "",
    sickLeaveCount: 0,
    casualLeaveCount: 0,
    maternityLeaveCount: 182,
    paternityLeaveCount: 15,
    earnLeaveWorkingMonths: 0,
    earnLeaveCount: 0,
    isPrivilegedLeaveApplicable: false,
    privilegedLeaveRatio: "20:1",
    weekOffConsideredInPL: false,
    holidayConsideredInPL: false,
    paidLeaveConsideredInPL: false,
    plCarryForwardLimit: 0,
    lapseEncashmentDate: "",
    plExpiryMonth: 0,
    plExpiryDay: 0,
    applicableHolidays: [] as Holiday[]
  })
  const [availableHolidays, setAvailableHolidays] = useState<Holiday[]>([])
  const user = useCurrentUser();
  const canManage =
    user?.role === "SUPERADMIN" ||
    user?.role === "SERVICE_PROVIDER" ||
    user?.role === "COMPANY_ADMIN" ||
    user?.role === "ADMIN" ||
    user?.role === "BRANCH_ADMIN";
const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);


const sidebarCtx = typeof window !== "undefined" ? getSidebarContext() : null;

const resolvedServiceProviderID =
  user?.role === "SERVICE_PROVIDER"
    ? currentUserMapping?.serviceProviderID
    : user?.role === "SUPERADMIN"
      ? sidebarCtx?.serviceProviderID || formData.serviceProviderID
      : currentUserMapping?.serviceProviderID || formData.serviceProviderID;

const resolvedCompanyID =
  user?.role === "SERVICE_PROVIDER"
    ? currentUserMapping?.companyID
    : user?.role === "SUPERADMIN"
      ? sidebarCtx?.companyID || formData.companyID
      : currentUserMapping?.companyID || formData.companyID;



// Load user mapping for roles that scope company/branch
useEffect(() => {
  if (!user) return;
  if (user.role === "BRANCH_ADMIN") {
    setCurrentUserMapping(user);
    return;
  }
  if (
    user.role === "SERVICE_PROVIDER" ||
    user.role === "COMPANY_ADMIN" ||
    user.role === "ADMIN"
  ) {
    (async () => {
      const res = await fetch(`${BACKEND_URL}/users`);
      const users = await res.json();
      const me = users.find((u: any) => u.username === user.username);
      setCurrentUserMapping(me || null);
    })();
  }
}, [user]);

// Auto-fill company/branch from mapping
useEffect(() => {
  if (!currentUserMapping) return;
  if (user?.role === "SERVICE_PROVIDER") {
    setFormData((p) => ({
      ...p,
      serviceProviderID: currentUserMapping.serviceProviderID,
      companyID: currentUserMapping.companyID,
      branchesID: currentUserMapping.branchesID ?? p.branchesID,
    }));
  } else if (user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN") {
    setFormData((p) => ({
      ...p,
      serviceProviderID: currentUserMapping.serviceProviderID ?? p.serviceProviderID,
      companyID: currentUserMapping.companyID ?? p.companyID,
      companyName: currentUserMapping.companyName ?? p.companyName,
    }));
  } else if (user?.role === "BRANCH_ADMIN") {
    setFormData((p) => ({
      ...p,
      serviceProviderID: currentUserMapping.serviceProviderID ?? null,
      companyID: currentUserMapping.companyID ?? null,
      branchesID: currentUserMapping.branchesID ?? null,
    }));
  }
}, [user, currentUserMapping]);

// Resolve branch display name when branchesID is set
useEffect(() => {
  if (!formData.branchesID || formData.branchName) return;
  (async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/branches`, { cache: "no-store" });
      const list = await res.json();
      const b = (Array.isArray(list) ? list : []).find(
        (x: { id: number }) => Number(x.id) === Number(formData.branchesID),
      );
      if (b?.branchName) {
        setFormData((p) => ({ ...p, branchName: b.branchName }));
      }
    } catch {
      /* ignore */
    }
  })();
}, [user, formData.branchesID, formData.branchName]);

// Load available holidays with RBAC filtering
const loadAvailableHolidays = async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/manage-holiday`);
    const raw = await res.json();

    let list = Array.isArray(raw) ? raw : [];

    // ✅ SUPERADMIN: filter by selected company + branch (only if selected)
    if (user?.role === "SUPERADMIN") {
      if (formData.companyID && formData.branchesID) {
        list = list.filter(
          (h: any) =>
            h.companyID === formData.companyID &&
            h.branchesID === formData.branchesID
        );
      } else {
        // if no selection, show nothing (or show all if you want)
        list = [];
      }
    }

    // ✅ MANAGER: filter by /users mapping (already your logic)
    else if (user?.role === "SERVICE_PROVIDER") {
      const usersRes = await fetch(`${BACKEND_URL}/users`);
      const users = await usersRes.json();
      const me = users.find((u: any) => u.username === user.username);

      if (me) {
        list = list.filter(
          (h: any) => h.companyID === me.companyID && h.branchesID === me.branchesID
        );
      } else {
        list = [];
      }
    }

    // ✅ EMPLOYEE: filter by credentials mapping (already your logic)
    else {
      const credsRes = await fetch(`${BACKEND_URL}/manage-emp/credentials/all`);
      const creds = await credsRes.json();
      const emp = creds.find((c: any) => c.username === user?.username);

      if (emp) {
        list = list.filter(
          (h: any) => h.companyID === emp.companyID && h.branchesID === emp.branchesID
        );
      } else {
        list = [];
      }
    }

    // dedupe by holiday name
    const map = new Map<string, number>();
    list.forEach((h: any) => {
      const name = (h?.holidayName || "").trim();
      const id = typeof h?.id === "number" ? h.id : undefined;
      if (name && id && !map.has(name)) map.set(name, id);
    });

    const mapped: Holiday[] = Array.from(map.entries()).map(([name, id]) => ({
      id: String(id),
      name,
      date: "",
      type: "",
    }));

    setAvailableHolidays(mapped);
  } catch (err) {
    console.error("Error fetching holidays:", err);
    toast.error("Failed to load data.");
    setAvailableHolidays([]);
  }
};

  // API functions
  const fetchServiceProviders = async (query: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/service-provider`)
      const data = await response.json()
      return data.filter((item: any) =>
        item.companyName?.toLowerCase().includes(query.toLowerCase())
      )
    } catch (error) {
      console.error('Error fetching service providers:', error)
      toast.error("Operation failed. Please try again.");
      return []
    }
  }

const fetchCompanies = async (query: string) => {
  try {
    // ❗ must know Service Provider
    if (!resolvedServiceProviderID) return [];

    const response = await fetch(`${BACKEND_URL}/company`, {
      cache: "no-store",
    });
    const data = await response.json();
    const q = query.toLowerCase();

    return Array.isArray(data)
      ? data.filter(
          (item: any) =>
            item.serviceProviderID === resolvedServiceProviderID &&
            (item.companyName ?? "").toLowerCase().includes(q)
        )
      : [];
  } catch (error) {
    console.error("Error fetching companies:", error);
    toast.error("Failed to load data.");
    return [];
  }
};

const loadBranchFilterList = async () => {
  try {
    setBranchFilterLoading(true)

    const res = await fetch(`${BACKEND_URL}/branches`, { cache: "no-store" })
    const data = await res.json()

    const ctx = getSidebarContext()

    const activeCompanyID =
      ctx?.companyID ??
      user?.companyID ??
      currentUserMapping?.companyID ??
      formData.companyID ??
      null

    let branches = Array.isArray(data) ? data : []

    if (user?.role !== "SUPERADMIN" && activeCompanyID) {
      branches = branches.filter(
        (b: any) => Number(b.companyID) === Number(activeCompanyID)
      )
    }

    if (user?.role === "SUPERADMIN" && ctx?.companyID) {
      branches = branches.filter(
        (b: any) => Number(b.companyID) === Number(ctx.companyID)
      )
    }

    if (user?.role === "BRANCH_ADMIN") {
      const branchID = currentUserMapping?.branchesID ?? user?.branchesID

      if (branchID) {
        branches = branches.filter((b: any) => Number(b.id) === Number(branchID))
        setSelectedFilterBranchIds([String(branchID)])
      }
    }

    setBranchFilterList(branches)
  } catch (e) {
    console.error("Failed to load branch filter list:", e)
    setBranchFilterList([])
  } finally {
    setBranchFilterLoading(false)
  }
}

const fetchBranches = async (query: string) => {
  try {
    // ❗ must know Company
    if (!resolvedCompanyID) return [];

    const res = await fetch(`${BACKEND_URL}/branches`, {
      cache: "no-store",
    });
    const data = await res.json();
    const q = query.toLowerCase();

    return Array.isArray(data)
      ? data.filter(
          (b: any) =>
            b.companyID === resolvedCompanyID &&
            (user?.role !== "BRANCH_ADMIN" || Number(b.id) === Number(user?.branchesID)) &&
            (b.branchName ?? "").toLowerCase().includes(q)
        )
      : [];
  } catch (error) {
    console.error("Error fetching branches:", error);
    toast.error("Failed to load data.");
    return [];
  }
};

useEffect(() => {
    if (user) {
      loadLeavePolicies()
      loadBranchFilterList()
    }
  }, [user]);

  useEffect(() => {
const handler = () => {
      if (user) {
        loadLeavePolicies()
        loadBranchFilterList()
      }
    };
    
    window.addEventListener("sidebar-context-changed", handler);
    window.addEventListener("app-data-refresh", handler);
    return () => {
      window.removeEventListener("sidebar-context-changed", handler);
      window.removeEventListener("app-data-refresh", handler);
    };
  }, [user]);

  const loadLeavePolicies = async () => {
    try {
      setListLoading(true)
      const [response, branchesRes] = await Promise.all([
        fetch(`${BACKEND_URL}/leave-policy`),
        fetch(`${BACKEND_URL}/branches`),
      ]);
      const data = await response.json();
      const branchesList = branchesRes.ok ? await branchesRes.json() : [];
      const branchNameById = new Map<number, string>(
        (Array.isArray(branchesList) ? branchesList : []).map((b: { id: number; branchName?: string }) => [
          b.id,
          b.branchName || "",
        ]),
      );

      const all = Array.isArray(data) ? data : [];
      const mapped = all.map((policy: any) => {
        const holidays = Array.isArray(policy?.leavePolicyHoliday)
          ? policy.leavePolicyHoliday
            .map((lph: any, idx: number) => ({
              id: String(lph?.publicHoliday?.manageHoliday?.id ?? idx),
              name: lph?.publicHoliday?.manageHoliday?.holidayName || "",
              date: "",
              type: "",
            }))
            .filter((h: any) => h.name)
          : [];

        return {
          ...policy,
          serviceProvider: policy.serviceProvider?.companyName || "",
          companyName: policy.company?.companyName || "",
          branchName:
            policy.branches?.branchName ||
            (policy.branchesID ? branchNameById.get(policy.branchesID) : "") ||
            "",
          applicableHolidays: holidays,
        };
      });

      const mapping = await resolveScopeUserMapping(user!);
      if (mapping) setCurrentUserMapping(mapping);
      setPolicies(await filterCompanyScopedRecords(mapped, user!));

    } catch (error) {
      console.error("Error loading leave policies:", error);
      toast.error("Failed to load data.");
      setPolicies([]);
    } finally {
      setListLoading(false)
    }
  };

 useEffect(() => {
  if (!user) return;

  // Only reload holidays on selection for SUPERADMIN
  if (user.role === "SUPERADMIN") {
    loadAvailableHolidays();
  }
}, [formData.companyID, formData.branchesID, user]);


  const toggleFilterBranch = (branchId: string) => {
    setSelectedFilterBranchIds((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId]
    )
  }

  const selectAllFilterBranches = () => {
    setSelectedFilterBranchIds(branchFilterList.map((b: any) => String(b.id)))
  }

  const clearFilterBranches = () => {
    if (user?.role === "BRANCH_ADMIN") return
    setSelectedFilterBranchIds([])
  }


 const filteredPolicies = policies.filter((policy) => {
    const t = searchTerm.toLowerCase()

    const matchesBranch =
      selectedFilterBranchIds.length === 0 ||
      selectedFilterBranchIds.includes(String(policy.branchesID))

    const matchesSearch =
      !t ||
      (policy.leavePolicyName || "").toLowerCase().includes(t) ||
      (policy.serviceProvider || "").toLowerCase().includes(t) ||
      (policy.companyName || "").toLowerCase().includes(t) ||
      (policy.branchName || "").toLowerCase().includes(t)

    return matchesBranch && matchesSearch
  })


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    const validationErrors: string[] = []
    if (!formData.leavePolicyName?.trim()) validationErrors.push("Leave Policy Name is required")
    if (!formData.branchesID || Number(formData.branchesID) <= 0) {
      validationErrors.push("Branch is required")
    }
    if (formData.isPrivilegedLeaveApplicable && (!formData.plExpiryMonth || !formData.plExpiryDay)) {
      validationErrors.push("PL Expiry day and month are required when PL is applicable")
    }
    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg))
      return
    }

    try {
      // Send selected ManageHoliday IDs to backend
      const applicableHolidayIds = (formData.applicableHolidays || [])
        .map((h) => {
          const found = availableHolidays.find((ah) => ah.name === h.name)
          return found ? Number(found.id) : undefined
        })
        .filter((id): id is number => typeof id === 'number' && !Number.isNaN(id))

     const payload = {
  serviceProviderID:
    user?.role === "SERVICE_PROVIDER"
      ? currentUserMapping?.serviceProviderID || null
      : formData.serviceProviderID || null,

  companyID:
    user?.role === "SERVICE_PROVIDER"
      ? currentUserMapping?.companyID || null
      : formData.companyID || currentUserMapping?.companyID || null,

  branchesID:
    formData.branchesID && Number(formData.branchesID) > 0
      ? Number(formData.branchesID)
      : user?.role === "BRANCH_ADMIN"
        ? currentUserMapping?.branchesID ?? null
        : null,

  leavePolicyName: formData.leavePolicyName,
  sickLeaveCount: String(formData.sickLeaveCount),
  casualLeaveCount: String(formData.casualLeaveCount),
  maternityLeaveCount: String(formData.maternityLeaveCount),
  paternityLeaveCount: String(formData.paternityLeaveCount),
  earnLeaveWorkingMonths: String(formData.earnLeaveWorkingMonths),
  earnLeaveCount: Number(formData.earnLeaveCount),
  isPrivilegedLeaveApplicable: formData.isPrivilegedLeaveApplicable,
  privilegedLeaveRatio: formData.privilegedLeaveRatio,
  weekOffConsideredInPL: formData.weekOffConsideredInPL,
  holidayConsideredInPL: formData.holidayConsideredInPL,
  paidLeaveConsideredInPL: formData.paidLeaveConsideredInPL,
  plCarryForwardLimit: Number(formData.plCarryForwardLimit),
  lapseEncashmentDate: plExpiryFromParts(formData.plExpiryMonth, formData.plExpiryDay),
  applicableHolidayIds,
};

      if (editingPolicy) {
        const response = await fetch(`${BACKEND_URL}/leave-policy/${editingPolicy.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          await loadLeavePolicies()
        }
      } else {
        const response = await fetch(`${BACKEND_URL}/leave-policy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          await loadLeavePolicies()
        }
      }

      resetForm()
      setIsDialogOpen(false)
      toast.success(editingPolicy ? "Leave policy updated successfully" : "Leave policy created successfully");
    } catch (error) {
      console.error('Error saving leave policy:', error)
      toast.error("Operation failed. Please try again.");
    }
  }

  const resetForm = () => {
    const ctx = getSidebarContext();
    setFormData({
      serviceProviderID: ctx?.serviceProviderID ?? 0,
      companyID: ctx?.companyID ?? 0,
      branchesID: 0,
      serviceProvider: ctx?.serviceProviderName ?? "",
      companyName: ctx?.companyName ?? "",
      branchName: "",
      leavePolicyName: "",
      sickLeaveCount: 0,
      casualLeaveCount: 0,
      maternityLeaveCount: 182,
      paternityLeaveCount: 15,
      earnLeaveWorkingMonths: 0,
      earnLeaveCount: 0,
      isPrivilegedLeaveApplicable: false,
      privilegedLeaveRatio: "20:1",
      weekOffConsideredInPL: false,
      holidayConsideredInPL: false,
      paidLeaveConsideredInPL: false,
      plCarryForwardLimit: 0,
      lapseEncashmentDate: "",
      plExpiryMonth: 0,
      plExpiryDay: 0,
      applicableHolidays: []
    })
    setEditingPolicy(null)
  }

  const handleEdit = (policy: LeavePolicy) => {
    const plParts = plExpiryToParts(policy.lapseEncashmentDate)
    setFormData({
      serviceProviderID: policy.serviceProviderID || 0,
      companyID: policy.companyID || 0,
      branchesID: policy.branchesID || 0,
      serviceProvider: policy.serviceProvider || "",
      companyName: policy.companyName || "",
      branchName: policy.branchName || "",
      leavePolicyName: policy.leavePolicyName || "",
      sickLeaveCount: parseInt(policy.sickLeaveCount || "0") || 0,
      casualLeaveCount: parseInt(policy.casualLeaveCount || "0") || 0,
      maternityLeaveCount: parseInt(policy.maternityLeaveCount || "182") || 182,
      paternityLeaveCount: parseInt(policy.paternityLeaveCount || "15") || 15,
      earnLeaveWorkingMonths: parseInt(policy.earnLeaveWorkingMonths || "0") || 0,
      earnLeaveCount: policy.earnLeaveCount || 0,
      isPrivilegedLeaveApplicable: policy.isPrivilegedLeaveApplicable || false,
      privilegedLeaveRatio: policy.privilegedLeaveRatio || "20:1",
      weekOffConsideredInPL: policy.weekOffConsideredInPL || false,
      holidayConsideredInPL: policy.holidayConsideredInPL || false,
      paidLeaveConsideredInPL: policy.paidLeaveConsideredInPL || false,
      plCarryForwardLimit: policy.plCarryForwardLimit || 0,
      lapseEncashmentDate: policy.lapseEncashmentDate ? policy.lapseEncashmentDate.split("T")[0] : "",
      plExpiryMonth: plParts.month,
      plExpiryDay: plParts.day,
      applicableHolidays: policy.applicableHolidays || []
    })
    setEditingPolicy(policy)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`${BACKEND_URL}/leave-policy/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadLeavePolicies()
        toast.success("Leave policy deleted successfully");
      }
    } catch (error) {
      console.error('Error deleting leave policy:', error)
      toast.error("Operation failed. Please try again.");
    }
  }

const handleServiceProviderSelect = (selected: SelectedItem) => {
  setFormData(prev => ({
    ...prev,
    serviceProviderID: selected.value,
    serviceProvider: selected.display,
    companyID: 0,
    companyName: "",
    branchesID: 0,
    branchName: "",
  }));
};


const handleCompanySelect = (selected: SelectedItem) => {
  setFormData(prev => ({
    ...prev,
    companyID: selected.value,
    companyName: selected.display,
    branchesID: 0,
    branchName: "",
  }));
};


  const handleBranchSelect = (selected: SelectedItem) => {
    setFormData(prev => ({
      ...prev,
      branchesID: selected.value,
      branchName: selected.display
    }))
  }

  const handleHolidayToggle = (holiday: Holiday) => {
    const isSelected = formData.applicableHolidays?.some(h => h.id === holiday.id) || false

    if (isSelected) {
      setFormData(prev => ({
        ...prev,
        applicableHolidays: (prev.applicableHolidays || []).filter(h => h.id !== holiday.id)
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        applicableHolidays: [...(prev.applicableHolidays || []), holiday]
      }))
    }
  }

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage leave policies and holiday configurations</p>
        </div>
        {canManage && !isDialogOpen && (
          <Button
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
            className="flex-shrink-0 text-sm px-3 py-2"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Leave Policy
          </Button>
        )}
      </div>

      <FormDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen} title={editingPolicy ? "Edit Leave Policy" : "Add New Leave Policy"} description={editingPolicy ? "Update the leave policy information below." : "Fill in the details to add a new leave policy."}>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

  {/* SP + Company auto-filled from sidebar context */}
  {false && (
    <>
      <SearchSuggestInput
        label="Service Provider"
        value={formData.serviceProvider}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, serviceProvider: value }))
        }
        onSelect={handleServiceProviderSelect}
        fetchData={fetchServiceProviders}
        placeholder="Select Service Provider"
        displayField="companyName"
        valueField="id"
        required
      />

      <SearchSuggestInput
        label="Company Name"
        value={formData.companyName}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, companyName: value }))
        }
        onSelect={handleCompanySelect}
        fetchData={fetchCompanies}
        placeholder="Select Company"
        displayField="companyName"
        valueField="id"
        required
      />
    </>
  )}

  <div className="space-y-2 sm:col-span-3">
    {user?.role === "BRANCH_ADMIN" ? (
      <>
        <Label htmlFor="branchNameLocked">Branch Name *</Label>
        <Input
          id="branchNameLocked"
          value={formData.branchName || "—"}
          readOnly
          disabled
          className="bg-gray-50"
        />
      </>
    ) : (
      <SearchSuggestInput
        label="Branch Name *"
        value={formData.branchName}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, branchName: value, branchesID: 0 }))
        }
        onSelect={handleBranchSelect}
        fetchData={fetchBranches}
        placeholder={
          resolvedCompanyID ? "Select Branch" : "Select company in sidebar first"
        }
        displayField="branchName"
        valueField="id"
        required
      />
    )}
  </div>
</div>


              <div className="space-y-2">
                <Label htmlFor="leavePolicyName">Leave Policy Name *</Label>
                <Input
                  id="leavePolicyName"
                  value={formData.leavePolicyName}
                  onChange={(e) => setFormData(prev => ({ ...prev, leavePolicyName: e.target.value }))}
                  placeholder="Enter leave policy name"
                  required
                />
              </div>

              {/* Leave Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Leave Configuration</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sickLeaveCount">Sick Leave / Per Year *</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="sickLeaveCount"
                        type="text"
                        value={formData.sickLeaveCount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setFormData(prev => ({ ...prev, sickLeaveCount: parseInt(value) || 0 }));
                        }}
                        placeholder="0"
                        required
                      />
                      <span className="text-sm text-gray-500">Nos</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="casualLeaveCount">Casual Leave / Per Year *</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="casualLeaveCount"
                        type="text"
                        value={formData.casualLeaveCount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setFormData(prev => ({ ...prev, casualLeaveCount: parseInt(value) || 0 }));
                        }}
                        placeholder="0"
                        required
                      />
                      <span className="text-sm text-gray-500">Nos</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maternityLeaveCount">Maternity Leave (MtL) / Per Event</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="maternityLeaveCount"
                        type="text"
                        value={formData.maternityLeaveCount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setFormData(prev => ({ ...prev, maternityLeaveCount: parseInt(value) || 0 }));
                        }}
                        placeholder="182"
                      />
                      <span className="text-sm text-gray-500">Days</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paternityLeaveCount">Paternity Leave (PtL) / Per Event</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="paternityLeaveCount"
                        type="text"
                        value={formData.paternityLeaveCount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setFormData(prev => ({ ...prev, paternityLeaveCount: parseInt(value) || 0 }));
                        }}
                        placeholder="15"
                      />
                      <span className="text-sm text-gray-500">Days</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Privileged Leave Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Privileged Leave (PL) Configuration</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <Label htmlFor="isPrivilegedLeaveApplicable" className="cursor-pointer">
                      Is Privileged Leave Applicable?
                    </Label>
                    <button
                      type="button"
                      id="isPrivilegedLeaveApplicable"
                      role="switch"
                      aria-checked={formData.isPrivilegedLeaveApplicable}
                      onClick={() => setFormData(prev => ({ ...prev, isPrivilegedLeaveApplicable: !prev.isPrivilegedLeaveApplicable }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        formData.isPrivilegedLeaveApplicable ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isPrivilegedLeaveApplicable ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="privilegedLeaveRatio">PL Ratio (Working Days : PL Days)</Label>
                    <Input
                      id="privilegedLeaveRatio"
                      value={formData.privilegedLeaveRatio}
                      onChange={(e) => setFormData(prev => ({ ...prev, privilegedLeaveRatio: e.target.value }))}
                      placeholder="20:1"
                      disabled={!formData.isPrivilegedLeaveApplicable}
                    />
                  </div>
                </div>

                {formData.isPrivilegedLeaveApplicable && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <Label htmlFor="weekOffConsideredInPL" className="cursor-pointer text-sm">
                        Week Off Considered in PL?
                      </Label>
                      <button
                        type="button"
                        id="weekOffConsideredInPL"
                        role="switch"
                        aria-checked={formData.weekOffConsideredInPL}
                        onClick={() => setFormData(prev => ({ ...prev, weekOffConsideredInPL: !prev.weekOffConsideredInPL }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          formData.weekOffConsideredInPL ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.weekOffConsideredInPL ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <Label htmlFor="holidayConsideredInPL" className="cursor-pointer text-sm">
                        Holiday Considered in PL?
                      </Label>
                      <button
                        type="button"
                        id="holidayConsideredInPL"
                        role="switch"
                        aria-checked={formData.holidayConsideredInPL}
                        onClick={() => setFormData(prev => ({ ...prev, holidayConsideredInPL: !prev.holidayConsideredInPL }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          formData.holidayConsideredInPL ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.holidayConsideredInPL ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <Label htmlFor="paidLeaveConsideredInPL" className="cursor-pointer text-sm">
                        Paid Leave Considered in PL?
                      </Label>
                      <button
                        type="button"
                        id="paidLeaveConsideredInPL"
                        role="switch"
                        aria-checked={formData.paidLeaveConsideredInPL}
                        onClick={() => setFormData(prev => ({ ...prev, paidLeaveConsideredInPL: !prev.paidLeaveConsideredInPL }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          formData.paidLeaveConsideredInPL ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.paidLeaveConsideredInPL ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="plCarryForwardLimit">PL Carry Forward Limit</Label>
                    <Input
                      id="plCarryForwardLimit"
                      type="number"
                      value={formData.plCarryForwardLimit}
                      onChange={(e) => setFormData(prev => ({ ...prev, plCarryForwardLimit: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>PL Expiry Date (day &amp; month)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        id="plExpiryMonth"
                        value={formData.plExpiryMonth || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            plExpiryMonth: Number(e.target.value) || 0,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                      >
                        <option value="">Month</option>
                        {MONTH_OPTIONS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                      <select
                        id="plExpiryDay"
                        value={formData.plExpiryDay || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            plExpiryDay: Number(e.target.value) || 0,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                      >
                        <option value="">Day</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-gray-500">Year is not stored — only the calendar day and month apply each year.</p>
                  </div>
                </div>
              </div>

            
              {/* Applicable Public Holidays */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Applicable Public Holidays</h3>
                <div className="border rounded-lg p-4 bg-gray-50">
                  <p className="text-sm text-gray-600 mb-4">Select holidays that apply to this leave policy:</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {availableHolidays.map((holiday) => {
                      const isSelected = formData.applicableHolidays?.some(h => h.id === holiday.id) || false
                      return (
                        <div key={holiday.id} className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded">
                          <input
                            type="checkbox"
                            id={`holiday-${holiday.id}`}
                            checked={isSelected}
                            onChange={() => handleHolidayToggle(holiday)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <Label htmlFor={`holiday-${holiday.id}`} className="font-medium cursor-pointer">
                              {holiday.name}
                            </Label>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              {/* Only holiday name is required per requirements */}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm text-gray-600">
                      Selected: {formData.applicableHolidays?.length || 0} holiday(s)
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="">
                  {editingPolicy ? "Update Leave Policy" : "Add Leave Policy"}
                </Button>
              </div>
            </form>
      </FormDrawer>

      {!isDialogOpen && (<>
      {/* Search and Filters */}
     <Card>
        <CardContent>
          <div className="flex items-center gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowBranchFilterModal(true)}
              className="flex-shrink-0"
              title="Filter by Branch"
            >
              <Filter className="w-4 h-4 mr-1" />
              Filter
              {selectedFilterBranchIds.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedFilterBranchIds.length}
                </Badge>
              )}
            </Button>

            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search leave policies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>

            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredPolicies.length} policies
            </Badge>
          </div>
        </CardContent>
      </Card>

      {showBranchFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl border">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Filter className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Filter Leave Policies by Branch
                  </h3>
                  <p className="text-xs text-gray-500">
                    Select one or multiple branches
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowBranchFilterModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">
                  {selectedFilterBranchIds.length} selected
                </Badge>

                <div className="flex gap-2">
                  {user?.role !== "BRANCH_ADMIN" && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={selectAllFilterBranches}
                        disabled={branchFilterLoading || branchFilterList.length === 0}
                      >
                        Select All
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearFilterBranches}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Clear
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {branchFilterList.length === 0 ? (
                  <p className="text-sm text-gray-500 col-span-full py-8 text-center">
                    {branchFilterLoading ? "Loading branches..." : "No branches found"}
                  </p>
                ) : (
                  branchFilterList.map((branch: any) => (
                    <label
                      key={branch.id}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFilterBranchIds.includes(String(branch.id))}
                        disabled={user?.role === "BRANCH_ADMIN"}
                        onChange={() => toggleFilterBranch(String(branch.id))}
                      />
                      <span className="truncate">{branch.branchName}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowBranchFilterModal(false)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={() => setShowBranchFilterModal(false)}
              >
                Apply Filter
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Leave Policy Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:calendar-clock" className="w-5 h-5" />
            Leave Policy List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 w-full">
          <div className="overflow-x-auto w-full">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Branch Name</TableHead>
                  <TableHead className="w-[150px]">Policy Name</TableHead>
                  <TableHead className="w-[100px]">Sick Leave</TableHead>
                  <TableHead className="w-[100px]">Casual Leave</TableHead>
                  <TableHead className="w-[100px]">Working Months</TableHead>
                  <TableHead className="w-[100px]">Earn Leave Days</TableHead>
                  <TableHead className="w-[80px]">PL</TableHead>
                  <TableHead className="w-[120px]">Holidays</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listLoading ? (
                  <TableBodySkeleton cols={9} />
                ) : filteredPolicies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:calendar-clock" className="w-12 h-12 text-gray-300" />
                        <p>No leave policies found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPolicies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell className="whitespace-nowrap">{policy.branchName || "-"}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{policy.leavePolicyName || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap text-center">{policy.sickLeaveCount || 0}</TableCell>
                      <TableCell className="whitespace-nowrap text-center">{policy.casualLeaveCount || 0}</TableCell>
                      <TableCell className="whitespace-nowrap text-center">{policy.earnLeaveWorkingMonths || 0}</TableCell>
                      <TableCell className="whitespace-nowrap text-center">{policy.earnLeaveCount || "0"}</TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        {policy.isPrivilegedLeaveApplicable ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">{policy.privilegedLeaveRatio || "20:1"}</Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        <Badge variant="secondary">
                          {policy.applicableHolidays?.length || 0} holidays
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* ✏️ SUPERADMIN & MANAGER can edit */}
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(policy)}
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
                              onClick={() => handleDelete(policy.id)}
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
      </>)}
    </div>
  )
}
