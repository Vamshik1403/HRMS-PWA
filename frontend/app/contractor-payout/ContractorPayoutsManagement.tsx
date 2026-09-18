"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { hasModuleWriteAccess, isCompanyAdminLikeRole } from "@/lib/companyAccess";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Plus, IndianRupee, X } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { NoticeBanner } from "../components/ui/notice-banner";
import { getSidebarContext } from "../utils/sidebarContext";
import { FormDrawer } from "../components/ui/form-drawer";
import { PageHeader } from "../components/app/page-header";
import { FilterBar } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import { EntityRowActions } from "../components/app/entity-row-actions";
import type { DataTableColumn } from "../components/app/data-table";
import { useClientTable, sortRows } from "../hooks/use-client-table";

// ─── Types ──────────────────────────────────────────────────
interface Contractor {
  id: number;
  contractorName?: string | null;
  companyID?: number | null;
  serviceProviderID?: number | null;
}
interface Branch {
  id: number;
  branchName?: string | null;
  companyID?: number | null;
  serviceProviderID?: number | null;
}
interface Department {
  id: number;
  departmentName?: string | null;
  branchesID?: number | null;
}
interface Designation {
  id: number;
  designation?: string | null;
  departmentID?: number | null;
}
interface Employee {
  id: number;
  companyID?: number | null;
  branchesID?: number | null;
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
  employeeID?: string | null;
  workShiftID?: number | null;
  contractorID?: number | null;
  designationID?: number | null;
  empContractor?: { contractorID: number }[];
  empWorkShift?: { workShiftID: number }[];
}
interface Workshift {
  id: number;
  workShiftName?: string | null;
}
interface RateCard {
  id: number;
  branchName?: string | null;
  departmentName?: string | null;
  designation?: string | null;
  workShiftName?: string | null;
  payoutType?: string | null;
  perHourRate?: number | null;
  perDayRate?: number | null;
  perMonthRate?: number | null;
}
interface PayoutRecord {
  id: number;
  contractorID: number;
  branchID?: number | null;
  departmentIDs?: string | null;
  designationIDs?: string | null;
  employeeIDs?: string | null;
  workshiftIDs?: string | null;
  rateCardID?: number | null;
  contractor?: { contractorName?: string | null };
}

const API_BASE = {
  contractors: "/backend/contractors",
  branches: "/backend/branches",
  departments: "/backend/departments",
  designations: "/backend/designations",
  employees: "/backend/manage-emp",
  workshifts: "/backend/work-shift",
  payout: "/backend/contractor-payout",
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const raw = await res.json();
  return (raw?.data ?? raw) as T;
}

// ─── useSearchSuggest (same pattern as ContractorRatesManagement) ─────────────
function useSearchSuggest<T>(items: T[], labelFn: (item: T) => string) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = items.filter((item) =>
    labelFn(item).toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return { query, setQuery, open, setOpen, ref, filtered };
}

// ─── Single suggest field (text input + dropdown, same as ContractorRatesManagement) ──
interface SingleSuggestProps<T> {
  label: string;
  required?: boolean;
  suggest: ReturnType<typeof useSearchSuggest<T>>;
  labelFn: (item: T) => string;
  onSelect: (item: T) => void;
  selectedLabel: string | null;
  onClear: () => void;
  disabled: boolean;
  disabledPlaceholder: string;
}

function SingleSuggestField<T>({
  label,
  required,
  suggest,
  labelFn,
  onSelect,
  selectedLabel,
  onClear,
  disabled,
  disabledPlaceholder,
}: SingleSuggestProps<T>) {
  return (
    <div ref={suggest.ref} className="space-y-1 relative">
      <label className="text-xs font-medium text-gray-500 block">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <Input
          value={selectedLabel !== null ? selectedLabel : suggest.query}
          onChange={(e) => {
            if (selectedLabel !== null) return;
            suggest.setQuery(e.target.value);
            suggest.setOpen(true);
          }}
          onFocus={() => {
            if (selectedLabel !== null || disabled) return;
            suggest.setOpen(true);
          }}
          placeholder={disabled ? disabledPlaceholder : `Search ${label.toLowerCase()}…`}
          autoComplete="off"
          disabled={disabled}
          readOnly={selectedLabel !== null}
          className={selectedLabel !== null ? "pr-20 cursor-default bg-gray-50" : ""}
        />
        {selectedLabel !== null && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#4f46e5] hover:text-[#4338ca] font-medium px-1 py-0.5 rounded"
          >
            Change
          </button>
        )}
      </div>
      {suggest.open && !disabled && selectedLabel === null && suggest.filtered.length > 0 && (
        <div className="absolute z-30 bg-white border rounded w-full shadow max-h-48 overflow-y-auto mt-1">
          {suggest.filtered.slice(0, 20).map((item: any) => (
            <div
              key={item.id}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(item);
                suggest.setQuery(labelFn(item));
                suggest.setOpen(false);
              }}
            >
              {labelFn(item)}
            </div>
          ))}
        </div>
      )}
      {suggest.open && !disabled && selectedLabel === null && suggest.filtered.length === 0 && suggest.query.length > 0 && (
        <div className="absolute z-30 bg-white border rounded w-full shadow mt-1 px-3 py-2 text-sm text-gray-400">
          No results for &quot;{suggest.query}&quot;
        </div>
      )}
    </div>
  );
}

