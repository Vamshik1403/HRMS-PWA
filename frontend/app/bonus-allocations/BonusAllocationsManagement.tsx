"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { FormDrawer } from "../components/ui/form-drawer";
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

/* ---------------- API endpoints ---------------- */
const API = {
  allocations: "/backend/bonus-allocation",
  employees: "/backend/manage-emp",
  bonusSetups: "/backend/bonus-setup",
  companies: "/backend/company",
  salaryCycle: "/backend/salary-cycle",
  branches: "/backend/branches",
  departments : "/backend/departments"
};
const MIN_CHARS = 0;

/* ---------------- Types ---------------- */
type ApiAllocation = {
  id: number;
  bonusSetupID: number;
  financialYear: number | null;
  salaryPeriod: number | null;
 employeeID: number;
branchesID?: number | null;
departmentID?: number | null;
createdAt?: string;
branches?: { id: number; branchName?: string | null } | null;
departments?: { id: number; departmentName?: string | null } | null;
  bonusSetup?: {
    id: number;
    bonusName: string | null;
    serviceProviderID: number | null;
    companyID: number | null;
    branchesID: number | null;
    bonusType: string | null;
    bonusDescription: string | null;
    bonusBasedOn: string | null;
    bonusPercentage: string | null;
    bonusFixed: string | null;
  } | null;
  manageEmployee?: {
    id: number;
    employeeID: string;
    employeeFirstName: string | null;
    employeeLastName: string | null;
    companyID?: number | null;
branchesID?: number | null;
departmentNameID?: number | null;
departments?: { id: number; departmentName?: string | null } | null;
branches?: { id: number; branchName?: string | null } | null;  } | null;
};

type EmployeeApi = {
  id: number;
  employeeID: string;
  employeeFirstName: string | null;
  employeeLastName: string | null;
  companyID?: number | null;
branchesID?: number | null;
departmentNameID?: number | null;
departments?: { id: number; departmentName?: string | null } | null;
branches?: { id: number; branchName?: string | null } | null;
};

type BonusSetupApi = { 
  id: number; 
  bonusName: string | null;
  companyID?: number | null;
  branchesID?: number | null;
};

type CompanyApi = {
  id: number;
  companyName?: string | null;
  financialYearStart?: string | null;
};

type SalaryCycleApi = {
  id: number;
  monthStartDay?: string | null;
};

interface BonusAllocationUI {
  id: string;
  bonusSetupID: number;
  employeeDbID: number;
  bonusName: string;
  financialYearLabel: string;
  salaryPeriodLabel: string;
  employeeName: string;
  employeeCode: string;
  bonusAmount: number;
  createdAt: string;
  companyID?: number | null;
branchesID?: number | null;
departmentID?: number | null;
branchName?: string;
departmentName?: string;
}

/* ---------------- Helpers ---------------- */
const monthsFull = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getCurrentYear() {
  return new Date().getFullYear();
}

function isJanStart(fyStart?: string | null) {
  return (fyStart ?? "").trim().toLowerCase() === "1st jan";
}

function buildFinancialYearOptions(financialYearStart?: string | null): string[] {
  const y = getCurrentYear();
  if (isJanStart(financialYearStart)) {
    return [String(y)];
  }
  return [`${y}-${y + 1}`];
}

function buildSalaryPeriods(financialYearStart?: string | null, monthStartDay?: string | null): string[] {
  const y = getCurrentYear();

  if (isJanStart(financialYearStart)) {
    return monthsFull.map((m) => `${m} ${y}`);
  }

  const start = parseInt(monthStartDay ?? "1", 10);
  if (!Number.isFinite(start) || start <= 1) {
    return monthsFull.map((m) => `${m} ${y}`);
  }

  const endDay = start - 1;
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const mIdx = i;
    const nextIdx = (mIdx + 1) % 12;
    const label = `${start} ${monthsShort[mIdx]} to ${endDay} ${monthsShort[nextIdx]}`;
    out.push(label);
  }
  return out;
}

function nameFromEmp(e?: { employeeFirstName: string | null; employeeLastName: string | null } | null) {
  const f = (e?.employeeFirstName ?? "").trim();
  const l = (e?.employeeLastName ?? "").trim();
  return [f, l].filter(Boolean).join(" ") || "-";
}

