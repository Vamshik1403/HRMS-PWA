"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { FormDrawer } from "../components/ui/form-drawer";
import { Badge } from "../components/ui/badge";
import { Plus, IndianRupee } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";
import { PageHeader } from "../components/app/page-header";
import { FilterBar, FilterSelect } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import { EntityRowActions } from "../components/app/entity-row-actions";
import type { DataTableColumn } from "../components/app/data-table";
import { useClientTable, sortRows } from "../hooks/use-client-table";

type ID = number;

interface ContractorRead {
  id: ID;
  serviceProviderID?: ID | null;
  companyID?: ID | null;
  contractorName?: string | null;
  serviceProvider?: { id: ID; companyName?: string | null } | null;
  company?: { id: ID; companyName?: string | null } | null;
}

const API = {
  contractors: "/backend/contractors",
  departments: "/backend/departments",
  designations: "/backend/designations",
  workShifts: "/backend/work-shift",
  branches: "/backend/branches",
  rateCards: "/backend/contractors/rate-cards",
};

const DEBOUNCE_MS = 250;

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

async function fetchJSONSafe<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const raw = await res.json();
  return (raw?.data ?? raw) as T;
}

// ─── Search Suggest Hook ────────────────────────────────────
function useSearchSuggest<T>(
  items: T[],
  labelFn: (item: T) => string
) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = items.filter((item) =>
    labelFn(item).toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as any)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return { query, setQuery, open, setOpen, ref, filtered };
}

