"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { FormDrawer } from "../components/ui/form-drawer"
import { Badge } from "../components/ui/badge"
import { Plus, Calendar } from "lucide-react"
import { PageHeader } from "../components/app/page-header"
import { FilterBar, FilterSelect } from "../components/app/filter-bar"
import { EntityListShell } from "../components/app/entity-list-shell"
import type { DataTableColumn } from "../components/app/data-table"
import { EntityRowActions } from "../components/app/entity-row-actions"
import { useClientTable, sortRows } from "../hooks/use-client-table"
import { SearchSuggestInput } from "../components/SearchSuggestInput"
import { CompanyBranchField } from "../components/app/company-branch-field"
import { useCurrentUser } from "../hooks/useCurrentUser";
import { hasModuleWriteAccess, isCompanyAdminLikeRole } from "@/lib/companyAccess";
import { toast } from "sonner";
import { readApiErrorMessage } from "../utils/api-error";
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
  const table = useClientTable("leavePolicyName")
  const [branchFilter, setBranchFilter] = useState("ALL")
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
    isCompanyAdminLikeRole(user?.role) ||
    user?.role === "ADMIN" ||
    user?.role === "BRANCH_ADMIN" ||
    hasModuleWriteAccess("LEAVE_POLICY");
const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);


const sidebarCtx = typeof window !== "undefined" ? getSidebarContext() : null;

const resolvedServiceProviderID =
  sidebarCtx?.serviceProviderID ??
  formData.serviceProviderID ??
  currentUserMapping?.serviceProviderID ??
  user?.serviceProviderID ??
  null;

const resolvedCompanyID =
  sidebarCtx?.companyID ??
  formData.companyID ??
  currentUserMapping?.companyID ??
  user?.companyID ??
  null;