function inferFinancialYearLabelFromNumber(year?: number, financialYearStart?: string | null) {
  if (!year) return "-";
  if (isJanStart(financialYearStart)) return String(year);
  return `${year}-${year + 1}`;
}

function inferSalaryPeriodLabelFromNumber(m?: number, monthStartDay?: string | null, financialYearStart?: string | null) {
  if (!m || m < 1 || m > 12) return "-";
  const y = getCurrentYear();

  if (isJanStart(financialYearStart)) {
    return `${monthsFull[m - 1]} ${y}`;
  }

  const start = parseInt(monthStartDay ?? "1", 10);
  if (!Number.isFinite(start) || start <= 1) {
    return `${monthsFull[m - 1]} ${y}`;
  }
  const endDay = start - 1;
  const mIdx = m - 1;
  const nextIdx = (mIdx + 1) % 12;
  return `${start} ${monthsShort[mIdx]} to ${endDay} ${monthsShort[nextIdx]}`;
}

function parseFinancialYearLabelToYear(label: string): number | null {
  const m = label.match(/\b(20\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

function parseSalaryPeriodLabelToMonth(label: string): number | null {
  const lower = label.toLowerCase();
  for (let i = 0; i < 12; i++) {
    if (lower.includes(monthsFull[i].toLowerCase()) || lower.includes(monthsShort[i].toLowerCase())) {
      return i + 1;
    }
  }
  return null;
}

/* ---------------- Component ---------------- */
export function BonusAllocationsManagement() {
  const [listLoading, setListLoading] = useState(true);
  const [allocations, setAllocations] = useState<BonusAllocationUI[]>([]);
  const table = useClientTable("bonusName");
  const [branchList, setBranchList] = useState<any[]>([]);
  const [departmentList, setDepartmentList] = useState<any[]>([]);
  const [selectedBranchID, setSelectedBranchID] = useState("");
  const [selectedDepartmentID, setSelectedDepartmentID] = useState("");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<BonusAllocationUI | null>(null);

  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN" || canDesktopManagerManage(user);
  const isEmployee = user?.role === "EMPLOYEE";

  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const mapping = await resolveScopeUserMapping(user);
      if (!cancelled && mapping) setCurrentUserMapping(mapping);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const [empList, setEmpList] = useState<EmployeeApi[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [bonusList, setBonusList] = useState<BonusSetupApi[]>([]);
  const [bonusLoading, setBonusLoading] = useState(false);

  const empRef = useRef<HTMLDivElement | null>(null);
  const bonusRef = useRef<HTMLDivElement | null>(null);

  const [financialYearStart, setFinancialYearStart] = useState<string>("1st April");
  const [monthStartDay, setMonthStartDay] = useState<string>("1");
  const [financialYearOptions, setFinancialYearOptions] = useState<string[]>([]);
  const [salaryPeriodOptions, setSalaryPeriodOptions] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    bonusSetupID: null as number | null,
    employeeDbID: null as number | null,
    bonusAutocomplete: "",
  employeeAutocomplete: "",
branchName: "",
departmentName: "",
financialYearLabel: "",
    salaryPeriodLabel: "",
  });

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (empRef.current && !empRef.current.contains(t)) setEmpList([]);
      if (bonusRef.current && !bonusRef.current.contains(t)) setBonusList([]);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

 useEffect(() => {
  if (user) {
    loadBranchDepartmentLookups().then(() => {
      loadAllocations();
    });
  }
}, [user]);

  useEffect(() => {
  const handler = () => {
  if (user) {
    loadBranchDepartmentLookups().then(() => {
      loadAllocations();
    });
  }
 };
    window.addEventListener("sidebar-context-changed", handler);
    window.addEventListener("app-data-refresh", handler);
    return () => {
      window.removeEventListener("sidebar-context-changed", handler);
      window.removeEventListener("app-data-refresh", handler);
    };
  }, [user]);

  const loadBranchDepartmentLookups = async () => {
  try {
    const [brRes, deptRes] = await Promise.all([
      fetch(API.branches, { cache: "no-store" }),
      fetch(API.departments, { cache: "no-store" }),
    ]);

    const brRaw = await brRes.json();
    const deptRaw = await deptRes.json();

    const ctx = getSidebarContext();
    const activeCompanyID =
      ctx?.companyID ??
      user?.companyID ??
      currentUserMapping?.companyID ??
      null;

    let branches = Array.isArray(brRaw) ? brRaw : brRaw?.data ?? [];
    let departments = Array.isArray(deptRaw) ? deptRaw : deptRaw?.data ?? [];

    if (activeCompanyID && user?.role !== "SUPERADMIN") {
      branches = branches.filter((b: any) => Number(b.companyID) === Number(activeCompanyID));
      departments = departments.filter((d: any) => Number(d.companyID) === Number(activeCompanyID));
    }

    if (user?.role === "SUPERADMIN" && ctx?.companyID) {
      branches = branches.filter((b: any) => Number(b.companyID) === Number(ctx.companyID));
      departments = departments.filter((d: any) => Number(d.companyID) === Number(ctx.companyID));
    }

    if (user?.role === "BRANCH_ADMIN") {
      const branchID = currentUserMapping?.branchesID ?? user?.branchesID;
      if (branchID) {
        branches = branches.filter((b: any) => Number(b.id) === Number(branchID));
        departments = departments.filter((d: any) => Number(d.branchesID) === Number(branchID));
        setSelectedBranchID(String(branchID));
        setBranchFilter(String(branchID));
      }
    }

    setBranchList(branches);
    setDepartmentList(departments);
  } catch (e) {
    console.error("Failed to load branch/department filters", e);
    setBranchList([]);
    setDepartmentList([]);
  }
};

  const loadAllocations = async () => {
    setListLoading(true);
    try {
      // Build URL with filters for MANAGER role
      let allocationsUrl = API.allocations;
      
      if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
        const params = new URLSearchParams();
        if (currentUserMapping.companyID) params.append('companyID', currentUserMapping.companyID.toString());
        if (currentUserMapping.branchesID) params.append('branchesID', currentUserMapping.branchesID.toString());
        
        const queryString = params.toString();
        if (queryString) {
          allocationsUrl += `?${queryString}`;
        }
      }

      const res = await fetch(allocationsUrl);
      if (!res.ok) throw new Error(`allocations HTTP ${res.status}`);
      const raw = await res.json();
      const data: ApiAllocation[] = Array.isArray(raw) ? raw : raw?.data ?? [];

      const cRes = await fetch(API.companies);
      const companies: CompanyApi[] = await cRes.json();
      const fyStart = (companies?.[0]?.financialYearStart ?? "1st April") as string;

      const scRes = await fetch(API.salaryCycle);
      const cycles: SalaryCycleApi[] = await scRes.json();
      const mStart = (cycles?.[0]?.monthStartDay ?? "1") as string;

      // Additional client-side filtering for MANAGER role
      let filteredData = data;
      if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
        if (currentUserMapping.companyID && currentUserMapping.branchesID) {
          filteredData = data.filter(allocation => {
            const allocationCompanyID = allocation.bonusSetup?.companyID;
            const allocationBranchesID = allocation.bonusSetup?.branchesID;
            
            return allocationCompanyID === currentUserMapping.companyID && 
                   allocationBranchesID === currentUserMapping.branchesID;
          });
        } else if (currentUserMapping.companyID) {
          filteredData = data.filter(allocation => {
            const allocationCompanyID = allocation.bonusSetup?.companyID;
            return allocationCompanyID === currentUserMapping.companyID;
          });
        } else if (currentUserMapping.serviceProviderID) {
          filteredData = data.filter((allocation: any) => {
            const allocationSPID = allocation.bonusSetup?.serviceProviderID;
            return allocationSPID === currentUserMapping.serviceProviderID;
          });
        } else {
          filteredData = [];
        }
      }

      const all = filteredData.map((x) => ({
        id: String(x.id),
        bonusSetupID: x.bonusSetupID,
        employeeDbID: x.employeeID,
        bonusName: x.bonusSetup?.bonusName || "-",
        financialYearLabel: inferFinancialYearLabelFromNumber(x.financialYear ?? undefined, fyStart),
        salaryPeriodLabel: inferSalaryPeriodLabelFromNumber(x.salaryPeriod ?? undefined, mStart, fyStart),
        employeeName: nameFromEmp(x.manageEmployee),
        employeeCode: x.manageEmployee?.employeeID || "",
        bonusAmount: 0,
        createdAt: x.createdAt ? x.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
       companyID: x.bonusSetup?.companyID ?? x.manageEmployee?.companyID ?? null,
branchesID: x.branchesID ?? x.manageEmployee?.branchesID ?? x.bonusSetup?.branchesID ?? null,
departmentID: x.departmentID ?? x.manageEmployee?.departmentNameID ?? null,
branchName:
  x.branches?.branchName ??
  x.manageEmployee?.branches?.branchName ??
  branchList.find((b: any) => Number(b.id) === Number(x.branchesID))?.branchName ??
  "",

departmentName:
  x.departments?.departmentName ??
  x.manageEmployee?.departments?.departmentName ??
  departmentList.find((d: any) => Number(d.id) === Number(x.departmentID))?.departmentName ??
  "",

      }));

      setAllocations(await filterCompanyScopedRecords(all, user));

    } catch (e) {
      console.error("Failed to load data", e);
      setAllocations([]);
    } finally {
      setListLoading(false);
    }
  };


  useEffect(() => {
    setFinancialYearOptions(buildFinancialYearOptions(financialYearStart));
    setSalaryPeriodOptions(buildSalaryPeriods(financialYearStart, monthStartDay));
  }, [financialYearStart, monthStartDay]);

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

  const runFetchEmployees = debounce(async (val: string) => {
  if (!selectedBranchID || !selectedDepartmentID) {
    setEmpList([]);
    return;
  }

  setEmpLoading(true);

  try {
    let employeesUrl = API.employees;

    const list: EmployeeApi[] = await robustGet(employeesUrl, val);

    const ctx = getSidebarContext();
    const companyID =
      ctx?.companyID ??
      user?.companyID ??
      currentUserMapping?.companyID ??
      null;

    let filtered = Array.isArray(list) ? list : [];

    if (companyID && user?.role !== "SUPERADMIN") {
      filtered = filtered.filter(
        (e: any) => Number(e.companyID) === Number(companyID)
      );
    }

    filtered = filtered.filter((e: any) => {
      const empBranchID =
        e.branchesID ??
        e.branchID ??
        e.branches?.id ??
        e.branch?.id ??
        null;

      const empDeptID =
        e.departmentNameID ??
        e.departmentID ??
        e.departmentsID ??
        e.departments?.id ??
        e.department?.id ??
        null;

      return (
        Number(empBranchID) === Number(selectedBranchID) &&
        Number(empDeptID) === Number(selectedDepartmentID)
      );
    });

    const lc = val.toLowerCase();

    filtered = filtered.filter((e) => {
      const name = `${e.employeeFirstName ?? ""} ${e.employeeLastName ?? ""}`
        .trim()
        .toLowerCase();

      return (
        name.includes(lc) ||
        String(e.employeeID ?? "").toLowerCase().includes(lc)
      );
    });

    setEmpList(filtered.slice(0, 50));
  } catch (e) {
    console.error("Employees fetch error", e);
    setEmpList([]);
  } finally {
    setEmpLoading(false);
  }
}, 250);

  const runFetchBonus = debounce(async (val: string) => {
    if (!val || val.length < MIN_CHARS) return setBonusList([]);
    setBonusLoading(true);
    try {
      // Build URL with filters for MANAGER role
      let bonusUrl = API.bonusSetups;
      
      if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
        const params = new URLSearchParams();
        if (currentUserMapping.companyID) params.append('companyID', currentUserMapping.companyID.toString());
        if (currentUserMapping.branchesID) params.append('branchesID', currentUserMapping.branchesID.toString());
        
        const queryString = params.toString();
        if (queryString) {
          bonusUrl += `?${queryString}`;
        }
      }

      const list: BonusSetupApi[] = await robustGet(bonusUrl, val);
      
      // Additional client-side filtering for MANAGER role
      let filtered = list;
      if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
        filtered = list.filter(bonus => {
          return bonus.companyID === currentUserMapping.companyID && 
                 bonus.branchesID === currentUserMapping.branchesID;
        });
      }

      const lc = val.toLowerCase();
      filtered = filtered.filter((b) => (b.bonusName ?? "").toLowerCase().includes(lc));
      
      setBonusList(filtered.slice(0, 50));
    } catch (e) {
      console.error("Bonus fetch error", e);
      setBonusList([]);
    } finally {
      setBonusLoading(false);
    }
  }, 250);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const validationErrors: string[] = [];
    if (!formData.bonusSetupID) validationErrors.push("Please select a Bonus Setup");
    if (!formData.employeeDbID) validationErrors.push("Please select an Employee");
    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg));
      return;
    }

  const payload = {
      bonusSetupID: formData.bonusSetupID,
      branchesID: selectedBranchID ? Number(selectedBranchID) : undefined,
      departmentID: selectedDepartmentID ? Number(selectedDepartmentID) : undefined,
      employeeID: formData.employeeDbID,
      financialYear: parseFinancialYearLabelToYear(formData.financialYearLabel),
      salaryPeriod: parseSalaryPeriodLabelToMonth(formData.salaryPeriodLabel),
    };

    try {
      if (editingAllocation) {
        const res = await fetch(`${API.allocations}/${editingAllocation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const updated: ApiAllocation = await res.json();

        // CORRECTED: Update with proper data mapping
        const updatedAllocation: BonusAllocationUI = {
          id: String(updated.id),
          bonusSetupID: updated.bonusSetupID,
          employeeDbID: updated.employeeID,
          bonusName: updated.bonusSetup?.bonusName || "-",
          financialYearLabel: inferFinancialYearLabelFromNumber(updated.financialYear ?? undefined, financialYearStart),
          salaryPeriodLabel: inferSalaryPeriodLabelFromNumber(updated.salaryPeriod ?? undefined, monthStartDay, financialYearStart),
          employeeName: nameFromEmp(updated.manageEmployee),
          employeeCode: updated.manageEmployee?.employeeID || "",
          bonusAmount: 0,
          companyID: updated.bonusSetup?.companyID ?? updated.manageEmployee?.companyID ?? null,
branchesID: updated.branchesID ?? updated.manageEmployee?.branchesID ?? updated.bonusSetup?.branchesID ?? null,
departmentID: updated.departmentID ?? updated.manageEmployee?.departmentNameID ?? null,
branchName: updated.branches?.branchName ?? updated.manageEmployee?.branches?.branchName ?? "",
departmentName: updated.departments?.departmentName ?? updated.manageEmployee?.departments?.departmentName ?? "",
          createdAt: updated.createdAt ? updated.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
        };

        setAllocations((prev) => prev.map((a) => a.id === String(updated.id) ? updatedAllocation : a));
      } else {
        const res = await fetch(API.allocations, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created: ApiAllocation = await res.json();

        // CORRECTED: Create with proper data mapping
        const newAllocation: BonusAllocationUI = {
          id: String(created.id),
          bonusSetupID: created.bonusSetupID,
          employeeDbID: created.employeeID,
          bonusName: created.bonusSetup?.bonusName || "-",
          financialYearLabel: inferFinancialYearLabelFromNumber(created.financialYear ?? undefined, financialYearStart),
          salaryPeriodLabel: inferSalaryPeriodLabelFromNumber(created.salaryPeriod ?? undefined, monthStartDay, financialYearStart),
          employeeName: nameFromEmp(created.manageEmployee),
          employeeCode: created.manageEmployee?.employeeID || "",
          companyID: created.bonusSetup?.companyID ?? created.manageEmployee?.companyID ?? null,
branchesID: created.branchesID ?? created.manageEmployee?.branchesID ?? created.bonusSetup?.branchesID ?? null,
departmentID: created.departmentID ?? created.manageEmployee?.departmentNameID ?? null,
branchName: created.branches?.branchName ?? created.manageEmployee?.branches?.branchName ?? "",
departmentName: created.departments?.departmentName ?? created.manageEmployee?.departments?.departmentName ?? "",
          bonusAmount: 0,
          createdAt: created.createdAt ? created.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
        };

        setAllocations((prev) => [newAllocation, ...prev]);
      }
      resetForm();
      setIsDialogOpen(false);
      toast.success("Bonus allocation saved successfully");
    } catch (e) {
      console.error("Save failed", e);
      toast.error((e as any)?.message || "Failed to save bonus allocation");
    }
  };

  const handleEdit = (allocation: BonusAllocationUI) => {
    // CORRECTED: Set form data with proper values for edit modal
    setFormData({
      bonusSetupID: allocation.bonusSetupID,
      employeeDbID: allocation.employeeDbID,
      bonusAutocomplete: allocation.bonusName,
      employeeAutocomplete: `${allocation.employeeName}${allocation.employeeCode ? ` (${allocation.employeeCode})` : ""}`,
      branchName: allocation.branchName ?? "",
      departmentName: allocation.departmentName ?? "",
      financialYearLabel: allocation.financialYearLabel,
      salaryPeriodLabel: allocation.salaryPeriodLabel,
    });
    setEditingAllocation(allocation);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API.allocations}/${id}`, { method: "DELETE" });
      setAllocations((prev) => prev.filter((a) => a.id !== id));
      toast.success("Bonus allocation deleted successfully");
    } catch (e) {
      console.error("Delete failed", e);
      toast.error((e as any)?.message || "Failed to delete bonus allocation");
    }
  };

  const resetForm = () => {
    setFormData({
      bonusSetupID: null,
      employeeDbID: null,
      bonusAutocomplete: "",
    employeeAutocomplete: "",
branchName: "",
departmentName: "",
financialYearLabel: "",
      salaryPeriodLabel: "",
    });
    setEditingAllocation(null);
    setEmpList([]);
    setBonusList([]);
    setSelectedDepartmentID("");
if (user?.role !== "BRANCH_ADMIN") setSelectedBranchID("");
  };

  const visibleFormDepartments = departmentList.filter((d: any) =>
  selectedBranchID ? Number(d.branchesID) === Number(selectedBranchID) : false
);

