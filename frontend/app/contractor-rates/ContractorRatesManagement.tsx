"use client";

import { useEffect, useRef, useState } from "react";
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
import { Plus, Search, IndianRupee } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";

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
    user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN";

  const [contractors, setContractors] = useState<ContractorRead[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
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
  const [loading, setLoading] = useState(false);
  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);

  // Form data — single entry
  const emptyForm = () => ({
    contractorName: "",
    branchName: "",
    departmentName: "",
    designation: "",
    workShiftName: "",
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
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // For roles that need user mapping, wait for it
    if ((user.role === "SERVICE_PROVIDER" || user.role === "COMPANY_ADMIN" || user.role === "BRANCH_ADMIN") && !currentUserMapping) return;
    loadContractors();
  }, [user, currentUserMapping]);

  useEffect(() => {
    const handler = () => { if (user) loadContractors(); };
    window.addEventListener("sidebar-context-changed", handler);
    return () => window.removeEventListener("sidebar-context-changed", handler);
  }, [user, currentUserMapping]);

  const loadContractors = async () => {
    setLoading(true);
    try {
      let data = await fetchJSONSafe<ContractorRead[]>(API.contractors);
      if (user?.role === "SUPERADMIN") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          data = data.filter((c: any) =>
            Number(c.companyID) === Number(ctx.companyID) ||
            (c.companyID == null && Number(c.serviceProviderID) === Number(ctx.serviceProviderID))
          );
        }
      } else if (user?.role === "SERVICE_PROVIDER") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          data = data.filter((c: any) =>
            Number(c.companyID) === Number(ctx.companyID) ||
            (c.companyID == null && Number(c.serviceProviderID) === Number(ctx.serviceProviderID))
          );
        } else if (currentUserMapping?.serviceProviderID) {
          data = data.filter((c: any) => Number(c.serviceProviderID) === Number(currentUserMapping.serviceProviderID));
        }
      } else if (user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN") {
        const ctx = getSidebarContext();
        const companyID = ctx?.companyID ?? currentUserMapping?.companyID ?? user?.companyID;
        const spID = ctx?.serviceProviderID ?? currentUserMapping?.serviceProviderID ?? user?.serviceProviderID;
        if (companyID) {
          data = data.filter((c: any) =>
            Number(c.companyID) === Number(companyID) ||
            (c.companyID == null && spID && Number(c.serviceProviderID) === Number(spID))
          );
        }
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
      const allCards: any[] = [];
      for (const contractor of contractorsList) {
        try {
          const cards = await fetchJSONSafe<any[]>(
            `${API.contractors}/${contractor.id}/rate-cards`
          );
          if (cards && cards.length > 0) {
            allCards.push(
              ...cards.map((c: any) => ({
                ...c,
                contractorId: contractor.id,
                contractorDisplayName: contractor.contractorName || "",
              }))
            );
          }
        } catch {
          /* skip */
        }
      }
      setAllRateCards(allCards);
    } catch {
      setAllRateCards([]);
    }
  };

  const runFetchContrSuggestions = (q: string) => {
    if (contrTimerRef.current) clearTimeout(contrTimerRef.current);
    contrTimerRef.current = setTimeout(async () => {
      try {
        let all = await fetchJSONSafe<ContractorRead[]>(API.contractors);
        if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
          const ctx = getSidebarContext();
          if (ctx?.companyID) {
            all = all.filter((c) =>
              Number(c.companyID) === Number(ctx.companyID) ||
              (c.companyID == null && Number(c.serviceProviderID) === Number(ctx.serviceProviderID))
            );
          } else {
            all = all.filter((c) => Number(c.serviceProviderID) === Number(currentUserMapping.serviceProviderID));
          }
        } else if (user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN") {
          const ctx = getSidebarContext();
          const companyID = ctx?.companyID ?? currentUserMapping?.companyID ?? user?.companyID;
          const spID = ctx?.serviceProviderID ?? currentUserMapping?.serviceProviderID ?? user?.serviceProviderID;
          if (companyID) {
            all = all.filter((c) =>
              Number(c.companyID) === Number(companyID) ||
              (c.companyID == null && spID && Number(c.serviceProviderID) === Number(spID))
            );
          }
        } else if (user?.role === "SUPERADMIN") {
          const ctx = getSidebarContext();
          if (ctx?.companyID) {
            all = all.filter((c) =>
              Number(c.companyID) === Number(ctx.companyID) ||
              (c.companyID == null && Number(c.serviceProviderID) === Number(ctx.serviceProviderID))
            );
          }
        }
        const ql = q.trim().toLowerCase();
        const filtered = ql
          ? all.filter((c) => (c.contractorName || "").toLowerCase().includes(ql))
          : all;
        setContrSuggestions(filtered.slice(0, 20));
      } catch {
        /* ignore */
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
      setRcBranches((brRes || []).filter((b: any) => !cid || Number(b.companyID) === Number(cid)));
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
    await loadDropdowns();
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
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
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
          {/* Header */}
          <div className="flex items-center justify-between w-full">
            <div className="min-w-0 flex-1">
              <p className="text-gray-600 mt-1 text-sm">Manage contractor rate cards</p>
            </div>
            <div className="flex items-center gap-3">
              {canManage && (
                <Button onClick={handleAddNew} className="flex-shrink-0 text-sm px-3 py-2">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Contractor Rates
                </Button>
              )}
            </div>
          </div>

          {/* Search */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4 w-full">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search contractors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>
                <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
                  {
                    allRateCards.filter((rc) =>
                      (rc.contractorDisplayName || rc.contractorName || "")
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase())
                    ).length
                  }{" "}
                  rate cards
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Rate Cards Table */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IndianRupee className="w-5 h-5" />
                Contractor Rate Cards
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contractor</TableHead>
                      <TableHead>Payout Type</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Work Shift</TableHead>
                      <TableHead>Per Minute (₹)</TableHead>
                      <TableHead>Per Hour (₹)</TableHead>
                      <TableHead>Per Day (₹)</TableHead>
                      <TableHead>Per Month (₹)</TableHead>
                      <TableHead>OT Multiplier</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allRateCards.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center py-8 text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <IndianRupee className="w-12 h-12 text-gray-300" />
                            <p>No rate cards found</p>
                            <p className="text-sm">
                              Click &quot;Add Contractor Rates&quot; to create one
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      allRateCards
                        .filter((rc) =>
                          (rc.contractorDisplayName || rc.contractorName || "")
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase())
                        )
                        .map((rc, index) => {
                          const displayType = rc.payoutType === "COMMISSION_ONLY" 
                            ? `commission ${rc.commissionBasedOn?.toLowerCase() || 'hourly'}`
                            : "all inclusive";
                          const displayName = rc.contractorDisplayName || rc.contractorName || "";
                          const fullName = `${displayName}(${displayType})`;
                          return (
                          <TableRow key={`${rc.contractorId}-${index}`}>
                            <TableCell>
                              {fullName}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  rc.payoutType === "COMMISSION_ONLY" ? "outline" : "secondary"
                                }
                                className="text-xs"
                              >
                                {rc.payoutType === "COMMISSION_ONLY"
                                  ? "Commission"
                                  : "All Inclusive"}
                              </Badge>
                            </TableCell>
                            <TableCell>{rc.branchName || "—"}</TableCell>
                            <TableCell>{rc.departmentName || "—"}</TableCell>
                            <TableCell>{rc.designation || "—"}</TableCell>
                            <TableCell>{rc.workShiftName || "—"}</TableCell>
                            <TableCell>
                              {rc.payoutType === "COMMISSION_ONLY"
                                ? "—"
                                : rc.dailyRateMinute || "0"}
                            </TableCell>
                            <TableCell>
                              {rc.payoutType === "COMMISSION_ONLY"
                                ? "—"
                                : rc.dailyRateHour || "0"}
                            </TableCell>
                            <TableCell>
                              {rc.payoutType === "COMMISSION_ONLY"
                                ? "—"
                                : rc.perDayRate || "0"}
                            </TableCell>
                            <TableCell>
                              {rc.payoutType === "COMMISSION_ONLY"
                                ? "—"
                                : rc.perMonthRate || "0"}
                            </TableCell>
                            <TableCell>
                              {rc.payoutType === "COMMISSION_ONLY"
                                ? "—"
                                : rc.otRateMultiplier || "—"}
                            </TableCell>
                            <TableCell>
                              {rc.payoutType === "COMMISSION_ONLY"
                                ? `${rc.commissionValue || 0}${rc.commissionType === "PERCENTAGE" ? "%" : " ₹"}`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {canManage && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const contractor = contractors.find(
                                      (c) => c.id === rc.contractorId
                                    );
                                    if (contractor) handleOpenRateCard(contractor, rc);
                                  }}
                                  className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  title="Edit Rate Card"
                                >
                                  <IndianRupee className="w-3 h-3 mr-1" /> Edit
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                          );
                        })
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