// ─── Component ──────────────────────────────────────────────
export function ContractorRatesManagement() {
  const user = useCurrentUser();
  const canManage =
    user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN";

  const [contractors, setContractors] = useState<ContractorRead[]>([]);
  const [selectedContractor, setSelectedContractor] = useState<ContractorRead | null>(null);
  const [isRateCardOpen, setIsRateCardOpen] = useState(false);
  const [editingRateCard, setEditingRateCard] = useState<any>(null);

  // Contractor search for form
  const [contrSearch, setContrSearch] = useState("");
  const [contrSuggestions, setContrSuggestions] = useState<ContractorRead[]>([]);
  const contrRef = useRef<HTMLDivElement>(null);
  const contrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dropdown data
  const [rcDepartments, setRcDepartments] = useState<{ id: number; departmentName: string }[]>([]);
  const [rcDesignations, setRcDesignations] = useState<{ id: number; designation: string }[]>([]);
  const [rcWorkShifts, setRcWorkShifts] = useState<{ id: number; workShiftName: string }[]>([]);
  const [rcBranches, setRcBranches] = useState<{ id: number; branchName: string }[]>([]);

  // Search suggest states for form fields
  const branchSuggest = useSearchSuggest(rcBranches, (b) => b.branchName);
  const deptSuggest = useSearchSuggest(rcDepartments, (d) => d.departmentName);
  const desigSuggest = useSearchSuggest(rcDesignations, (d) => d.designation);
  const shiftSuggest = useSearchSuggest(rcWorkShifts, (w) => w.workShiftName);

  const [allRateCards, setAllRateCards] = useState<any[]>([]);

  const [branchFilterList, setBranchFilterList] = useState<any[]>([]);
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);
  const table = useClientTable("rateCardName");

  // Form data — single entry
  const emptyForm = () => ({
    contractorName: "",
    branchName: "",
    departmentName: "",
    designation: "",
    workShiftName: "",
    rateCardName: "",
    payoutType: "ALL_INCLUSIVE",
    perMinuteRate: "",
    perHourRate: "",
    perDayRate: "",
    perMonthRate: "",
    dailyRateMinute: "",
    dailyRateHour: "",
    monthlyRateMinute: "",
    monthlyRateHours: "",
    otType: "PERCENTAGE",
    otPerMinuteRate: "",
    otPerHourRate: "",
    otRateMultiplier: "",
    commissionType: "PERCENTAGE",
    commissionBasedOn: "HOURLY",
    commissionValue: "",
  });

  const [formData, setFormData] = useState(emptyForm());

  useEffect(() => {
    if (!user) return;
    if (user.role === "SERVICE_PROVIDER" || user.role === "COMPANY_ADMIN" || user.role === "BRANCH_ADMIN") {
      fetch("/backend/users")
        .then((r) => r.json())
        .then((users) => {
          const me = users.find((u: any) => u.username === user.username);
          setCurrentUserMapping(me || null);
        })
        .catch(() => { });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // For roles that need user mapping, wait for it
    if ((user.role === "SERVICE_PROVIDER" || user.role === "COMPANY_ADMIN" || user.role === "BRANCH_ADMIN") && !currentUserMapping) return;
    loadContractors();
    loadBranchFilterList();
  }, [user, currentUserMapping]);

  useEffect(() => {
    const handler = () => {
  setBranchFilter("ALL");
  setContrSearch("");
  setContrSuggestions([]);
  setSelectedContractor(null);
  setAllRateCards([]);

  branchSuggest.setQuery("");
  deptSuggest.setQuery("");
  desigSuggest.setQuery("");
  shiftSuggest.setQuery("");

  if (user) {
    loadContractors();
    loadBranchFilterList();
  }
};

    window.addEventListener("sidebar-context-changed", handler);
    window.addEventListener("app-data-refresh", handler);
    return () => {
      window.removeEventListener("sidebar-context-changed", handler);
      window.removeEventListener("app-data-refresh", handler);
    };
  }, [user, currentUserMapping]);

  const loadContractors = async () => {
    setLoading(true);
    try {
     let data = await fetchJSONSafe<ContractorRead[]>(API.contractors);

const ctx = getSidebarContext();

const activeCompanyID =
  ctx?.companyID ??
  currentUserMapping?.companyID ??
  user?.companyID ??
  null;

const activeServiceProviderID =
  ctx?.serviceProviderID ??
  currentUserMapping?.serviceProviderID ??
  user?.serviceProviderID ??
  null;

// STRICT: if company selected, show only that company contractors
if (activeCompanyID) {
  data = data.filter(
    (c: any) => Number(c.companyID) === Number(activeCompanyID)
  );
} else if (activeServiceProviderID) {
  data = data.filter(
    (c: any) => Number(c.serviceProviderID) === Number(activeServiceProviderID)
  );
}

if (user?.role === "BRANCH_ADMIN" && user?.branchesID) {
  // if contractor has branchesID in future, filter here
}
      setContractors(data);
      await loadAllRateCards(data);
    } catch (e) {
      console.error("Error loading contractors:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadAllRateCards = async (contractorsList: ContractorRead[]) => {
    try {
      const contractorIDs = new Set(contractorsList.map((c) => Number(c.id)));

      const cards = await fetchJSONSafe<any[]>(API.rateCards);

      let filteredCards = Array.isArray(cards) ? cards : [];

      // Show only rate cards of visible contractors
      filteredCards = filteredCards.filter((rc: any) =>
        contractorIDs.has(Number(rc.contractorID))
      );

      // BRANCH_ADMIN: only own branch
      const userBranchName = user?.branches?.branchName;
      if (user?.role === "BRANCH_ADMIN" && userBranchName) {
        filteredCards = filteredCards.filter(
          (rc: any) =>
            String(rc.branchName || "").toLowerCase() ===
            String(userBranchName || "").toLowerCase()
        );
      }

      setAllRateCards(filteredCards);
    } catch (e) {
      console.error("Failed to load contractor rate cards:", e);
      setAllRateCards([]);
    }
  };

  const loadBranchFilterList = async () => {
    try {
      const all = await fetchJSONSafe<any[]>(API.branches);
      const ctx = getSidebarContext();

      const activeCompanyID =
        ctx?.companyID ??
        user?.companyID ??
        currentUserMapping?.companyID ??
        null;

      let branches = Array.isArray(all) ? all : [];

      if (activeCompanyID) {
        branches = branches.filter(
          (b: any) => Number(b.companyID) === Number(activeCompanyID)
        );
      }

      const userBranchName = user?.branches?.branchName;
      if (user?.role === "BRANCH_ADMIN" && userBranchName) {
        branches = branches.filter(
          (b: any) =>
            String(b.branchName || "").toLowerCase() ===
            String(userBranchName || "").toLowerCase()
        );
      }

      setBranchFilterList(branches);
    } catch (e) {
      console.error("Failed to load branch filter list:", e);
      setBranchFilterList([]);
    }
  };

  const filteredRateCards = useMemo(() => {
    const t = table.search.trim().toLowerCase();
    const filtered = allRateCards.filter((rc: any) => {
      const matchesBranch =
        branchFilter === "ALL" ||
        String(rc.branchName || "") === branchFilter;

      const matchesSearch =
        !t ||
        [
          rc.rateCardName,
          rc.contractorName,
          rc.contractorDisplayName,
          rc.branchName,
          rc.departmentName,
          rc.designation,
          rc.workShiftName,
          rc.payoutType,
          rc.otType,
          rc.commissionType,
          rc.commissionBasedOn,
        ]
          .filter(Boolean)
          .some((x) => String(x).toLowerCase().includes(t));

      return matchesBranch && matchesSearch;
    });

    return sortRows(filtered, table.sortBy, table.sortDir, (row, key) => {
      if (key === "contractor") {
        return String(row.contractorDisplayName || row.contractorName || "");
      }
      if (key === "payoutType") return String(row.payoutType || "");
      if (key === "otRate") return String(row.otRateMultiplier || "");
      return String((row as any)[key] ?? "");
    });
  }, [allRateCards, branchFilter, table.search, table.sortBy, table.sortDir]);

  const branchFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All branches" },
      ...branchFilterList
        .map((b: any) => String(b.branchName || "").trim())
        .filter(Boolean)
        .filter((name, i, arr) => arr.indexOf(name) === i)
        .map((name) => ({ value: name, label: name })),
    ],
    [branchFilterList],
  );

  const rateCardColumns = useMemo((): DataTableColumn<any>[] => [
    {
      key: "rateCardName",
      header: "Rate Card Name",
      sortable: true,
      cell: (rc) => rc.rateCardName || "—",
    },
    {
      key: "contractor",
      header: "Contractor",
      sortable: true,
      cell: (rc) => {
        const displayType =
          rc.payoutType === "COMMISSION_ONLY"
            ? `commission ${rc.commissionBasedOn?.toLowerCase() || "hourly"}`
            : "all inclusive";
        const displayName = rc.contractorDisplayName || rc.contractorName || "";
        return `${displayName}(${displayType})`;
      },
    },
    {
      key: "payoutType",
      header: "Payout Type",
      sortable: true,
      cell: (rc) => (
        <Badge
          variant={rc.payoutType === "COMMISSION_ONLY" ? "outline" : "secondary"}
          className="text-xs"
        >
          {rc.payoutType === "COMMISSION_ONLY" ? "Commission" : "All Inclusive"}
        </Badge>
      ),
    },
    {
      key: "branchName",
      header: "Branch",
      sortable: true,
      cell: (rc) => rc.branchName || "—",
    },
    {
      key: "departmentName",
      header: "Department",
      sortable: true,
      cell: (rc) => rc.departmentName || "—",
    },
    {
      key: "designation",
      header: "Designation",
      sortable: true,
      cell: (rc) => rc.designation || "—",
    },
    {
      key: "workShiftName",
      header: "Work Shift",
      sortable: true,
      cell: (rc) => rc.workShiftName || "—",
    },
    {
      key: "dailyRateMinute",
      header: "Per Minute (₹)",
      cell: (rc) =>
        rc.payoutType === "COMMISSION_ONLY" ? "—" : rc.dailyRateMinute || "0",
    },
    {
      key: "dailyRateHour",
      header: "Per Hour (₹)",
      cell: (rc) =>
        rc.payoutType === "COMMISSION_ONLY" ? "—" : rc.dailyRateHour || "0",
    },
    {
      key: "perDayRate",
      header: "Per Day (₹)",
      cell: (rc) =>
        rc.payoutType === "COMMISSION_ONLY" ? "—" : rc.perDayRate || "0",
    },
    {
      key: "perMonthRate",
      header: "Per Month (₹)",
      cell: (rc) =>
        rc.payoutType === "COMMISSION_ONLY" ? "—" : rc.perMonthRate || "0",
    },
    {
      key: "otRate",
      header: "OT Rate",
      cell: (rc) =>
        rc.payoutType === "COMMISSION_ONLY"
          ? "—"
          : rc.otRateMultiplier
            ? `${rc.otRateMultiplier}x`
            : "—",
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (rc) =>
        canManage ? (
          <EntityRowActions
            onEdit={() => {
              const contractor = contractors.find(
                (c) => Number(c.id) === Number(rc.contractorId ?? rc.contractorID),
              );
              if (contractor) handleOpenRateCard(contractor, rc);
            }}
            editTitle="Edit Rate Card"
          />
        ) : null,
    },
  ], [canManage, contractors]);

  const runFetchContrSuggestions = (q: string) => {
    if (contrTimerRef.current) clearTimeout(contrTimerRef.current);
    contrTimerRef.current = setTimeout(async () => {
      try {
       let all = await fetchJSONSafe<ContractorRead[]>(API.contractors);

const ctx = getSidebarContext();

const activeCompanyID =
  ctx?.companyID ??
  currentUserMapping?.companyID ??
  user?.companyID ??
  null;

const activeServiceProviderID =
  ctx?.serviceProviderID ??
  currentUserMapping?.serviceProviderID ??
  user?.serviceProviderID ??
  null;

if (activeCompanyID) {
  all = all.filter(
    (c: any) => Number(c.companyID) === Number(activeCompanyID)
  );
} else if (activeServiceProviderID) {
  all = all.filter(
    (c: any) => Number(c.serviceProviderID) === Number(activeServiceProviderID)
  );
}
        const ql = q.trim().toLowerCase();
        const filtered = ql
          ? all.filter((c) => (c.contractorName || "").toLowerCase().includes(ql))
          : all;
        setContrSuggestions(filtered.slice(0, 20));
      } catch {
        console.error("Error fetching contractor suggestions");
      }
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contrRef.current && !contrRef.current.contains(e.target as any)) {
        setContrSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadDropdowns = async (companyID?: ID | null) => {
    try {
      const [deptRes, desigRes, wsRes, brRes] = await Promise.all([
        fetchJSONSafe<any[]>(API.departments),
        fetchJSONSafe<any[]>(API.designations),
        fetchJSONSafe<any[]>(API.workShifts),
        fetchJSONSafe<any[]>(API.branches),
      ]);
      const cid = companyID;
      setRcDepartments((deptRes || []).filter((d: any) => !cid || Number(d.companyID) === Number(cid)));
      setRcDesignations((desigRes || []).filter((d: any) => !cid || Number(d.companyID) === Number(cid)));
      setRcWorkShifts((wsRes || []).filter((w: any) => !cid || Number(w.companyID) === Number(cid)));
      const allFilteredBranches = (brRes || []).filter((b: any) => !cid || Number(b.companyID) === Number(cid));
      setRcBranches(
        user?.role === "BRANCH_ADMIN" && user?.branchesID
          ? allFilteredBranches.filter((b: any) => Number(b.id) === Number(user.branchesID))
          : allFilteredBranches
      );
    } catch {
      setRcDepartments([]);
      setRcDesignations([]);
      setRcWorkShifts([]);
      setRcBranches([]);
    }
  };

  const handleOpenRateCard = async (contractor: ContractorRead, rateCard?: any) => {
    setSelectedContractor(contractor);
    setContrSearch(contractor.contractorName || "");
    await loadDropdowns(contractor.companyID);

    if (rateCard) {
      setEditingRateCard(rateCard);
      const f = {
        contractorName: rateCard.contractorName || contractor.contractorName || "",
        branchName: rateCard.branchName || "",
        departmentName: rateCard.departmentName || "",
        designation: rateCard.designation || "",
        workShiftName: rateCard.workShiftName || "",
        payoutType: rateCard.payoutType || "ALL_INCLUSIVE",
        rateCardName: rateCard.rateCardName || "",
        perMinuteRate: rateCard.perMinuteRate?.toString() || "",
        perHourRate: rateCard.perHourRate?.toString() || "",
        perDayRate: rateCard.perDayRate?.toString() || "",
        perMonthRate: rateCard.perMonthRate?.toString() || "",
        dailyRateMinute: rateCard.dailyRateMinute?.toString() || "",
        dailyRateHour: rateCard.dailyRateHour?.toString() || "",
        monthlyRateMinute: rateCard.monthlyRateMinute?.toString() || "",
        monthlyRateHours: rateCard.monthlyRateHours?.toString() || "",
        otType: rateCard.otType || "PERCENTAGE",
        otPerMinuteRate: rateCard.otPerMinuteRate?.toString() || "",
        otPerHourRate: rateCard.otPerHourRate?.toString() || "",
        otRateMultiplier: rateCard.otRateMultiplier?.toString() || "",
        commissionType: rateCard.commissionType || "PERCENTAGE",
        commissionBasedOn: rateCard.commissionBasedOn || "HOURLY",
        commissionValue: rateCard.commissionValue?.toString() || "",
      };
      setFormData(f);
      branchSuggest.setQuery(f.branchName);
      deptSuggest.setQuery(f.departmentName);
      desigSuggest.setQuery(f.designation);
      shiftSuggest.setQuery(f.workShiftName);
    } else {
      setEditingRateCard(null);
      setFormData({ ...emptyForm(), contractorName: contractor.contractorName || "" });
      branchSuggest.setQuery("");
      deptSuggest.setQuery("");
      desigSuggest.setQuery("");
      shiftSuggest.setQuery("");
    }
    setIsRateCardOpen(true);
  };

  const handleAddNew = async () => {
    setSelectedContractor(null);
    setContrSearch("");
    setEditingRateCard(null);
    setFormData(emptyForm());
    branchSuggest.setQuery("");
    deptSuggest.setQuery("");
    desigSuggest.setQuery("");
    shiftSuggest.setQuery("");
const ctx = getSidebarContext();

const activeCompanyID =
  ctx?.companyID ??
  currentUserMapping?.companyID ??
  user?.companyID ??
  null;

await loadDropdowns(activeCompanyID);
    // 🔒 BRANCH_ADMIN — pre-fill branch
    if (user?.role === "BRANCH_ADMIN" && user?.branches?.branchName) {
      setFormData((prev) => ({ ...prev, branchName: user.branches!.branchName }));
      branchSuggest.setQuery(user.branches!.branchName);
    }
    setIsRateCardOpen(true);
  };

  const handleSave = async () => {
    if (!selectedContractor) {
      toast.error("Please select a contractor first");
      return;
    }
    try {
      const payload = {
        rateCards: [
          {
            contractorName: formData.contractorName || undefined,
            branchName: formData.branchName || undefined,
            departmentName: formData.departmentName || undefined,
            designation: formData.designation || undefined,
            workShiftName: formData.workShiftName || undefined,
            payoutType: formData.payoutType || "ALL_INCLUSIVE",
            rateCardName: formData.rateCardName || undefined,
            perMinuteRate: formData.perMinuteRate ? parseFloat(formData.perMinuteRate) : 0,
            perHourRate: formData.perHourRate ? parseFloat(formData.perHourRate) : 0,
            perDayRate: formData.perDayRate ? parseFloat(formData.perDayRate) : 0,
            perMonthRate: formData.perMonthRate ? parseFloat(formData.perMonthRate) : 0,
            dailyRateMinute: formData.dailyRateMinute ? parseFloat(formData.dailyRateMinute) : 0,
            dailyRateHour: formData.dailyRateHour ? parseFloat(formData.dailyRateHour) : 0,
            monthlyRateMinute: formData.monthlyRateMinute ? parseFloat(formData.monthlyRateMinute) : 0,
            monthlyRateHours: formData.monthlyRateHours ? parseFloat(formData.monthlyRateHours) : 0,
            otType: formData.otType || "PERCENTAGE",
            otPerMinuteRate: formData.otPerMinuteRate ? parseFloat(formData.otPerMinuteRate) : 0,
            otPerHourRate: formData.otPerHourRate ? parseFloat(formData.otPerHourRate) : 0,
            otRateMultiplier: formData.otRateMultiplier ? parseFloat(formData.otRateMultiplier) : 0,
            commissionType: formData.commissionType || undefined,
            commissionBasedOn: formData.commissionBasedOn || undefined,
            commissionValue: formData.commissionValue ? parseFloat(formData.commissionValue) : 0,
          },
        ],
      };
      const res = await fetch(`${API.contractors}/${selectedContractor.id}/rate-cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      setIsRateCardOpen(false);
      toast.success("Rate card saved successfully");
      await loadContractors();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save rate card");
    }
  };

  const isAllInclusive = formData.payoutType !== "COMMISSION_ONLY";

  // ─── Search Suggest Field renderrer ───────────────────────
  const renderSuggestField = (
    label: string,
    suggest: ReturnType<typeof useSearchSuggest<any>>,
    labelFn: (item: any) => string,
    onSelect: (item: any) => void
  ) => (
    <div ref={suggest.ref} className="space-y-1 relative">
      <label className="text-xs font-medium text-gray-500 block">{label}</label>
      <Input
        value={suggest.query}
        onChange={(e) => {
          suggest.setQuery(e.target.value);
          suggest.setOpen(true);
        }}
        onFocus={() => suggest.setOpen(true)}
        placeholder={`Search ${label.toLowerCase()}…`}
        autoComplete="off"
      />
      {suggest.open && suggest.filtered.length > 0 && (
        <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto mt-1">
          {suggest.filtered.slice(0, 20).map((item: any, idx: number) => (
            <div
              key={item.id ?? idx}
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
    </div>
  );

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={IndianRupee}
        title="Contractor Rates"
        description="Manage contractor rate cards"
        actions={
          canManage && !isRateCardOpen ? (
            <Button onClick={handleAddNew}>
              <Plus className="w-4 h-4 mr-1" />
              Add Contractor Rates
            </Button>
          ) : null
        }
      />

      {/* ── Rate Card FormDrawer ── */}
      <FormDrawer
        open={isRateCardOpen}
        onOpenChange={setIsRateCardOpen}
        title={editingRateCard ? "Edit Contractor Rate Card" : "Add Contractor Rate Card"}
        description={
          editingRateCard
            ? "Update the rate card details below."
            : "Select a contractor and fill in the rate card details."
        }
      >
        <div className="space-y-4">
          {/* Contractor search */}
          <div ref={contrRef} className="space-y-1 relative">
            <Label>Contractor Name *</Label>
            <Input
              value={contrSearch}
              onChange={(e) => {
                setContrSearch(e.target.value);
                if (!selectedContractor || e.target.value !== selectedContractor.contractorName) {
                  runFetchContrSuggestions(e.target.value);
                }
              }}
              onFocus={() => {
                if (!selectedContractor) runFetchContrSuggestions(contrSearch);
              }}
              placeholder="Type contractor name to search…"
              autoComplete="off"
              disabled={!!selectedContractor}
            />
            {contrSuggestions.length > 0 && !selectedContractor && (
              <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto mt-1">
                {contrSuggestions.map((c) => (
                  <div
                    key={c.id}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={async () => {
                      setContrSearch(c.contractorName || "");
                      setContrSuggestions([]);
                      setSelectedContractor(c);
                      setFormData((prev) => ({
                        ...prev,
                        contractorName: c.contractorName || "",
                      }));
                      await loadDropdowns(c.companyID);
                    }}
                  >
                    {c.contractorName || `Contractor #${c.id}`}
                  </div>
                ))}
              </div>
            )}
            {selectedContractor && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-5 h-7 text-xs text-gray-500"
                onClick={() => {
                  setSelectedContractor(null);
                  setContrSearch("");
                  setFormData(emptyForm());
                  branchSuggest.setQuery("");
                  deptSuggest.setQuery("");
                  desigSuggest.setQuery("");
                  shiftSuggest.setQuery("");
                }}
              >
                Change
              </Button>
            )}
          </div>


          <div className="space-y-1">
            <Label>Rate Card Name *</Label>
            <Input
              value={formData.rateCardName}
              onChange={(e) => setFormData((prev) => ({ ...prev, rateCardName: e.target.value }))}
              placeholder="Enter rate card name"
            />
          </div>

          {/* Payout Type */}
          <div className="space-y-1">
            <Label>Payout Type *</Label>
            <select
              className={SELECT_CLASS}
              value={formData.payoutType}
              onChange={(e) => setFormData((prev) => ({ ...prev, payoutType: e.target.value }))}
            >
              <option value="ALL_INCLUSIVE">All Inclusive</option>
              <option value="COMMISSION_ONLY">Commission Only</option>
            </select>
          </div>

          {/* Branch / Department / Designation / Work Shift — search suggest */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {renderSuggestField("Branch", branchSuggest, (b) => b.branchName, (b) =>
              setFormData((prev) => ({ ...prev, branchName: b.branchName }))
            )}
            {renderSuggestField("Department", deptSuggest, (d) => d.departmentName, (d) =>
              setFormData((prev) => ({ ...prev, departmentName: d.departmentName }))
            )}
            {renderSuggestField("Designation", desigSuggest, (d) => d.designation, (d) =>
              setFormData((prev) => ({ ...prev, designation: d.designation }))
            )}
            {isAllInclusive && renderSuggestField("Work Shift", shiftSuggest, (w) => w.workShiftName, (w) =>
              setFormData((prev) => ({ ...prev, workShiftName: w.workShiftName }))
            )}
          </div>

          {/* ALL_INCLUSIVE fields */}
          {isAllInclusive && (
            <>
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mt-2">
                Working Rates
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 block">Per Minute (₹)</label>
                  <Input type="number" value={formData.dailyRateMinute} onChange={(e) => setFormData((p) => ({ ...p, dailyRateMinute: e.target.value }))} placeholder="0" min="0" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 block">Per Hour (₹)</label>
                  <Input type="number" value={formData.dailyRateHour} onChange={(e) => setFormData((p) => ({ ...p, dailyRateHour: e.target.value }))} placeholder="0" min="0" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 block">Per Day (₹)</label>
                  <Input type="number" value={formData.perDayRate} onChange={(e) => setFormData((p) => ({ ...p, perDayRate: e.target.value }))} placeholder="0" min="0" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 block">Per Month (₹)</label>
                  <Input type="number" value={formData.perMonthRate} onChange={(e) => setFormData((p) => ({ ...p, perMonthRate: e.target.value }))} placeholder="0" min="0" />
                </div>
              </div>

              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mt-2">
                Overtime (OT) Hours Rates
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 block">OT Type *</label>
                  <select
                    className={SELECT_CLASS}
                    value={formData.otType}
                    onChange={(e) => setFormData((prev) => ({ ...prev, otType: e.target.value }))}
                  >
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED">Fixed</option>
                  </select>
                </div>
              </div>

              {formData.otType === "FIXED" && (
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 block">Per Minute (₹)</label>
                    <Input type="number" value={formData.otPerMinuteRate} onChange={(e) => setFormData((p) => ({ ...p, otPerMinuteRate: e.target.value }))} placeholder="0" min="0" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 block">Per Hour (₹)</label>
                    <Input type="number" value={formData.otPerHourRate} onChange={(e) => setFormData((p) => ({ ...p, otPerHourRate: e.target.value }))} placeholder="0" min="0" />
                  </div>
                </div>
              )}

              {formData.otType === "PERCENTAGE" && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 block">OT Rate (x)</label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={formData.otRateMultiplier} onChange={(e) => setFormData((p) => ({ ...p, otRateMultiplier: e.target.value }))} placeholder="e.g. 1.5" min="0" step="0.1" />
                    <span className="text-sm font-medium text-gray-600">x</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* COMMISSION_ONLY fields */}
          {!isAllInclusive && (
            <>
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mt-2">
                Commission Details
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 block">Commission Based On *</label>
                  <select
                    className={SELECT_CLASS}
                    value={formData.commissionBasedOn}
                    onChange={(e) => setFormData((p) => ({ ...p, commissionBasedOn: e.target.value }))}
                  >
                    <option value="HOURLY">Hourly</option>
                    <option value="DAILY">Daily</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 block">Commission Type</label>
                  <select
                    className={SELECT_CLASS}
                    value={formData.commissionType}
                    onChange={(e) => setFormData((p) => ({ ...p, commissionType: e.target.value }))}
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount (₹)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 block">
                  Commission Value {formData.commissionType === "PERCENTAGE" ? "(%)" : "(₹)"}
                </label>
                <Input
                  type="number"
                  value={formData.commissionValue}
                  onChange={(e) => setFormData((p) => ({ ...p, commissionValue: e.target.value }))}
                  placeholder="0"
                  min="0"
                  step={formData.commissionType === "PERCENTAGE" ? "0.01" : "1"}
                />
              </div>
            </>
          )}

          {/* Save / Close */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsRateCardOpen(false)}>
              Close
            </Button>
            <Button disabled={!selectedContractor} onClick={handleSave}>
              Save Rate Card
            </Button>
          </div>
        </div>
      </FormDrawer>

      {!isRateCardOpen && (
        <>
          <FilterBar
            search={{
              value: table.search,
              onChange: table.setSearch,
              placeholder: "Search rate cards…",
            }}
            filters={
              <FilterSelect
                id="contractor-rates-branch"
                value={branchFilter}
                onChange={setBranchFilter}
                options={branchFilterOptions}
                width="w-56"
                ariaLabel="Filter by branch"
              />
            }
          />

          <EntityListShell
            title="Contractor Rate Cards"
            columns={rateCardColumns}
            rows={filteredRateCards}
            rowKey={(r) =>
              String(
                r.id ??
                  `${r.contractorId ?? r.contractorID}-${r.rateCardName ?? ""}-${r.branchName ?? ""}-${r.departmentName ?? ""}-${r.designation ?? ""}`,
              )
            }
            isLoading={loading}
            sortBy={table.sortBy}
            sortDir={table.sortDir}
            onSort={table.setSort}
            emptyIcon={IndianRupee}
            emptyTitle="No rate cards found"
            emptyDescription="Add a contractor rate card to get started."
          />
        </>
      )}
    </div>
  );
}