const visibleFilterDepartments = departmentList.filter((d: any) =>
  branchFilter === "ALL" || branchFilter === String(d.branchesID)
);

const handleBranchFilterChange = (value: string) => {
  setBranchFilter(value);
  if (departmentFilter !== "ALL") {
    const dept = departmentList.find((d: any) => String(d.id) === departmentFilter);
    if (dept && value !== "ALL" && String(dept.branchesID) !== value) {
      setDepartmentFilter("ALL");
    }
  }
};

const filteredAllocations = useMemo(() => {
    const q = table.search.trim().toLowerCase();

    let list = allocations.filter((a) => {
      const matchesBranch =
        branchFilter === "ALL" || branchFilter === String(a.branchesID);

      const matchesDepartment =
        departmentFilter === "ALL" || departmentFilter === String(a.departmentID);

      const matchesSearch =
        !q ||
        a.bonusName.toLowerCase().includes(q) ||
        a.employeeName.toLowerCase().includes(q) ||
        a.employeeCode.toLowerCase().includes(q) ||
        (a.branchName || "").toLowerCase().includes(q) ||
        (a.departmentName || "").toLowerCase().includes(q) ||
        a.financialYearLabel.toLowerCase().includes(q) ||
        a.salaryPeriodLabel.toLowerCase().includes(q);

      return matchesBranch && matchesDepartment && matchesSearch;
    });

    return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
      const a = row as BonusAllocationUI;
      if (key === "bonusName") return a.bonusName ?? "";
      if (key === "financialYearLabel") return a.financialYearLabel ?? "";
      if (key === "salaryPeriodLabel") return a.salaryPeriodLabel ?? "";
      if (key === "branch") return a.branchName ?? "";
      if (key === "department") return a.departmentName ?? "";
      if (key === "employeeName") return a.employeeName ?? "";
      if (key === "employeeCode") return a.employeeCode ?? "";
      if (key === "createdAt") return a.createdAt ?? "";
      return "";
    });
  }, [allocations, table.search, table.sortBy, table.sortDir, branchFilter, departmentFilter]);

  const branchFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All branches" },
      ...branchList.map((b: any) => ({
        value: String(b.id),
        label: b.branchName || `Branch #${b.id}`,
      })),
    ],
    [branchList],
  );

  const departmentFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All departments" },
      ...visibleFilterDepartments.map((d: any) => ({
        value: String(d.id),
        label: d.departmentName || `Department #${d.id}`,
      })),
    ],
    [visibleFilterDepartments],
  );

  const allocationColumns = useMemo((): DataTableColumn<BonusAllocationUI>[] => [
    {
      key: "bonusName",
      header: "Bonus Name",
      sortable: true,
      colSpan: 2,
      cell: (a) => <span className="font-medium">{a.bonusName || "—"}</span>,
    },
    {
      key: "financialYearLabel",
      header: "Financial Year",
      sortable: true,
      colSpan: 1,
      cell: (a) => a.financialYearLabel || "—",
    },
    {
      key: "salaryPeriodLabel",
      header: "Salary Period",
      sortable: true,
      colSpan: 2,
      cell: (a) => a.salaryPeriodLabel || "—",
    },
    {
      key: "branch",
      header: "Branch",
      sortable: true,
      colSpan: 1,
      cell: (a) => a.branchName || "—",
    },
    {
      key: "department",
      header: "Department",
      sortable: true,
      colSpan: 1,
      cell: (a) => a.departmentName || "—",
    },
    {
      key: "employeeName",
      header: "Employee",
      sortable: true,
      colSpan: 2,
      cell: (a) => a.employeeName || "—",
    },
    {
      key: "employeeCode",
      header: "Employee ID",
      sortable: true,
      colSpan: 1,
      cell: (a) => a.employeeCode || "—",
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      colSpan: 1,
      cell: (a) => a.createdAt || "—",
    },
    {
      key: "actions",
      header: "Actions",
      colSpan: 1,
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
        title="Bonus Allocations"
        description="Manage bonus allocations"
        actions={
          !isDialogOpen && canManage ? (
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />
              Add Bonus Allocation
            </Button>
          ) : null
        }
      />
      <FormDrawer
        open={isDialogOpen}
        onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}
        title={editingAllocation ? "Edit Bonus Allocation" : "Add New Bonus Allocation"}
        description={editingAllocation ? "Update the bonus allocation information below." : "Fill in the details to add a new bonus allocation."}
      >
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Bonus Configuration</h3>
                  <div ref={bonusRef} className="space-y-2 relative">
                    <Label>Bonus Name *</Label>
                    <Input
                      value={formData.bonusAutocomplete}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((p) => ({ ...p, bonusAutocomplete: val, bonusSetupID: null }));
                        runFetchBonus(val);
                      }}
                      onFocus={(e) => {
                        const val = e.target.value;
                        if (val.length >= MIN_CHARS) runFetchBonus(val);
                      }}
                      placeholder="Start typing bonus name…"
                      autoComplete="off"
                      required
                    />
                    {bonusList.length > 0 && (
                      <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                        {bonusLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                        {bonusList.map((b) => (
                          <div
                            key={b.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData((p) => ({
                                ...p,
                                bonusSetupID: b.id,
                                bonusAutocomplete: b.bonusName ?? "",
                              }));
                              setBonusList([]);
                            }}
                          >
                            {b.bonusName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Period Configuration</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="financialYear">Financial Year *</Label>
                      <select
                        id="financialYear"
                        value={formData.financialYearLabel}
                        onChange={(e) => setFormData((p) => ({ ...p, financialYearLabel: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                        required
                      >
                        <option value="">Select Financial Year</option>
                        {financialYearOptions.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salaryPeriod">Salary Period *</Label>
                      <select
                        id="salaryPeriod"
                        value={formData.salaryPeriodLabel}
                        onChange={(e) => setFormData((p) => ({ ...p, salaryPeriodLabel: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                        required
                      >
                        <option value="">Select Salary Period</option>
                        {salaryPeriodOptions.map((period) => (
                          <option key={period} value={period}>{period}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

              <div className="space-y-4">
  <h3 className="text-lg font-semibold">Employee Filter</h3>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label>Branch *</Label>
      <select
        value={selectedBranchID}
        disabled={user?.role === "BRANCH_ADMIN"}
        onChange={(e) => {
          setSelectedBranchID(e.target.value);
          setSelectedDepartmentID("");
          setFormData((p) => ({
            ...p,
            branchName: branchList.find((b: any) => String(b.id) === e.target.value)?.branchName || "",
            departmentName: "",
            employeeAutocomplete: "",
            employeeDbID: null,
          }));
          setEmpList([]);
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-sm"
        required
      >
        <option value="">Select Branch</option>
        {branchList.map((b: any) => (
          <option key={b.id} value={String(b.id)}>
            {b.branchName}
          </option>
        ))}
      </select>
    </div>

    <div className="space-y-2">
      <Label>Department *</Label>
      <select
        value={selectedDepartmentID}
        disabled={!selectedBranchID}
        onChange={(e) => {
          setSelectedDepartmentID(e.target.value);
          setFormData((p) => ({
            ...p,
            departmentName: visibleFormDepartments.find((d: any) => String(d.id) === e.target.value)?.departmentName || "",
            employeeAutocomplete: "",
            employeeDbID: null,
          }));
          setEmpList([]);
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-sm"
        required
      >
        <option value="">Select Department</option>
        {visibleFormDepartments.map((d: any) => (
          <option key={d.id} value={String(d.id)}>
            {d.departmentName}
          </option>
        ))}
      </select>
    </div>
  </div>
</div>

<div className="space-y-4">
  <h3 className="text-lg font-semibold">Employee Selection</h3>
                  <div ref={empRef} className="space-y-2 relative">
                    <Label>Employee *</Label>
                    <Input
                      value={formData.employeeAutocomplete}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((p) => ({ ...p, employeeAutocomplete: val, employeeDbID: null }));
                        runFetchEmployees(val);
                      }}
                      onFocus={(e) => {
                        const val = e.target.value;
                        if (val.length >= MIN_CHARS) runFetchEmployees(val);
                      }}
                      placeholder="Type name or employee code…"
                      autoComplete="off"
                      required
                    />
                    {empList.length > 0 && (
                      <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                        {empLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                        {empList.map((emp) => {
                          const name = `${(emp.employeeFirstName ?? "").trim()} ${(emp.employeeLastName ?? "").trim()}`.trim();
                          return (
                            <div
                              key={emp.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setFormData((p) => ({
                                  ...p,
                                  employeeDbID: emp.id,
                                  employeeAutocomplete: name ? `${name} (${emp.employeeID})` : `(${emp.employeeID})`,
                                }));
                                setEmpList([]);
                              }}
                            >
                              {name || "(No name)"} <span className="text-gray-500">({emp.employeeID})</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingAllocation ? "Update Bonus Allocation" : "Add Bonus Allocation"}
                  </Button>
                </div>
              </form>
      </FormDrawer>

      {!isDialogOpen && (
        <>
          <FilterBar
            search={{
              value: table.search,
              onChange: table.setSearch,
              placeholder: "Search bonus allocations…",
            }}
            filters={
              <>
                <FilterSelect
                  id="bonus-allocations-branch"
                  value={branchFilter}
                  onChange={handleBranchFilterChange}
                  options={branchFilterOptions}
                  width="w-56"
                  ariaLabel="Filter by branch"
                />
                <FilterSelect
                  id="bonus-allocations-department"
                  value={departmentFilter}
                  onChange={setDepartmentFilter}
                  options={departmentFilterOptions}
                  width="w-56"
                  ariaLabel="Filter by department"
                />
              </>
            }
          />

          <EntityListShell
            title="All bonus allocations"
            columns={allocationColumns}
            rows={filteredAllocations}
            rowKey={(a) => a.id}
            isLoading={listLoading}
            sortBy={table.sortBy}
            sortDir={table.sortDir}
            onSort={table.setSort}
            emptyIcon={Wallet}
            emptyTitle="No bonus allocations found"
            emptyDescription="Try adjusting your search or filters."
            emptyAction={
              canManage ? (
                <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-1" /> Add Bonus Allocation
                </Button>
              ) : undefined
            }
          />
        </>
      )}
    </div>
  );
}

function debounce<T extends (...args: any[]) => any>(fn: T, ms = 300) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}