// ─── Multi suggest field (text input + checkbox dropdown + chips) ─────────────
interface MultiSuggestFieldProps<T> {
  label: string;
  items: T[];
  selected: T[];
  labelFn: (item: T) => string;
  keyFn: (item: T) => number;
  onAdd: (item: T) => void;
  onRemove: (item: T) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  allSelected: boolean;
  disabled: boolean;
  disabledPlaceholder: string;
}

function MultiSuggestField<T>({
  label,
  items,
  selected,
  labelFn,
  keyFn,
  onAdd,
  onRemove,
  onSelectAll,
  onClearAll,
  allSelected,
  disabled,
  disabledPlaceholder,
}: MultiSuggestFieldProps<T>) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter((item) =>
    labelFn(item).toLowerCase().includes(query.toLowerCase())
  );
  const selectedKeys = new Set(selected.map(keyFn));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleToggle = (item: T) => {
    if (selectedKeys.has(keyFn(item))) onRemove(item);
    else onAdd(item);
  };

  const inputPlaceholder = disabled
    ? disabledPlaceholder
    : allSelected
    ? "ALL selected — click to change"
    : selected.length > 0
    ? `${selected.length} selected — search to add more`
    : `Search ${label.toLowerCase()}…`;

  return (
    <div ref={ref} className="space-y-1">
      <label className="text-xs font-medium text-gray-500 block">{label}</label>
      <Input
        ref={inputRef}
        value={open ? query : ""}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { if (!disabled) setOpen(true); }}
        placeholder={inputPlaceholder}
        autoComplete="off"
        disabled={disabled}
      />
      {open && !disabled && (
        <div className="relative">
          <div className="absolute z-30 bg-white border rounded w-full shadow mt-0" style={{ minWidth: 200 }}>
            <div className="flex items-center gap-2 px-2 py-1.5 border-b">
              <input
                autoFocus
                className="flex-1 rounded border px-2 py-1 text-sm outline-none"
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                type="button"
                className="text-xs text-[#4f46e5] hover:underline whitespace-nowrap font-medium"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { allSelected ? onClearAll() : onSelectAll(); }}
              >
                {allSelected ? "Clear ALL" : "Select ALL"}
              </button>
            </div>
            <div className="max-h-44 overflow-y-auto p-1">
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-400">No results</div>
              )}
              {filtered.map((item) => {
                const checked = allSelected || selectedKeys.has(keyFn(item));
                return (
                  <div
                    key={keyFn(item)}
                    className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer hover:bg-[#eef2ff] ${checked ? "text-[#4f46e5] font-medium" : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleToggle(item)}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={checked}
                      className="accent-[#4f46e5]"
                    />
                    <span>{labelFn(item)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Selected chips */}
      {(allSelected || selected.length > 0) && (
        <div className="flex flex-wrap gap-1 mt-1">
          {allSelected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#eef2ff] px-2 py-0.5 text-xs text-[#4f46e5] font-medium">
              ALL
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClearAll} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          ) : (
            selected.map((item) => (
              <span
                key={keyFn(item)}
                className="inline-flex items-center gap-1 rounded-full bg-[#eef2ff] px-2 py-0.5 text-xs text-[#4f46e5]"
              >
                {labelFn(item)}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onRemove(item)} className="hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────
export function ContractorPayoutsManagement() {
  const user = useCurrentUser();
  const canManage =
    user?.role === "SUPERADMIN" ||
    user?.role === "SERVICE_PROVIDER" ||
    isCompanyAdminLikeRole(user?.role) ||
    hasModuleWriteAccess("CONTRACTORS");

  // Master data (loaded once, filtered client-side)
  const [allContractors, setAllContractors] = useState<Contractor[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [allDesignations, setAllDesignations] = useState<Designation[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [allWorkshifts, setAllWorkshifts] = useState<Workshift[]>([]);

  // Context-filtered options per step
  const [branchOptions, setBranchOptions] = useState<Branch[]>([]);
  const [deptOptions, setDeptOptions] = useState<Department[]>([]);
  const [desigOptions, setDesigOptions] = useState<Designation[]>([]);
  const [empOptions, setEmpOptions] = useState<Employee[]>([]);
  const [shiftOptions, setShiftOptions] = useState<Workshift[]>([]);

  // Selections
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedDepts, setSelectedDepts] = useState<Department[]>([]);
  const [allDeptsSelected, setAllDeptsSelected] = useState(false);
  const [selectedDesigs, setSelectedDesigs] = useState<Designation[]>([]);
  const [allDesigSelected, setAllDesigSelected] = useState(false);
  const [selectedEmps, setSelectedEmps] = useState<Employee[]>([]);
  const [allEmpsSelected, setAllEmpsSelected] = useState(false);
  const [selectedShifts, setSelectedShifts] = useState<Workshift[]>([]);
  const [allShiftsSelected, setAllShiftsSelected] = useState(false);

  // Report type & period
  const [reportType, setReportType] = useState<string>("");
  const [periodFrom, setPeriodFrom] = useState<string>("");
  const [periodTo, setPeriodTo] = useState<string>("");

  // Rate cards & UI state
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [rateCardLoading, setRateCardLoading] = useState(false);
  const [payoutRecords, setPayoutRecords] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const table = useClientTable("contractor");

  // Search suggest hooks for single selects
  const contrSuggest = useSearchSuggest(allContractors, (c) => c.contractorName || "");
  const branchSuggest = useSearchSuggest(branchOptions, (b) => b.branchName || "");

  // ── Load all master data on mount ──
  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetchJSON<Contractor[]>(API_BASE.contractors),
      fetchJSON<Branch[]>(API_BASE.branches),
      fetchJSON<Department[]>(API_BASE.departments),
      fetchJSON<Designation[]>(API_BASE.designations),
      fetchJSON<Employee[]>(API_BASE.employees),
      fetchJSON<Workshift[]>(API_BASE.workshifts),
    ])
      .then(([contractors, branches, departments, designations, employees, workshifts]) => {
        const ctx = getSidebarContext();
        const companyID = ctx?.companyID;
        const spID = ctx?.serviceProviderID;

        // Filter contractors & branches by company context
        let filteredContractors = contractors as Contractor[];
        let filteredBranches = branches as Branch[];

        if (companyID) {
          filteredContractors = filteredContractors.filter(
            (c: any) => c.companyID === companyID
          );
          filteredBranches = filteredBranches.filter((b) => b.companyID === companyID);
        } else if (spID) {
          filteredContractors = filteredContractors.filter(
            (c: any) => c.serviceProviderID === spID
          );
          filteredBranches = filteredBranches.filter((b) => (b as any).serviceProviderID === spID);
        }

const activeCompanyID = companyID ? Number(companyID) : null;
const contractorIDSet = new Set(filteredContractors.map((c) => Number(c.id)));

const filteredEmps = (employees as Employee[]).filter((e: any) => {
  const belongsToActiveCompany =
    !activeCompanyID || Number(e.companyID) === Number(activeCompanyID);

  const belongsToContractor =
    (e.contractorID != null && contractorIDSet.has(Number(e.contractorID))) ||
    (e.empContractor ?? []).some((ec: any) =>
      contractorIDSet.has(Number(ec.contractorID))
    );

  // If contractor mapping exists, use it.
  // If not, still keep employee if company matches.
return belongsToActiveCompany;
});
        // Keep departments, designations, and workshifts unfiltered — they are scoped
        // naturally by the cascade (branch → dept → desig → emp) and pre-filtering
        // them breaks employee lookup when designation records don't perfectly trace
        // back through the branch chain (duplicated data scenario).
        setAllContractors(filteredContractors);
        setAllBranches(filteredBranches);
        setAllDepartments(departments as Department[]);
        setAllDesignations(designations as Designation[]);
        setAllEmployees(filteredEmps);
        setAllWorkshifts(workshifts as Workshift[]);
      })
      .catch(() => toast.error("Failed to load data"));
  }, [user]);

  // ── Load payout records ──
  const loadPayoutRecords = useCallback(() => {
    setLoading(true);
    fetchJSON<PayoutRecord[]>(API_BASE.payout)
      .then(setPayoutRecords)
      .catch(() => toast.error("Failed to load payout records"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPayoutRecords(); }, [loadPayoutRecords]);

  useEffect(() => {
  const handler = () => {
    setSelectedContractor(null);
    setSelectedBranch(null);
    setSelectedDepts([]);
    setSelectedDesigs([]);
    setSelectedEmps([]);
    setSelectedShifts([]);

    setAllDeptsSelected(false);
    setAllDesigSelected(false);
    setAllEmpsSelected(false);
    setAllShiftsSelected(false);

    setBranchOptions([]);
    setDeptOptions([]);
    setDesigOptions([]);
    setEmpOptions([]);
    setShiftOptions([]);
    setRateCards([]);

    contrSuggest.setQuery("");
    branchSuggest.setQuery("");
  };

  window.addEventListener("sidebar-context-changed", handler);
  window.addEventListener("app-data-refresh", handler);

  return () => {
    window.removeEventListener("sidebar-context-changed", handler);
    window.removeEventListener("app-data-refresh", handler);
  };
}, []);

  // ── Reset helpers ──
  const resetFromBranch = () => {
    setSelectedBranch(null);
    branchSuggest.setQuery("");
    setBranchOptions([]);
    resetFromDept();
  };
  const resetFromDept = () => {
    setSelectedDepts([]); setAllDeptsSelected(false); setDeptOptions([]);
    resetFromDesig();
  };
  const resetFromDesig = () => {
    setSelectedDesigs([]); setAllDesigSelected(false); setDesigOptions([]);
    resetFromEmp();
  };
  const resetFromEmp = () => {
    setSelectedEmps([]); setAllEmpsSelected(false); setEmpOptions([]);
    resetFromShift();
  };
  const resetFromShift = () => {
    setSelectedShifts([]); setAllShiftsSelected(false); setShiftOptions([]);
    setRateCards([]);
  };

  // ── Contractor selected ──
  const handleSelectContractor = (c: Contractor) => {
    setSelectedContractor(c);
    contrSuggest.setQuery(c.contractorName || "");
    contrSuggest.setOpen(false);
    resetFromBranch();
    // contractor.companyID may be null for SP-level contractors → fall back to sidebar context
    const ctx = getSidebarContext();
    const targetCompanyID = c.companyID ?? ctx?.companyID ?? null;
    const ctxBranches = targetCompanyID
      ? allBranches.filter((b) => b.companyID === targetCompanyID)
      : allBranches.filter((b) => b.serviceProviderID === c.serviceProviderID);
    setBranchOptions(ctxBranches);
  };

  // ── Branch selected ──
  const handleSelectBranch = (b: Branch) => {
    setSelectedBranch(b);
    branchSuggest.setQuery(b.branchName || "");
    branchSuggest.setOpen(false);
    resetFromDept();
    // Deduplicate departments by name — multiple DB records can share the same name
const raw = allDepartments.filter(
  (d: any) => Number(d.branchesID) === Number(b.id)
);

const seen = new Set<string>();
    setDeptOptions(
      raw.filter((d) => {
        const key = (d.departmentName || "").toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
    );
  };

  // ── Departments ──
  const getEffectiveDeptIDs = useCallback(
    () => (allDeptsSelected ? deptOptions.map((d) => d.id) : selectedDepts.map((d) => d.id)),
    [allDeptsSelected, deptOptions, selectedDepts]
  );

  const applyDeptChange = (depts: Department[], allSel: boolean, branchForExpand?: Branch | null) => {
    setSelectedDepts(depts);
    setAllDeptsSelected(allSel);
    resetFromDesig();
    const selectedNames = new Set(
      (allSel ? deptOptions : depts).map((d) => (d.departmentName || "").toLowerCase().trim())
    );
    if (!selectedNames.size) return;
    // Expand: find ALL dept IDs with matching names in this branch (handles duplicate DB records)
    const branchID = (branchForExpand ?? selectedBranch)?.id;
    const allMatchingDeptIDs = allDepartments
      .filter((d) => d.branchesID === branchID && selectedNames.has((d.departmentName || "").toLowerCase().trim()))
      .map((d) => d.id);
    const rawDesigs = allDesignations.filter(
      (d) => d.departmentID != null && allMatchingDeptIDs.includes(d.departmentID)
    );
    // Deduplicate designations by name
    const seenD = new Set<string>();
    setDesigOptions(
      rawDesigs.filter((d) => {
        const key = (d.designation || "").toLowerCase().trim();
        if (seenD.has(key)) return false;
        seenD.add(key);
        return true;
      })
    );
  };
  const handleAddDept = (d: Department) => {
    if (!selectedDepts.find((x) => x.id === d.id)) applyDeptChange([...selectedDepts, d], false);
  };
  const handleRemoveDept = (d: Department) => applyDeptChange(selectedDepts.filter((x) => x.id !== d.id), false);
  const handleSelectAllDepts = () => applyDeptChange([], true);
  const handleClearAllDepts = () => applyDeptChange([], false);

  // ── Designations ──
  const getEffectiveDesigIDs = useCallback(
    () => (allDesigSelected ? desigOptions.map((d) => d.id) : selectedDesigs.map((d) => d.id)),
    [allDesigSelected, desigOptions, selectedDesigs]
  );

  const applyDesigChange = (desigs: Designation[], allSel: boolean) => {
    setSelectedDesigs(desigs);
    setAllDesigSelected(allSel);
    resetFromEmp();
    const selectedNames = new Set(
      (allSel ? desigOptions : desigs).map((d) => (d.designation || "").toLowerCase().trim())
    );
    if (!selectedNames.size) return;
    // Expand: find ALL desig IDs with matching names (handles duplicate DB records)
  const selectedDeptNames = new Set(
  getEffectiveDeptIDs()
    .map((id) => allDepartments.find((d) => Number(d.id) === Number(id))?.departmentName)
    .filter(Boolean)
    .map((name) => String(name).toLowerCase().trim())
);

const branchID = selectedBranch?.id;

const branchDeptIDs = allDepartments
  .filter(
    (d: any) =>
      Number(d.branchesID) === Number(branchID) &&
      selectedDeptNames.has(String(d.departmentName || "").toLowerCase().trim())
  )
  .map((d) => Number(d.id));

const allMatchingDesigIDs = allDesignations
  .filter(
    (d: any) =>
      d.departmentID != null &&
      branchDeptIDs.includes(Number(d.departmentID)) &&
      selectedNames.has(String(d.designation || "").toLowerCase().trim())
  )
  .map((d) => Number(d.id));
    const selectedContractorID = selectedContractor?.id;
const ctx = getSidebarContext();
const activeCompanyID = ctx?.companyID ?? null;
const activeBranchID = selectedBranch?.id ?? null;

setEmpOptions(
  allEmployees.filter((e: any) => {
    const companyOk =
      !activeCompanyID || Number(e.companyID) === Number(activeCompanyID);

    const branchOk =
      !activeBranchID || Number(e.branchesID) === Number(activeBranchID);

    const designationOk =
  allMatchingDesigIDs.length === 0 ||
  (
    e.designationID != null &&
    allMatchingDesigIDs.includes(Number(e.designationID))
  );

const contractorOk =
  !selectedContractorID ||
  Number(e.contractorID) === Number(selectedContractorID) ||
  (e.empContractor ?? []).some(
    (ec: any) => Number(ec.contractorID) === Number(selectedContractorID)
  ) ||
  e.contractorID == null;

return companyOk && branchOk && designationOk && contractorOk;
  })
);
  };
  const handleAddDesig = (d: Designation) => {
    if (!selectedDesigs.find((x) => x.id === d.id)) applyDesigChange([...selectedDesigs, d], false);
  };
  const handleRemoveDesig = (d: Designation) => applyDesigChange(selectedDesigs.filter((x) => x.id !== d.id), false);
  const handleSelectAllDesigs = () => applyDesigChange([], true);
  const handleClearAllDesigs = () => applyDesigChange([], false);

  // ── Employees ──
  const getEffectiveEmpIDs = useCallback(
    () => (allEmpsSelected ? empOptions.map((e) => e.id) : selectedEmps.map((e) => e.id)),
    [allEmpsSelected, empOptions, selectedEmps]
  );

  const applyEmpChange = (emps: Employee[], allSel: boolean) => {
    setSelectedEmps(emps);
    setAllEmpsSelected(allSel);
    resetFromShift();
    const list = allSel ? empOptions : emps;
    // workShiftID scalar is often null; also check empWorkShift junction array
    const shiftIDSet = new Set<number>();
    list.forEach((e) => {
      if (e.workShiftID != null) shiftIDSet.add(e.workShiftID);
      (e.empWorkShift ?? []).forEach((ew) => shiftIDSet.add(ew.workShiftID));
    });
    if (shiftIDSet.size) {
      const rawShifts = allWorkshifts.filter((w) => shiftIDSet.has(w.id));
      // Deduplicate workshifts by name
      const seenS = new Set<string>();
      setShiftOptions(
        rawShifts.filter((w) => {
          const key = (w.workShiftName || "").toLowerCase().trim();
          if (seenS.has(key)) return false;
          seenS.add(key);
          return true;
        })
      );
    }
  };
  const handleAddEmp = (e: Employee) => {
    if (!selectedEmps.find((x) => x.id === e.id)) applyEmpChange([...selectedEmps, e], false);
  };
  const handleRemoveEmp = (e: Employee) => applyEmpChange(selectedEmps.filter((x) => x.id !== e.id), false);
  const handleSelectAllEmps = () => applyEmpChange([], true);
  const handleClearAllEmps = () => applyEmpChange([], false);

  // ── Workshifts → auto-fetch rate card ──
  const applyShiftChange = async (shifts: Workshift[], allSel: boolean) => {
    setSelectedShifts(shifts);
    setAllShiftsSelected(allSel);
    setRateCards([]);
    if (!selectedContractor) return;
    const shiftIDs = allSel ? shiftOptions.map((w) => w.id) : shifts.map((w) => w.id);
    if (!shiftIDs.length) return;

    setRateCardLoading(true);
    try {
      const params = new URLSearchParams({ contractorID: String(selectedContractor.id) });
      if (selectedBranch) params.set("branchID", String(selectedBranch.id));
      const deptIDs = getEffectiveDeptIDs();
      const desigIDs = getEffectiveDesigIDs();
      if (deptIDs.length) params.set("departmentIDs", deptIDs.join(","));
      if (desigIDs.length) params.set("designationIDs", desigIDs.join(","));
      params.set("workshiftIDs", shiftIDs.join(","));
      const data = await fetchJSON<RateCard[]>(`${API_BASE.payout}/filter/rate-card?${params}`);
      setRateCards(data);
    } catch {
      toast.error("Failed to fetch rate card");
    } finally {
      setRateCardLoading(false);
    }
  };
  const handleAddShift = (w: Workshift) => {
    if (!selectedShifts.find((x) => x.id === w.id)) applyShiftChange([...selectedShifts, w], false);
  };
  const handleRemoveShift = (w: Workshift) => applyShiftChange(selectedShifts.filter((x) => x.id !== w.id), false);
  const handleSelectAllShifts = () => applyShiftChange([], true);
  const handleClearAllShifts = () => applyShiftChange([], false);

  // ── Save ──
  const handleSave = async () => {
    if (!selectedContractor) { toast.error("Please select a contractor first"); return; }
    if (!reportType) { toast.error("Please select a report type"); return; }
    if (!periodFrom) { toast.error("Please select a period from date"); return; }
    if (!periodTo) { toast.error("Please select a period to date"); return; }
    if (periodFrom > periodTo) { toast.error("Period From date must be before Period To date"); return; }
    setSaving(true);
    try {
      const deptIDs = getEffectiveDeptIDs();
      const desigIDs = getEffectiveDesigIDs();
      const empIDs = getEffectiveEmpIDs();
      const shiftIDs = allShiftsSelected ? shiftOptions.map((w) => w.id) : selectedShifts.map((w) => w.id);
      const payload = {
        contractorID: selectedContractor.id,
        branchID: selectedBranch?.id ?? null,
        departmentIDs: deptIDs.length ? JSON.stringify(deptIDs) : null,
        designationIDs: desigIDs.length ? JSON.stringify(desigIDs) : null,
        employeeIDs: empIDs.length ? JSON.stringify(empIDs) : null,
        workshiftIDs: shiftIDs.length ? JSON.stringify(shiftIDs) : null,
        rateCardID: rateCards.length > 0 ? rateCards[0].id : null,
      };
      const res = await fetch(API_BASE.payout, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Payout configuration saved");
      loadPayoutRecords();
      setSelectedContractor(null);
      contrSuggest.setQuery("");
      resetFromBranch();
      setReportType("");
      setPeriodFrom("");
      setPeriodTo("");
      setFormOpen(false);    } catch (err: any) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this payout configuration?")) return;
    try {
      const res = await fetch(`${API_BASE.payout}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Deleted");
      loadPayoutRecords();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const empLabel = (e: Employee) =>
    `${e.employeeFirstName || ""} ${e.employeeLastName || ""}`.trim() || `Emp #${e.id}`;

  const hasShiftSelected = selectedShifts.length > 0 || allShiftsSelected;

  const parseIds = (raw?: string | null) => {
    if (!raw) return [] as number[];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(Number).filter(Boolean) : [];
    } catch {
      return [];
    }
  };

  const nameList = (ids: number[], lookup: Map<number, string>) => {
    if (!ids.length) return "—";
    return ids.map((id) => lookup.get(id) || `#${id}`).join(", ");
  };

  const branchNameById = useMemo(() => {
    const map = new Map<number, string>();
    allBranches.forEach((b) => map.set(b.id, b.branchName || `#${b.id}`));
    return map;
  }, [allBranches]);

  const deptNameById = useMemo(() => {
    const map = new Map<number, string>();
    allDepartments.forEach((d) => map.set(d.id, d.departmentName || `#${d.id}`));
    return map;
  }, [allDepartments]);

  const desigNameById = useMemo(() => {
    const map = new Map<number, string>();
    allDesignations.forEach((d) => map.set(d.id, d.designation || `#${d.id}`));
    return map;
  }, [allDesignations]);

  const empNameById = useMemo(() => {
    const map = new Map<number, string>();
    allEmployees.forEach((e) => map.set(e.id, empLabel(e)));
    return map;
  }, [allEmployees]);

  const shiftNameById = useMemo(() => {
    const map = new Map<number, string>();
    allWorkshifts.forEach((w) => map.set(w.id, w.workShiftName || `#${w.id}`));
    return map;
  }, [allWorkshifts]);

  const filteredRecords = useMemo(() => {
    const q = table.search.trim().toLowerCase();
    const filtered = payoutRecords.filter((r) => {
      if (!q) return true;
      const contractor = (r.contractor?.contractorName || `#${r.contractorID}`).toLowerCase();
      const branch = String(branchNameById.get(r.branchID || -1) || r.branchID || "").toLowerCase();
      return contractor.includes(q) || branch.includes(q) || String(r.rateCardID || "").includes(q);
    });
    return sortRows(filtered, table.sortBy, table.sortDir, (row, key) => {
      if (key === "contractor") return row.contractor?.contractorName || String(row.contractorID);
      if (key === "branch") return branchNameById.get(row.branchID || -1) || String(row.branchID || "");
      if (key === "rateCard") return String(row.rateCardID || "");
      return String((row as any)[key] ?? "");
    });
  }, [payoutRecords, table.search, table.sortBy, table.sortDir, branchNameById]);

  const payoutColumns = useMemo((): DataTableColumn<PayoutRecord>[] => [
    {
      key: "contractor",
      header: "Contractor",
      sortable: true,
      cell: (r) => r.contractor?.contractorName || `#${r.contractorID}`,
    },
    {
      key: "branch",
      header: "Branch",
      sortable: true,
      cell: (r) => (r.branchID ? branchNameById.get(r.branchID) || `#${r.branchID}` : "—"),
    },
    {
      key: "departments",
      header: "Departments",
      cell: (r) => nameList(parseIds(r.departmentIDs), deptNameById),
    },
    {
      key: "designations",
      header: "Designations",
      cell: (r) => nameList(parseIds(r.designationIDs), desigNameById),
    },
    {
      key: "employees",
      header: "Employees",
      cell: (r) => nameList(parseIds(r.employeeIDs), empNameById),
    },
    {
      key: "workshifts",
      header: "Workshifts",
      cell: (r) => nameList(parseIds(r.workshiftIDs), shiftNameById),
    },
    {
      key: "rateCard",
      header: "Rate Card",
      sortable: true,
      cell: (r) =>
        r.rateCardID ? (
          <Badge variant="secondary" className="bg-[#eef2ff] text-[#4f46e5]">
            #{r.rateCardID}
          </Badge>
        ) : (
          "—"
        ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (r) =>
        canManage ? (
          <EntityRowActions
            onDelete={() => handleDelete(r.id)}
            deleteTitle="Delete configuration"
            confirmDelete={false}
          />
        ) : null,
    },
  ], [branchNameById, canManage, deptNameById, desigNameById, empNameById, shiftNameById]);

  const openGenerateForm = () => {
    setSelectedContractor(null);
    contrSuggest.setQuery("");
    resetFromBranch();
    setReportType("");
    setPeriodFrom("");
    setPeriodTo("");
    setFormOpen(true);
  };

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={IndianRupee}
        title="Contractor Payouts"
        description="Configure payout assignments for contractors by selecting filters and auto-fetching the rate card."
        actions={
          canManage && !formOpen ? (
            <Button onClick={openGenerateForm}>
              <Plus className="w-4 h-4 mr-1" />
              Generate Statement
            </Button>
          ) : null
        }
      />

      <FormDrawer
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setSelectedContractor(null);
            contrSuggest.setQuery("");
            resetFromBranch();
            setReportType("");
            setPeriodFrom("");
            setPeriodTo("");
          }
        }}
        title="Generate Contractor Payout Statement"
        description="Select filters to auto-fetch the rate card and save the payout configuration."
        showHeaderCancel
      >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* 1. Contractor */}
              <SingleSuggestField<Contractor>
                label="Contractor"
                required
                suggest={contrSuggest}
                labelFn={(c) => c.contractorName || ""}
                onSelect={handleSelectContractor}
                selectedLabel={selectedContractor ? (selectedContractor.contractorName || `#${selectedContractor.id}`) : null}
                onClear={() => { setSelectedContractor(null); contrSuggest.setQuery(""); resetFromBranch(); }}
                disabled={false}
                disabledPlaceholder=""
              />

              {/* 2. Branch */}
              <SingleSuggestField<Branch>
                label="Branch"
                suggest={branchSuggest}
                labelFn={(b) => b.branchName || ""}
                onSelect={handleSelectBranch}
                selectedLabel={selectedBranch ? (selectedBranch.branchName || `#${selectedBranch.id}`) : null}
                onClear={() => { setSelectedBranch(null); branchSuggest.setQuery(""); resetFromDept(); }}
                disabled={!selectedContractor}
                disabledPlaceholder="Select contractor first"
              />

              {/* 3. Department */}
              <MultiSuggestField<Department>
                label="Department"
                items={deptOptions}
                selected={selectedDepts}
                labelFn={(d) => d.departmentName || ""}
                keyFn={(d) => d.id}
                onAdd={handleAddDept}
                onRemove={handleRemoveDept}
                onSelectAll={handleSelectAllDepts}
                onClearAll={handleClearAllDepts}
                allSelected={allDeptsSelected}
                disabled={!selectedBranch}
                disabledPlaceholder="Select branch first"
              />

              {/* 4. Designation */}
              <MultiSuggestField<Designation>
                label="Designation"
                items={desigOptions}
                selected={selectedDesigs}
                labelFn={(d) => d.designation || ""}
                keyFn={(d) => d.id}
                onAdd={handleAddDesig}
                onRemove={handleRemoveDesig}
                onSelectAll={handleSelectAllDesigs}
                onClearAll={handleClearAllDesigs}
                allSelected={allDesigSelected}
                disabled={!selectedDepts.length && !allDeptsSelected}
                disabledPlaceholder="Select department first"
              />

              {/* 5. Employee */}
              <MultiSuggestField<Employee>
                label="Employee Name"
                items={empOptions}
                selected={selectedEmps}
                labelFn={empLabel}
                keyFn={(e) => e.id}
                onAdd={handleAddEmp}
                onRemove={handleRemoveEmp}
                onSelectAll={handleSelectAllEmps}
                onClearAll={handleClearAllEmps}
                allSelected={allEmpsSelected}
                disabled={!selectedDesigs.length && !allDesigSelected}
                disabledPlaceholder="Select designation first"
              />

              {/* 6. Workshift */}
              <MultiSuggestField<Workshift>
                label="Select Workshifts"
                items={shiftOptions}
                selected={selectedShifts}
                labelFn={(w) => w.workShiftName || ""}
                keyFn={(w) => w.id}
                onAdd={handleAddShift}
                onRemove={handleRemoveShift}
                onSelectAll={handleSelectAllShifts}
                onClearAll={handleClearAllShifts}
                allSelected={allShiftsSelected}
                disabled={!selectedEmps.length && !allEmpsSelected}
                disabledPlaceholder="Select employee(s) first"
              />

              {/* 7. Report Type */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 block">
                  Report Type <span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Select report type…</option>
                  <option value="working_hours_summary">Working Hours Summary Report</option>
                  <option value="payout_report">Payout Report</option>
                </select>
              </div>

              {/* 8. Period From */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 block">
                  Period From <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="date"
                  value={periodFrom}
                  onChange={(e) => setPeriodFrom(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>

              {/* 9. Period To */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 block">
                  Period To <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="date"
                  value={periodTo}
                  onChange={(e) => setPeriodTo(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>

            </div>

            {/* Rate Card */}
            {rateCardLoading && (
              <div className="mt-4 text-sm text-gray-500 text-center py-3">Fetching rate card…</div>
            )}
            {!rateCardLoading && rateCards.length > 0 && (
              <div className="mt-5 rounded-lg border border-[#4f46e5]/20 bg-[#f5f3ff] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <IndianRupee className="w-4 h-4 text-[#4f46e5]" />
                  <span className="text-sm font-semibold text-[#4f46e5]">
                    Auto-fetched Rate Card{rateCards.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-2">
                  {rateCards.map((rc) => (
                    <div key={rc.id} className="rounded-md border border-[#4f46e5]/10 bg-white px-4 py-3 text-sm grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div><span className="text-xs text-gray-500">Payout Type</span><p className="font-medium">{rc.payoutType || "—"}</p></div>
                      <div><span className="text-xs text-gray-500">Per Hour</span><p className="font-medium">₹{rc.perHourRate ?? 0}</p></div>
                      <div><span className="text-xs text-gray-500">Per Day</span><p className="font-medium">₹{rc.perDayRate ?? 0}</p></div>
                      <div><span className="text-xs text-gray-500">Per Month</span><p className="font-medium">₹{rc.perMonthRate ?? 0}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!rateCardLoading && rateCards.length === 0 && hasShiftSelected && (
              <NoticeBanner variant="warning" compact className="mt-4">
                No matching rate card found for the selected combination.
              </NoticeBanner>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!selectedContractor || saving}
              >
                {saving ? "Saving…" : "Generate Statement"}
              </Button>
            </div>
      </FormDrawer>

      {!formOpen && (
        <>
          <FilterBar
            search={{
              value: table.search,
              onChange: table.setSearch,
              placeholder: "Search contractor, branch, rate card…",
            }}
          />

          <EntityListShell
            title="Saved payout configurations"
            columns={payoutColumns}
            rows={filteredRecords}
            rowKey={(r) => String(r.id)}
            isLoading={loading}
            sortBy={table.sortBy}
            sortDir={table.sortDir}
            onSort={table.setSort}
            emptyIcon={IndianRupee}
            emptyTitle="No payout configurations saved yet"
            emptyDescription="Generate a statement to save a payout configuration."
          />
        </>
      )}
    </div>
  );
}