// Load user mapping for roles that scope company/branch
useEffect(() => {
  if (!user) return;
  if (user.role === "BRANCH_ADMIN") {
    setCurrentUserMapping(user);
    return;
  }
  if (
    user.role === "SERVICE_PROVIDER" ||
    isCompanyAdminLikeRole(user.role) ||
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
    const ctx = getSidebarContext();
    const companyID = ctx?.companyID ?? currentUserMapping.companyID;
    const sameCompany = Number(companyID) === Number(currentUserMapping.companyID);
    setFormData((p) => ({
      ...p,
      serviceProviderID: currentUserMapping.serviceProviderID,
      companyID,
      branchesID: sameCompany ? (currentUserMapping.branchesID ?? p.branchesID) : 0,
    }));
  } else if (isCompanyAdminLikeRole(user?.role) || user?.role === "ADMIN") {
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
    setBranchFilterLoading(true);

    const res = await fetch(`${BACKEND_URL}/branches`, { cache: "no-store" });
    const data = await res.json();

    const mapping = user ? await resolveScopeUserMapping(user) : null;
    if (mapping) setCurrentUserMapping(mapping);

    const ctx = getSidebarContext();

    const activeCompanyID =
      ctx?.companyID ??
      mapping?.companyID ??
      user?.companyID ??
      null;

    let branches = Array.isArray(data) ? data : [];

    if (activeCompanyID) {
      branches = branches.filter(
        (b: any) => Number(b.companyID) === Number(activeCompanyID)
      );
    }

    if (user?.role === "BRANCH_ADMIN") {
      const branchID = mapping?.branchesID ?? user?.branchesID;

      if (branchID) {
        branches = branches.filter(
          (b: any) => Number(b.id) === Number(branchID)
        );
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


const fetchBranches = async (query: string) => {
  try {
    const ctx = getSidebarContext();

    const activeCompanyID =
      ctx?.companyID ??
      formData.companyID ??
      currentUserMapping?.companyID ??
      user?.companyID ??
      null;

    if (!activeCompanyID) return [];

    const res = await fetch(`${BACKEND_URL}/branches`, {
      cache: "no-store",
    });

    const data = await res.json();
    const q = query.toLowerCase();

    let branches = Array.isArray(data) ? data : [];

    branches = branches.filter(
      (b: any) => Number(b.companyID) === Number(activeCompanyID)
    );

    if (user?.role === "BRANCH_ADMIN") {
      const branchID = currentUserMapping?.branchesID ?? user?.branchesID;

      if (branchID) {
        branches = branches.filter(
          (b: any) => Number(b.id) === Number(branchID)
        );
      }
    }

    const matched = branches.filter((b: any) =>
      (b.branchName ?? "").toLowerCase().includes(q)
    );
    const seen = new Set<number>();
    return matched.filter((b: any) => {
      const id = Number(b.id);
      if (!Number.isFinite(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
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
  setBranchFilter(user?.role === "BRANCH_ADMIN" ? String(user?.branchesID ?? "ALL") : "ALL");
  setBranchFilterList([]);
  setFormData((p) => ({
    ...p,
    branchesID: 0,
    branchName: "",
  }));

  if (user) {
    loadLeavePolicies();
    loadBranchFilterList();
  }
};  

  const sidebarPageClickHandler = (e: any) => {
    if (e.detail?.path === "/leave-policy") {
      closeLeavePolicyPagePanels();

      if (user) {
        loadLeavePolicies();
        loadBranchFilterList();
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

const ctx = getSidebarContext();

const activeCompanyID =
  ctx?.companyID ??
  mapping?.companyID ??
  user?.companyID ??
  null;

let filteredPolicies = mapped;

if (activeCompanyID) {
  filteredPolicies = filteredPolicies.filter(
    (p: any) => Number(p.companyID) === Number(activeCompanyID)
  );
}

if (user?.role === "BRANCH_ADMIN") {
  const branchID = mapping?.branchesID ?? user?.branchesID;

  if (branchID) {
    filteredPolicies = filteredPolicies.filter(
      (p: any) => Number(p.branchesID) === Number(branchID)
    );
  }
}

setPolicies(filteredPolicies);


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


  const filteredPolicies = useMemo(() => {
    const t = table.search.trim().toLowerCase()

    let list = policies.filter((policy) => {
      const matchesBranch =
        branchFilter === "ALL" || branchFilter === String(policy.branchesID ?? "")

      const matchesSearch =
        !t ||
        (policy.leavePolicyName || "").toLowerCase().includes(t) ||
        (policy.serviceProvider || "").toLowerCase().includes(t) ||
        (policy.companyName || "").toLowerCase().includes(t) ||
        (policy.branchName || "").toLowerCase().includes(t)

      return matchesBranch && matchesSearch
    })

    return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
      const p = row as LeavePolicy
      if (key === "branchName") return p.branchName ?? ""
      if (key === "leavePolicyName") return p.leavePolicyName ?? ""
      if (key === "sickLeaveCount") return p.sickLeaveCount ?? ""
      if (key === "casualLeaveCount") return p.casualLeaveCount ?? ""
      if (key === "earnLeaveWorkingMonths") return p.earnLeaveWorkingMonths ?? ""
      if (key === "earnLeaveCount") return p.earnLeaveCount ?? 0
      if (key === "holidays") return p.applicableHolidays?.length ?? 0
      return ""
    })
  }, [policies, table.search, table.sortBy, table.sortDir, branchFilter])

  const branchFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All branches" },
      ...branchFilterList.map((b: any) => ({
        value: String(b.id),
        label: b.branchName || `Branch #${b.id}`,
      })),
    ],
    [branchFilterList],
  )

  const policyColumns = useMemo((): DataTableColumn<LeavePolicy>[] => [
    { key: "branchName", header: "Branch", sortable: true, colSpan: 2, cell: (p) => p.branchName || "—" },
    { key: "leavePolicyName", header: "Policy Name", sortable: true, colSpan: 2, cell: (p) => <span className="font-medium">{p.leavePolicyName || "—"}</span> },
    { key: "sickLeaveCount", header: "Sick Leave", sortable: true, colSpan: 1, cell: (p) => p.sickLeaveCount || 0 },
    { key: "casualLeaveCount", header: "Casual Leave", sortable: true, colSpan: 1, cell: (p) => p.casualLeaveCount || 0 },
    { key: "earnLeaveWorkingMonths", header: "Working Months", sortable: true, colSpan: 1, cell: (p) => p.earnLeaveWorkingMonths || 0 },
    { key: "earnLeaveCount", header: "Earn Leave", sortable: true, colSpan: 1, cell: (p) => p.earnLeaveCount || "0" },
    {
      key: "pl",
      header: "PL",
      colSpan: 1,
      cell: (p) =>
        p.isPrivilegedLeaveApplicable ? (
          <Badge variant="default" className="bg-green-100 text-green-800">{p.privilegedLeaveRatio || "20:1"}</Badge>
        ) : (
          <Badge variant="secondary">No</Badge>
        ),
    },
    {
      key: "holidays",
      header: "Holidays",
      sortable: true,
      colSpan: 1,
      cell: (p) => (
        <Badge variant="secondary">
          {p.applicableHolidays?.length || 0} holidays
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      colSpan: 2,
      align: "right",
      cell: (p) => (
        <EntityRowActions
          onEdit={canManage ? () => handleEdit(p) : undefined}
          onDelete={canManage ? () => handleDelete(p.id) : undefined}
          deleteConfirmMessage="Are you sure you want to delete this leave policy?"
        />
      ),
    },
  ], [canManage])


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

 const ctx = getSidebarContext();

const payload = {
  serviceProviderID:
    ctx?.serviceProviderID ??
    formData.serviceProviderID ??
    currentUserMapping?.serviceProviderID ??
    user?.serviceProviderID ??
    null,

  companyID:
    ctx?.companyID ??
    formData.companyID ??
    currentUserMapping?.companyID ??
    user?.companyID ??
    null,

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

  const closeLeavePolicyPagePanels = () => {
  resetForm();

  setIsDialogOpen(false);
  setEditingPolicy(null);
};

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
        return;
      }

      const message = await readApiErrorMessage(response, "Failed to delete leave policy.");
      toast.error(message);
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
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={Calendar}
        title="Leave Policy"
        description="Manage leave policies and holiday configurations"
        actions={
          canManage && !isDialogOpen ? (
            <Button
              onClick={() => {
                closeLeavePolicyPagePanels();
                setIsDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Leave Policy
            </Button>
          ) : null
        }
      />

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
      <CompanyBranchField
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
        companyID={formData.companyID ?? resolvedCompanyID}
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
                <Button type="button" variant="outline" onClick={closeLeavePolicyPagePanels}>
                  Cancel
                </Button>
                <Button type="submit" className="">
                  {editingPolicy ? "Update Leave Policy" : "Add Leave Policy"}
                </Button>
              </div>
            </form>
      </FormDrawer>

      {!isDialogOpen && (<>
        <FilterBar
          search={{
            value: table.search,
            onChange: table.setSearch,
            placeholder: "Search leave policies…",
          }}
          filters={
            <FilterSelect
              id="leave-policy-branch"
              value={branchFilter}
              onChange={setBranchFilter}
              options={branchFilterOptions}
              width="w-56"
              ariaLabel="Filter by branch"
            />
          }
        />

        <EntityListShell
          title="All leave policies"
          columns={policyColumns}
          rows={filteredPolicies}
          rowKey={(p) => String(p.id)}
          isLoading={listLoading}
          sortBy={table.sortBy}
          sortDir={table.sortDir}
          onSort={table.setSort}
          emptyIcon={Calendar}
          emptyTitle="No leave policies yet"
          emptyDescription="Create your first leave policy to configure entitlements and holidays."
          emptyAction={
            canManage ? (
              <Button onClick={() => { closeLeavePolicyPagePanels(); setIsDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Leave Policy
              </Button>
            ) : undefined
          }
        />
      </>)}
    </div>
  )
}
